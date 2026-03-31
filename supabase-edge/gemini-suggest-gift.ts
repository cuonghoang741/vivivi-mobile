import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const SYSTEM_PROMPT = `You are an AI assistant analyzing a conversation between a virtual companion and a user.
Your task is to determine if the virtual companion should request a "gift" (a premium photo/video) from the user at this exact moment in the conversation.

Rules for suggesting a gift:
1. The conversation should have reached an emotional or romantic peak, or the user is heavily flirting, asking for something special, nude, or hot.
2. Sometime just suggest send gift.
3. If the user is just saying hello, asking basic questions, or the conversation is casual, do NOT suggest a gift.
4. Do NOT suggest a gift too frequently. Only when the context strongly justifies teasing the user with premium locked content.

Analyze the last 10 messages of the conversation.
Return ONLY a JSON object with this format:
{"suggestGift": true|false, "message": "A naughty, teasing message asking the user for a gift to unlock a special picture/video. Match the language and tone of the conversation! Make it sound natural and seductive."}
`;

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5, initialDelayMs = 1000): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.ok || (response.status >= 400 && response.status < 500)) return response;
            lastError = new Error(`Gemini API error: ${response.status} - ${await response.text()}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, initialDelayMs * Math.pow(2, attempt - 1)));
        }
    }
    throw lastError || new Error('All retry attempts failed');
}

serve(async (req: Request) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

        const { conversation } = await req.json();

        if (!conversation || !Array.isArray(conversation)) {
            return new Response(
                JSON.stringify({ suggestGift: false, message: "", reasoning: "No conversation provided" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const formattedConversation = conversation.map((msg: any) =>
            `[${msg.isAgent ? 'Companion' : 'User'}]: ${msg.kind?.text || ''}`
        ).join("\n");

        const geminiResponse = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: `${SYSTEM_PROMPT}\n\nConversation (last 10 messages):\n${formattedConversation}` }]
                    }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 150 }
                })
            }
        );

        if (!geminiResponse.ok) throw new Error(`Gemini API error: ${geminiResponse.status}`);
        const geminiData = await geminiResponse.json();
        const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        let result = { suggestGift: false, message: "" };
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.warn("Failed to parse Gemini response:", responseText);
        }

        console.log(`[gemini-suggest-gift] Result: ${result.suggestGift} - ${result.message}`);

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error: unknown) {
        return new Response(
            JSON.stringify({ suggestGift: false, message: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
