import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const MAX_MEMORY_INPUT_CHARS = 2000;
const FETCH_TIMEOUT_MS = 20_000;
const TELEGRAM_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 2;

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

// Error alert, formatted to match the user-message-telegram style. No slow alert here.
function sendTelegramError(error: string, context: string): void {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const text =
        `🚨 <b>Error</b> · update-memory\n` +
        `<blockquote>${esc(error)}</blockquote>\n` +
        `<i>${esc(context)}</i>`;
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

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
            const response = await fetchWithTimeout(url, options);
            const shouldRetry = response.status === 429 || (response.status >= 500 && response.status < 600);
            if (response.ok || !shouldRetry) return response;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
        }
        if (attempt <= MAX_RETRIES) {
            const wait = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
            await new Promise(r => setTimeout(r, wait));
        }
    }
    throw lastError || new Error('Max retries exceeded');
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok');

    try {
        const { character_id, user_id, client_id, message, agent_reply } = await req.json();

        if (!character_id || !message || !agent_reply) {
            return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Load current memory row
        let q = supabase.from('user_character').select('id,memory').eq('character_id', character_id).limit(1);
        if (user_id) q = q.eq('user_id', user_id);
        else if (client_id) q = q.eq('client_id', client_id);
        const { data: uc } = await q.maybeSingle();

        const currentMemory = uc?.memory || null;
        const userCharacterId = uc?.id || null;

        const truncatedMemory = currentMemory && currentMemory.length > MAX_MEMORY_INPUT_CHARS
            ? currentMemory.slice(-MAX_MEMORY_INPUT_CHARS)
            : (currentMemory || '');

        const prompt = `You are updating the memory/context between a user and a character AI.

Previous memory:
${truncatedMemory || 'No previous memory.'}

Recent conversation exchange:
User: ${message}
Character: ${agent_reply}

Update the memory to include important information from this conversation. Keep it concise (max 500 words) and focus on important facts, events, relationship dynamics, and plans. Return ONLY the updated memory text.`;

        // Try OpenAI first, fall back to Gemini
        let newMem = currentMemory || '';
        let providerUsed = '';

        try {
            if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
            const oaResp = await fetchWithRetry(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: OPENAI_MODEL,
                    messages: [{ role: 'user', content: prompt }],
                    max_completion_tokens: 800,
                    temperature: 0.4,
                }),
            });
            if (!oaResp.ok) {
                throw new Error(`OpenAI ${oaResp.status}: ${(await oaResp.text()).slice(0, 200)}`);
            }
            const oaData = await oaResp.json();
            newMem = oaData?.choices?.[0]?.message?.content?.trim() || newMem;
            providerUsed = 'openai';
        } catch (openaiErr: any) {
            console.error(`update-memory: OpenAI failed: ${openaiErr.message}. Falling back to Gemini...`);
            const reqBody = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
            };
            const resp = await fetchWithRetry(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody),
            });
            if (!resp.ok) {
                const errText = await resp.text().catch(() => '');
                const errMsg = `Both providers failed. OpenAI: ${openaiErr.message}. Gemini ${resp.status}: ${errText.slice(0, 200)}`;
                console.error(errMsg);
                sendTelegramError(errMsg, `Character: ${character_id}`);
                return new Response(JSON.stringify({ error: errMsg }), {
                    status: resp.status >= 500 ? 502 : resp.status
                });
            }
            const data = await resp.json();
            newMem = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || newMem;
            providerUsed = 'gemini';
        }

        if (userCharacterId) {
            await supabase.from('user_character').update({ memory: newMem }).eq('id', userCharacterId);
        } else {
            const payload: any = { character_id, memory: newMem };
            if (user_id) payload.user_id = user_id;
            if (client_id) payload.client_id = client_id;
            await supabase.from('user_character').insert(payload);
        }

        return new Response(JSON.stringify({ ok: true, provider: providerUsed }), { status: 200 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('update-memory error:', msg);
        sendTelegramError(msg, 'Top-level catch');
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
});
