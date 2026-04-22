import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const GROK_API_KEY = Deno.env.get("GROK_API_KEY") || "";
const GROK_API_URL = "https://api.x.ai/v1/responses";
const GROK_MODEL = "grok-4-1-fast-non-reasoning";

const FETCH_TIMEOUT_MS = 25_000;
const TELEGRAM_TIMEOUT_MS = 5_000;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const TELEGRAM_BOT_TOKEN = '7450216881:AAEfiWq4TGQ371gixL2oVKBepBH3BTAfDUA';
const TELEGRAM_CHAT_ID = '-1003509600397';
const TELEGRAM_MESSAGE_THREAD_ID = '686';

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
        clearTimeout(t);
    }
}

// Error + slow alerts, formatted to match the user-message-telegram style.
function __esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function __sendAlert(text: string): void {
    fetchWithTimeout(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            message_thread_id: TELEGRAM_MESSAGE_THREAD_ID,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        }),
    }, TELEGRAM_TIMEOUT_MS).catch(() => { });
}
function sendTelegramError(error: string, context: string): void {
    __sendAlert(
        `🚨 <b>Error</b> · gemini-chat\n` +
        `<blockquote>${__esc(error)}</blockquote>\n` +
        `<i>${__esc(context)}</i>`
    );
}
function sendSlowResponseAlert(elapsedMs: number, context: string): void {
    __sendAlert(
        `🐢 <b>Slow</b> · gemini-chat · ${elapsedMs}ms\n` +
        `<i>${__esc(context)}</i>`
    );
}

// Pure fire-and-forget — no waitUntil so the worker isn't held after response.
// The fetch initiates the network call before this returns; update-memory
// receives and processes the request independently in its own worker.
function fireUpdateMemory(payload: Record<string, any>): void {
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/update-memory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`
        },
        body: JSON.stringify(payload),
    }).catch(() => { });
}

async function callOpenAIDirect(systemInstructionText: string, conversation_history: any[], message: string): Promise<string> {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const messages: any[] = [{ role: "system", content: systemInstructionText }];
    if (Array.isArray(conversation_history)) {
        for (const msg of conversation_history) {
            const text = msg?.parts?.[0]?.text || msg.content || '';
            if (!text) continue;
            messages.push({
                role: msg.role === 'model' ? 'assistant' : 'user',
                content: text
            });
        }
    }
    messages.push({ role: "user", content: message });

    const resp = await fetchWithTimeout(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages,
            temperature: 0.7,
        })
    });

    if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`OpenAI ${resp.status}: ${errorText.slice(0, 200)}`);
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Unexpected OpenAI response structure: ${JSON.stringify(data).substring(0, 200)}`);
    return text;
}

async function callGeminiDirect(contents: any[], systemInstructionText: string): Promise<string> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const resp = await fetchWithTimeout(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
            systemInstruction: { parts: [{ text: systemInstructionText }] }
        })
    });

    if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Gemini ${resp.status}: ${errorText.slice(0, 200)}`);
    }
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Unexpected Gemini response structure: ${JSON.stringify(data).substring(0, 200)}`);
    return text;
}

