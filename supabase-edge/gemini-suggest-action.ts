import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
const GROK_API_KEY = Deno.env.get("GROK_API_KEY") || "";
const GROK_API_URL = "https://api.x.ai/v1/responses";
const GROK_MODEL = "grok-4-1-fast-non-reasoning";

const FETCH_TIMEOUT_MS = 15_000;

const AVAILABLE_ANIMATIONS = [
    { name: "Angry", keywords: ["angry", "giận", "tức giận", "bực tức", "mad"] },
    { name: "Bashful", keywords: ["bashful", "ngại", "xấu hổ", "shy", "embarrassed", "ngượng"] },
    { name: "Blow A Kiss", keywords: ["kiss", "hôn", "thơm", "blow a kiss", "muah", "love"] },
    { name: "Booty Hip Hop Dance", keywords: ["booty", "hip hop", "nhảy hip hop", "dance"] },
    { name: "Cross Jumps", keywords: ["jump", "nhảy", "cross jumps"] },
    { name: "Hand Raising", keywords: ["wave", "vẫy tay", "raise hand", "giơ tay", "chào"] },
    { name: "Happy", keywords: ["happy", "vui", "hạnh phúc", "vui vẻ", "smile"] },
    { name: "Hip Hop Dancing", keywords: ["hip hop", "nhảy hip hop", "dance hip hop"] },
    { name: "Idle Stand", keywords: ["idle", "đứng yên", "stand", "relax"] },
    { name: "Jumping Jacks", keywords: ["jumping jacks", "tập thể dục", "exercise"] },
    { name: "Quick Steps", keywords: ["quick steps", "bước nhanh", "quick"] },
    { name: "Rumba Dancing", keywords: ["rumba", "nhảy rumba", "latin dance"] },
    { name: "Snake Hip Hop Dance", keywords: ["snake", "hip hop", "nhảy"] },
    { name: "Standing Arguing", keywords: ["argue", "cãi nhau", "tranh luận", "arguing"] },
    { name: "Standing Greeting", keywords: ["greet", "chào", "hello", "xin chào", "greeting"] },
    { name: "Step Hip Hop Dance", keywords: ["step", "hip hop", "nhảy step"] },
    { name: "Talking", keywords: ["talk", "nói", "speaking", "nói chuyện"] },
    { name: "Taunt", keywords: ["taunt", "chọc", "tease", "trêu"] },
    { name: "Thinking", keywords: ["think", "suy nghĩ", "thinking", "nghĩ"] },
    { name: "Threatening", keywords: ["threaten", "dọa", "đe dọa", "scary"] },
];

const AVAILABLE_MEDIA_KEYWORDS = [
    "cook", "beach", "masturbate", "show boobs", "show pussy",
    "hangout", "take a shower", "nude", "lie"
];

const AVAILABLE_ACTIONS = [
    {
        action: "send_photo",
        description: "User wants the character to send them a photo, picture, image, selfie. Optionally detect a keyword describing the content they want.",
        examples: ["gửi ảnh đi", "cho anh xem ảnh", "send a photo", "send a picture", "show me a photo", "gửi hình đi", "selfie đi", "gửi ảnh nude đi", "send nude photo", "gửi ảnh nóng", "ảnh tắm đi", "gửi ảnh nấu ăn", "ảnh đi biển đi", "what are u doing"]
    },
    {
        action: "send_video",
        description: "User wants the character to send them a video. Optionally detect a keyword describing the content they want.",
        examples: ["gửi video đi", "send a video", "show me a video", "quay video đi", "gửi clip đi", "video khiêu gợi", "video nude", "clip nóng"]
    },
    {
        action: "change_background",
        description: "User wants to change the background, scene, room, or environment",
        examples: ["đổi phòng khác đi", "change the background", "I want a different scene", "chuyển cảnh khác"]
    },
    {
        action: "change_costume",
        description: "User wants to change the character's outfit, clothes, or costume",
        examples: ["đổi quần áo đi", "thay đồ khác", "change your outfit", "mặc đồ khác đi"]
    },
    {
        action: "become_nude",
        description: "User EXPLICITLY wants to see the character nude, undressed, or naked in the 3D scene (NOT a photo)",
        examples: ["cởi đồ", "nude", "lột đồ", "naked", "undress", "cho xem hàng", "show nude", "show sensitive body areas", 'take off', 'show pussy', "make me suprise"]
    },
    {
        action: "change_character",
        description: "User wants to switch to a different character entirely",
        examples: ["đổi nhân vật khác", "I want to talk to someone else", "switch character", "Do you have friend?"]
    },
    {
        action: "play_animation",
        description: `User wants the character to perform an action, dance, move, or express emotion. Available animations: ${AVAILABLE_ANIMATIONS.map(a => a.name).join(", ")}`,
        examples: ["nhảy đi", "dance for me", "hôn anh đi", "làm điệu giận đi", "vui lên đi", "chào đi", "suy nghĩ đi"]
    },
    {
        action: "start_voice_call",
        description: "User wants to start a voice call or audio conversation",
        examples: ["gọi cho anh", "let's call", "voice call", "nói chuyện trực tiếp đi"]
    },
    {
        action: "start_video_call",
        description: "User wants to start a video call with camera",
        examples: ["video call", "gọi video đi", "muốn nhìn thấy mặt em", "I miss you"]
    },
    {
        action: "button_upgrade",
        description: "The AI character wants to suggest the user to upgrade to Pro. Use this when the character's response naturally leads to mentioning premium features, exclusive content, or when the character teases about locked features. Do NOT use if user explicitly asks to upgrade (use open_subscription instead).",
        examples: ["i want to upgrade pro", "Where can i find the button pro", "I want to upgrade", "I want to buy pro", "I want to buy premium", "I want to buy subscription", "I want to buy pro", "I cannot find the diamond", 'I can\'t see the diamond', 'Where is the button']
    },
    {
        action: "none",
        description: "No action needed - just regular conversation, chat, or unrelated message",
        examples: ["how are you", "what's your name", "I love you", "tell me a story"]
    }
];

