import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// Available animations in the app (from fbxFiles)
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

// Available actions in the app
const AVAILABLE_ACTIONS = [
    {
        action: "send_photo",
        description: "User wants the character to send them a photo, picture, image, selfie",
        examples: ["gửi ảnh đi", "cho anh xem ảnh", "send a photo", "send a picture", "show me a photo", "gửi hình đi", "selfie đi"]
    },
    {
        action: "send_video",
        description: "User wants the character to send them a video",
        examples: ["gửi video đi", "send a video", "show me a video", "quay video đi", "gửi clip đi"]
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
        action: "change_character",
        description: "User wants to switch to a different character entirely",
        examples: ["đổi nhân vật khác", "I want to talk to someone else", "switch character"]
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
        examples: ["video call", "gọi video đi", "muốn nhìn thấy mặt em"]
    },
    {
        action: "open_subscription",
        description: "User mentions premium features, subscription, upgrade, pro, or wants to unlock something",
        examples: ["nâng cấp pro", "upgrade", "mua gói premium", "unlock features"]
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

IMPORTANT RULES:
1. Only return an action if user CLEARLY and EXPLICITLY wants to trigger that action
2. Regular chat/conversation should ALWAYS return "none"
3. Be conservative - when in doubt, return "none"
4. User asking questions about the character, sharing feelings, or having normal conversation = "none"
5. Only return action when user is giving a COMMAND or EXPLICIT REQUEST
6. For play_animation, try to match user's request to the most appropriate animation name
7. If user says something emotional like "hôn anh" (kiss me), "vui lên" (be happy), "giận đi" (be angry), these ARE animation requests

Return ONLY a JSON object with this exact format:
{"action": "action_name", "confidence": 0.0-1.0, "parameters": {"animationName": "Animation Name"}, "reasoning": "brief explanation"}

For play_animation, always include parameters.animationName with one of the available animation names.
For other actions, parameters can be empty {}.`;

serve(async (req: Request) => {
    // CORS headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (!GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY not configured");
        }

        const { message } = await req.json();

        if (!message || typeof message !== "string") {
            return new Response(
                JSON.stringify({ action: "none", confidence: 1.0, parameters: {}, reasoning: "No message provided" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Call Gemini API
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: `${SYSTEM_PROMPT}\n\nUser message to analyze: "${message}"` }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1, // Low temperature for consistent classification
                        maxOutputTokens: 300,
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API error:", errorText);
            throw new Error(`Gemini API error: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Parse the JSON response from Gemini
        let result = { action: "none", confidence: 1.0, parameters: {}, reasoning: "Failed to parse response" };

        try {
            // Extract JSON from the response (handle markdown code blocks)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const validActions = AVAILABLE_ACTIONS.map(a => a.action);

                // Validate animation name if present
                let parameters = parsed.parameters || {};
                if (parsed.action === "play_animation" && parameters.animationName) {
                    const validAnimation = AVAILABLE_ANIMATIONS.find(
                        a => a.name.toLowerCase() === parameters.animationName.toLowerCase()
                    );
                    if (validAnimation) {
                        parameters.animationName = validAnimation.name; // Normalize case
                    } else {
                        // Try to find closest match
                        const closest = AVAILABLE_ANIMATIONS.find(a =>
                            a.keywords.some(k => parameters.animationName.toLowerCase().includes(k.toLowerCase()))
                        );
                        parameters.animationName = closest?.name || "Happy"; // Default to Happy
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
        } catch (parseError) {
            console.warn("Failed to parse Gemini response:", responseText);
        }

        console.log(`[gemini-suggest-action] Message: "${message.substring(0, 50)}..." => ${result.action} (${result.confidence})`, result.parameters);

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in gemini-suggest-action:", errorMessage);
        return new Response(
            JSON.stringify({
                action: "none",
                confidence: 1.0,
                parameters: {},
                reasoning: `Error: ${errorMessage}`
            }),
            {
                status: 200, // Return 200 with none action instead of error
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
