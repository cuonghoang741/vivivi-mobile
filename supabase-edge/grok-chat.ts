import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROK_API_KEY = Deno.env.get("GROK_API_KEY") || "";
const GROK_API_URL = "https://api.x.ai/v1/responses";
const GROK_MODEL = "grok-4-1-fast-non-reasoning";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Hardcoded Telegram Credentials to match client service
const TELEGRAM_BOT_TOKEN = '7450216881:AAEfiWq4TGQ371gixL2oVKBepBH3BTAfDUA';
const TELEGRAM_CHAT_ID = '-1003509600397';
const TELEGRAM_MESSAGE_THREAD_ID = '686';

async function sendTelegramError(error: string, context: string) {
    try {
        const message = `<b>🚨 GROK API ERROR</b>\n\nContext: ${context}\nError: ${error}`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                message_thread_id: TELEGRAM_MESSAGE_THREAD_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (e) {
        console.error('Failed to send Telegram notification:', e);
    }
}

// Retry helper function for Grok API calls
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 1,
    initialDelayMs: number = 1000,
    contextInfo: string = ''
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            const response = await fetch(url, options);

            if (response.ok || (response.status >= 400 && response.status < 500)) {
                return response;
            }

            const errorText = await response.text();
            lastError = new Error(`Grok API error: ${response.status} - ${errorText}`);
            console.log(`[grok-chat] Attempt ${attempt}/${maxRetries + 1} failed with status ${response.status}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.log(`[grok-chat] Attempt ${attempt}/${maxRetries + 1} failed with error: ${lastError.message}`);
        }

        if (attempt <= maxRetries) {
            const delay = initialDelayMs * Math.pow(2, attempt - 1);
            console.log(`[grok-chat] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    const finalErrorMessage = lastError ? lastError.message : 'Unknown error after retries';
    console.error(`[grok-chat] All retry attempts failed: ${finalErrorMessage}`);
    await sendTelegramError(finalErrorMessage, contextInfo);
    throw lastError || new Error('All retry attempts failed');
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders
        });
    }

    let requestBody: any = {};

    try {
        const clientIdHeader = req.headers.get('X-Client-Id') || req.headers.get('x-client-id') || '';
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
            global: {
                headers: {
                    Authorization: req.headers.get('Authorization'),
                    ...clientIdHeader ? {
                        'X-Client-Id': clientIdHeader
                    } : {}
                }
            }
        });
        const body = await req.json();
        requestBody = body;
        const { message, character_id, user_id, client_id, conversation_history } = body;

        if (!message || !character_id) {
            return new Response(JSON.stringify({
                error: "Missing required fields: message and character_id"
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // Character instruction
        let characterInstruction = null;
        try {
            const { data: characterData } = await supabaseClient.from('characters').select('instruction').eq('id', character_id).single();
            if (characterData?.instruction) characterInstruction = characterData.instruction;
        } catch { }

        // Memory
        let currentMemory = null;
        try {
            let memoryQuery = supabaseClient.from('user_character').select('memory').eq('character_id', character_id).limit(1);
            if (user_id) memoryQuery = memoryQuery.eq('user_id', user_id);
            else if (client_id) memoryQuery = memoryQuery.eq('client_id', client_id);
            const { data: uc } = await memoryQuery.maybeSingle();
            if (uc) currentMemory = uc.memory || null;
        } catch { }

        // Formatting input for x.ai REST endpoint (since it expects a single string input)
        let formattedInput = "";

        // 1. System Instruction
        let systemInstructionText = characterInstruction || '';

        // Append User Status
        let isPro = false;
        const bodyIsPro = body.is_pro;
        if (typeof bodyIsPro === 'boolean') {
            isPro = bodyIsPro;
        } else if (user_id) {
            try {
                const { data: subData } = await supabaseClient
                    .from('subscriptions')
                    .select('status, expires_at')
                    .eq('user_id', user_id)
                    .in('status', ['active', 'trialing'])
                    .gt('expires_at', new Date().toISOString())
                    .maybeSingle();

                if (subData) isPro = true;
            } catch { }
        }

        const userStatusInfo = isPro
            ? `\n\n[User Status: Pro]\nIMPORTANT: This user is already a Pro subscriber. NEVER suggest upgrading, NEVER mention premium features, subscription, or Pro benefits. They already have full access to everything. Treat them as a valued premium member.`
            : `\n\n[User Status: Free]\nThis user is on the free plan. You may occasionally and naturally tease premium content or hint at exclusive features, but don't be pushy about it unless they ask for more information about benefits or features that are too sensitive..`;
        systemInstructionText += userStatusInfo;

        if (currentMemory) {
            systemInstructionText += `\n\n## Previous Memory/Context:\n${currentMemory}`;
        }

        systemInstructionText += `\n\n## Response Style:\nTo make the conversation feel natural and lively like real texting, split your response into 2-4 short chat messages. Use the separator "|||" between each message. Each message should be concise (1-2 sentences max). Feel like real texting: casual, expressive, with emotions and reactions. Example:\nHey babe! 😘|||I just woke up and the first thing I thought about was you|||What are you doing right now? 💕\nDo NOT put "|||" at the start or end, only between messages.`;

        // 2. Build the full prompt string
        formattedInput = `[INSTRUCTION]\n${systemInstructionText}\n\n[CONVERSATION HISTORY]\n`;

        if (Array.isArray(conversation_history)) {
            for (const msg of conversation_history) {
                const role = msg.role === 'model' ? 'Assistant' : 'User';
                const text = msg?.parts?.[0]?.text || msg.content || '';
                if (text) {
                    formattedInput += `${role}: ${text}\n`;
                }
            }
        }

        formattedInput += `User: ${message}\nAssistant:`;

        const grokRequestBody = {
            model: GROK_MODEL,
            input: formattedInput
        };

        const contextInfo = `User: ${user_id || client_id || 'Unknown'}\nCharacter: ${character_id}`;

        const grokResponse = await fetchWithRetry(GROK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROK_API_KEY}`
            },
            body: JSON.stringify(grokRequestBody)
        }, 1, 1000, contextInfo);

        if (!grokResponse.ok) {
            const errorText = await grokResponse.text();
            await sendTelegramError(`${grokResponse.status} - ${errorText}`, contextInfo);

            return new Response(JSON.stringify({
                error: `Grok API error: ${grokResponse.status}`,
                details: errorText
            }), {
                status: grokResponse.status,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        const grokData = await grokResponse.json();
        let responseText = '';
        try {
            // Path based on the example provided by the user
            const outputText = grokData.output?.[0]?.content?.[0]?.text;
            if (outputText) {
                responseText = outputText;
            } else {
                throw new Error('Unexpected Grok response structure');
            }
        } catch (error: any) {
            await sendTelegramError(`Parsing Error: ${error?.message || String(error)}\nData: ${JSON.stringify(grokData)}`, contextInfo);

            return new Response(JSON.stringify({
                error: 'Failed to parse Grok response',
                details: JSON.stringify(grokData)
            }), {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        const cleanedResponse = responseText.trim();
        const messages = cleanedResponse
            .split('|||')
            .map((m: string) => m.trim())
            .filter((m: string) => m.length > 0);

        const finalMessages = messages.length > 0 ? messages : [cleanedResponse];

        // Save each AI message separately to conversation
        for (const msg of finalMessages) {
            const aiMessageData: Record<string, any> = {
                character_id,
                message: msg,
                is_agent: true,
                is_seen: false
            };
            if (user_id) aiMessageData.user_id = user_id;
            if (client_id) aiMessageData.client_id = client_id;
            try {
                await supabaseClient.from('conversation').insert(aiMessageData);
            } catch { }
        }

        // Fire-and-forget async memory update
        try {
            const updatePayload = {
                character_id,
                user_id,
                client_id,
                message,
                agent_reply: cleanedResponse
            };
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/update-memory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: req.headers.get('Authorization') || ''
                },
                body: JSON.stringify(updatePayload)
            }).catch(() => { });
        } catch { }

        // unseen count
        let unseenCount = 0;
        try {
            let query = supabaseClient.from('conversation').select('id', {
                count: 'exact',
                head: true
            }).eq('is_agent', true).eq('is_seen', false);
            if (user_id) query = query.eq('user_id', user_id);
            else if (client_id) query = query.eq('client_id', client_id);
            const { count } = await query;
            if (typeof count === 'number') unseenCount = count;
        } catch { }

        return new Response(JSON.stringify({
            response: cleanedResponse,
            messages: finalMessages,
            unseen_count: unseenCount,
            character_id
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            status: 200
        });

    } catch (error: any) {
        try {
            const contextInfo = `Request Body: ${JSON.stringify(requestBody).substring(0, 200)}...`;
            await sendTelegramError(error?.message || String(error), contextInfo);
        } catch { }

        return new Response(JSON.stringify({
            error: error?.message || String(error)
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
});