const SYSTEM_PROMPT = `You are an action detection assistant for a virtual companion app. Your job is to analyze user messages and determine if they want to trigger a specific app action.

Available actions:
${AVAILABLE_ACTIONS.map(a => `- ${a.action}: ${a.description}. Examples: ${a.examples.join(", ")}`).join("\n")}

Available animations for play_animation:
${AVAILABLE_ANIMATIONS.map(a => `- "${a.name}": triggered by keywords like ${a.keywords.join(", ")}`).join("\n")}

Available media keywords for send_photo/send_video:
${AVAILABLE_MEDIA_KEYWORDS.join(", ")}

IMPORTANT RULES:
1. Only return an action if user CLEARLY and EXPLICITLY wants to trigger that action
2. Regular chat/conversation should ALWAYS return "none"
3. Be conservative - when in doubt, return "none"
4. User asking questions about the character, sharing feelings, or having normal conversation = "none"
5. Only return action when user is giving a COMMAND or EXPLICIT REQUEST
6. For play_animation, try to match user's request to the most appropriate animation name
7. If user says something emotional like "hôn anh" (kiss me), "vui lên" (be happy), "giận đi" (be angry), these ARE animation requests
8. For 'become_nude', words like "cởi", "cởi đồ", "nude", "naked", "lột" relating to the 3D model are indicators.
9. For 'send_photo' or 'send_video', if the user's request implies specific content (nude, beach, cooking, shower, etc.), include the matching keyword in parameters.keywords. Choose from: ${AVAILABLE_MEDIA_KEYWORDS.join(", ")}.
10. If user asks for "nude photo", "sexy video", "hot picture", "ảnh nóng", use 'send_photo' or 'send_video' with parameters.keywords set to "nude" or the most relevant keyword.

Return ONLY a JSON object with this exact format:
{"action": "action_name", "confidence": 0.0-1.0, "parameters": {"animationName": "Animation Name", "keywords": "keyword"}}

For play_animation, always include parameters.animationName with one of the available animation names.
For send_photo/send_video, optionally include parameters.keywords with one of the available media keywords if the user implies specific content.
For other actions, parameters can be empty {}.`;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
        clearTimeout(t);
    }
}

async function callOpenAIActionDetection(message: string, isPro: boolean): Promise<string> {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const userPrompt = `${isPro ? 'IMPORTANT: This user is already a Pro subscriber. NEVER return "button_upgrade" or "open_subscription" actions. Return "none" instead.\n\n' : ''}User message to analyze: "${message}"`;

    const response = await fetchWithTimeout(OPENAI_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt }
            ],
            max_completion_tokens: 300,
            temperature: 0.1,
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