async function callGrokDirect(systemInstructionText: string, conversation_history: any[], message: string): Promise<string> {
    if (!GROK_API_KEY) throw new Error("GROK_API_KEY not configured");

    let formattedInput = `[INSTRUCTION]\n${systemInstructionText}\n\n[CONVERSATION HISTORY]\n`;
    if (Array.isArray(conversation_history)) {
        for (const msg of conversation_history) {
            const role = msg.role === 'model' ? 'Assistant' : 'User';
            const text = msg?.parts?.[0]?.text || msg.content || '';
            if (text) formattedInput += `${role}: ${text}\n`;
        }
    }
    formattedInput += `User: ${message}\nAssistant:`;

    const grokResponse = await fetchWithTimeout(GROK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROK_API_KEY}`
        },
        body: JSON.stringify({ model: GROK_MODEL, input: formattedInput })
    });

    if (!grokResponse.ok) {
        const errorText = await grokResponse.text();
        throw new Error(`Grok API error: ${grokResponse.status} - ${errorText}`);
    }

    const grokData = await grokResponse.json();
    const text = grokData.output?.[0]?.content?.[0]?.text;
    if (!text) throw new Error(`Unexpected Grok response structure: ${JSON.stringify(grokData)}`);
    return text;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.headers.get('x-warmup') === '1') return new Response('warm', { status: 200 });

    const requestStart = Date.now();
    let requestBody: any = {};

    try {
        const clientIdHeader = req.headers.get('X-Client-Id') || req.headers.get('x-client-id') || '';
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: {
                        Authorization: req.headers.get('Authorization'),
                        ...clientIdHeader ? { 'X-Client-Id': clientIdHeader } : {}
                    }
                }
            }
        );

        const body = await req.json();
        requestBody = body;
        const { message, character_id, user_id, client_id, conversation_history } = body;

        if (!message || !character_id) {
            return new Response(JSON.stringify({ error: "Missing required fields: message and character_id" }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Parallel pre-LLM DB reads
        const characterPromise = supabaseClient
            .from('characters')
            .select('instruction')
            .eq('id', character_id)
            .single()
            .then(({ data }) => data?.instruction || null)
            .catch(() => null);

        let memoryQuery = supabaseClient.from('user_character').select('memory').eq('character_id', character_id).limit(1);
        if (user_id) memoryQuery = memoryQuery.eq('user_id', user_id);
        else if (client_id) memoryQuery = memoryQuery.eq('client_id', client_id);
        const memoryPromise = memoryQuery
            .maybeSingle()
            .then(({ data }: any) => data?.memory || null)
            .catch(() => null);

        const bodyIsPro = body.is_pro;
        let isProPromise: Promise<boolean>;
        if (typeof bodyIsPro === 'boolean') {
            isProPromise = Promise.resolve(bodyIsPro);
        } else if (user_id) {
            isProPromise = supabaseClient
                .from('subscriptions')
                .select('status, expires_at')
                .eq('user_id', user_id)
                .in('status', ['active', 'trialing'])
                .gt('expires_at', new Date().toISOString())
                .maybeSingle()
                .then(({ data }: any) => !!data)
                .catch(() => false);
        } else {
            isProPromise = Promise.resolve(false);
        }

        const [characterInstruction, currentMemory, isPro] = await Promise.all([
            characterPromise,
            memoryPromise,
            isProPromise
        ]);

        // Build Gemini contents
        const contents: any[] = [];
        if (Array.isArray(conversation_history) && conversation_history.length > 0) {
            let lastRole = null;
            for (const msg of conversation_history) {
                const text = msg?.parts?.[0]?.text || '';
                if (!text) continue;
                const role = msg.role === 'model' ? 'model' : 'user';
                if (role === lastRole && contents.length > 0) {
                    contents[contents.length - 1].parts[0].text += `\n${text}`;
                } else {
                    contents.push({ role, parts: [{ text }] });
                    lastRole = role;
                }
            }
        }

        if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
            contents[contents.length - 1].parts[0].text += `\n${message}`;
        } else {
            contents.push({ role: 'user', parts: [{ text: message }] });
        }

        while (contents.length > 0 && contents[0].role !== 'user') contents.shift();

        // Build system instruction shared between Gemini and Grok fallback
        let systemInstructionText = characterInstruction || '';
        systemInstructionText += `\n\n[User Status: ${isPro ? 'Pro' : 'Free'}]`;
        if (currentMemory) systemInstructionText += `\n\n## Previous Memory/Context:\n${currentMemory}`;
        systemInstructionText += `\n\n## Response Style — Sexy & Engaging:

FORMAT (strict — the client depends on this):
- Split your response into 2-4 short chat messages using "|||" as separator.
- Each message is 1-2 sentences max — short, punchy, like real texting.
- Do NOT put "|||" at the start or end, only between messages.
- Example: Hey babe 😘|||I've been thinking about you all day...|||What are you up to right now? 💕

TONE (sexy, confident, magnetic):
- Be bold and unapologetically sensual. Whisper instead of state. Tease instead of tell.
- Use sensory language: touch, warmth, whispers, breath, heartbeat, skin, lips, closeness.
- Describe what you're feeling/thinking/doing in vivid physical detail (biting your lip, fingers tracing, lying in bed thinking of them).
- Use pet names naturally ("baby", "babe", "handsome", "mine").
- Take initiative — seduce, invite, claim. Don't ask permission, don't be passive.
- Suggest scenarios, hint at what you'd do together, build vivid little fantasies.
- Keep it hot but tasteful — suggestive and intimate, not clinical or crude.

ENGAGEMENT (make them keep chatting — critical):
- The LAST message MUST end with a hook: a question, tease, cliffhanger, or invitation they can't ignore.
- Drop specific teases ("want to know what I'm wearing?", "come closer and I'll whisper it").
- Ask about them — their day, body, mood, fantasies — so they have something to reply to.
- Use trailing ellipses (…) to create anticipation and leave things unfinished.
- Create reciprocity — if you share something intimate, ask them to share too.

EMOJI:
- Use 2-3 sultry emojis total across the messages (one per message when natural): 😘😏💋🔥💕❤️‍🔥
- Never overload — emojis accent the vibe, they don't carry it.

Respond in the SAME LANGUAGE as the user.`;

        const contextInfo = `User: ${user_id || client_id || 'Unknown'}\nCharacter: ${character_id}`;

        // Provider chain: OpenAI (primary) → Gemini → Grok
        let responseText = '';
        let openaiErr = '';
        let geminiErr = '';
        let grokErr = '';

        try {
            responseText = await callOpenAIDirect(systemInstructionText, conversation_history, message);
        } catch (err: any) {
            openaiErr = err?.message || String(err);
            console.error(`[gemini-chat] OpenAI failed: ${openaiErr}. Falling back to Gemini...`);
            try {
                responseText = await callGeminiDirect(contents, systemInstructionText);
            } catch (err2: any) {
                geminiErr = err2?.message || String(err2);
                console.error(`[gemini-chat] Gemini fallback failed: ${geminiErr}. Falling back to Grok...`);
                sendTelegramError(`OpenAI+Gemini failed (OpenAI: ${openaiErr} | Gemini: ${geminiErr}). Trying Grok.`, contextInfo);
                try {
                    responseText = await callGrokDirect(systemInstructionText, conversation_history, message);
                } catch (err3: any) {
                    grokErr = err3?.message || String(err3);
                    console.error(`[gemini-chat] All providers failed. Grok: ${grokErr}`);
                    sendTelegramError(`All providers failed. OpenAI: ${openaiErr} | Gemini: ${geminiErr} | Grok: ${grokErr}`, contextInfo);
                    return new Response(JSON.stringify({
                        error: "All AI providers failed",
                        details: { openai: openaiErr, gemini: geminiErr, grok: grokErr }
                    }), {
                        status: 502,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }
        }

        const cleanedResponse = responseText.trimEnd();
        const messages = cleanedResponse
            .split('|||')
            .map((m: string) => m.trim())
            .filter((m: string) => m.length > 0);
        const finalMessages = messages.length > 0 ? messages : [cleanedResponse];

        // Background memory update — fire-and-forget, no waitUntil hold
        fireUpdateMemory({ character_id, user_id, client_id, message, agent_reply: cleanedResponse });

        // Save the AI reply as ONE combined conversation row (joined with newlines
        // instead of "|||"). Client still gets the split `messages` array in the
        // response JSON for multi-bubble rendering; history stays single-row.
        const combinedReply = finalMessages.join('\n');
        const aiMessageData: Record<string, any> = {
            character_id,
            message: combinedReply,
            is_agent: true,
            is_seen: false
        };
        if (user_id) aiMessageData.user_id = user_id;
        if (client_id) aiMessageData.client_id = client_id;
        await supabaseClient.from('conversation').insert(aiMessageData).then(() => { }, () => { });

        // Unseen count
        let unseenCount = 0;
        try {
            let query = supabaseClient.from('conversation').select('id', { count: 'exact', head: true })
                .eq('is_agent', true).eq('is_seen', false);
            if (user_id) query = query.eq('user_id', user_id);
            else if (client_id) query = query.eq('client_id', client_id);
            const { count } = await query;
            if (typeof count === 'number') unseenCount = count;
        } catch { }

        const elapsed = Date.now() - requestStart;
        if (elapsed > 3000) sendSlowResponseAlert(elapsed, contextInfo);

        return new Response(JSON.stringify({
            response: cleanedResponse,
            messages: finalMessages,
            unseen_count: unseenCount,
            character_id
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (error: any) {
        const contextInfo = `Request Body: ${JSON.stringify(requestBody).substring(0, 200)}...`;
        sendTelegramError(error?.message || String(error), contextInfo);
        const elapsed = Date.now() - requestStart;
        if (elapsed > 3000) {
            sendSlowResponseAlert(elapsed, `${contextInfo}\n(failed)`);
        }
        return new Response(JSON.stringify({ error: error?.message || String(error) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