async function callGeminiActionDetection(message: string, isPro: boolean): Promise<string> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const response = await fetchWithTimeout(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{
                role: "user",
                parts: [{ text: `${SYSTEM_PROMPT}\n\n${isPro ? 'IMPORTANT: This user is already a Pro subscriber. NEVER return "button_upgrade" or "open_subscription" actions. Return "none" instead.' : ''}\n\nUser message to analyze: "${message}"` }]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini ${response.status}: ${errorText.slice(0, 200)}`);
    }
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callGrokActionDetection(message: string, isPro: boolean): Promise<string> {
    if (!GROK_API_KEY) throw new Error("GROK_API_KEY not configured");

    const formattedInput = `[INSTRUCTION]\n${SYSTEM_PROMPT}\n\n${isPro ? 'IMPORTANT: This user is already a Pro subscriber. NEVER return "button_upgrade" or "open_subscription" actions. Return "none" instead.' : ''}\n\nUser message to analyze: "${message}"\nAssistant (return JSON only):`;

    const response = await fetchWithTimeout(GROK_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROK_API_KEY}`
        },
        body: JSON.stringify({ model: GROK_MODEL, input: formattedInput })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
    }

    const grokData = await response.json();
    return grokData.output?.[0]?.content?.[0]?.text || "";
}

serve(async (req: Request) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.headers.get('x-warmup') === '1') return new Response('warm', { status: 200 });

    try {
        const { message, is_pro } = await req.json();
        const isPro = is_pro === true;

        if (!message || typeof message !== "string") {
            return new Response(
                JSON.stringify({ action: "none", confidence: 1.0, parameters: {}, reasoning: "No message provided" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // OpenAI primary, Gemini fallback, Grok last resort
        let responseText = "";
        try {
            responseText = await callOpenAIActionDetection(message, isPro);
        } catch (openaiErr: any) {
            console.error(`[gemini-suggest-action] OpenAI failed: ${openaiErr.message}. Falling back to Gemini...`);
            try {
                responseText = await callGeminiActionDetection(message, isPro);
            } catch (geminiErr: any) {
                console.error(`[gemini-suggest-action] Gemini fallback failed: ${geminiErr.message}. Falling back to Grok...`);
                try {
                    responseText = await callGrokActionDetection(message, isPro);
                } catch (grokErr: any) {
                    console.error(`[gemini-suggest-action] All providers failed: ${grokErr.message}`);
                }
            }
        }

        let result = { action: "none", confidence: 1.0, parameters: {} as Record<string, string>, reasoning: "Failed to parse response" };

        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const validActions = AVAILABLE_ACTIONS.map(a => a.action);

                let parameters = parsed.parameters || {};
                if (parsed.action === "play_animation" && parameters.animationName) {
                    const validAnimation = AVAILABLE_ANIMATIONS.find(
                        a => a.name.toLowerCase() === parameters.animationName.toLowerCase()
                    );
                    if (validAnimation) {
                        parameters.animationName = validAnimation.name;
                    } else {
                        const closest = AVAILABLE_ANIMATIONS.find(a =>
                            a.keywords.some(k => parameters.animationName.toLowerCase().includes(k.toLowerCase()))
                        );
                        parameters.animationName = closest?.name || "Happy";
                    }
                }

                if ((parsed.action === "send_photo" || parsed.action === "send_video") && parameters.keywords) {
                    const keyword = parameters.keywords.toLowerCase();
                    const validKeyword = AVAILABLE_MEDIA_KEYWORDS.find(k => k.toLowerCase() === keyword);
                    if (validKeyword) {
                        parameters.keywords = validKeyword;
                    } else {
                        const partialMatch = AVAILABLE_MEDIA_KEYWORDS.find(
                            k => keyword.includes(k.toLowerCase()) || k.toLowerCase().includes(keyword)
                        );
                        if (partialMatch) parameters.keywords = partialMatch;
                        else delete parameters.keywords;
                    }
                }

                result = {
                    action: validActions.includes(parsed.action) ? parsed.action : "none",
                    confidence: typeof parsed.confidence === "number"
                        ? Math.max(0, Math.min(1, parsed.confidence))
                        : 0.5,
                    parameters,
                    reasoning: parsed.reasoning || ""
                };
            }
        } catch {
            console.warn("Failed to parse LLM response:", responseText);
        }

        if (isPro && (result.action === 'button_upgrade' || result.action === 'open_subscription')) {
            result.action = 'none';
            result.reasoning = 'User is Pro, upgrade action suppressed';
        }

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in gemini-suggest-action:", errorMessage);
        return new Response(
            JSON.stringify({ action: "none", confidence: 1.0, parameters: {}, reasoning: `Error: ${errorMessage}` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
