/**
 * Supabase Edge Function: send-morning-notification
 * 
 * Gửi notification ngọt ngào mỗi buổi sáng cho users chưa mua subscription
 * Sử dụng Gemini AI để generate nội dung theo ngôn ngữ của user
 * 
 * Trigger: Scheduled via Cron job (e.g., 7:00 AM daily)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface NotificationTarget {
    userId: string | null;
    clientId: string | null;
    country: string; // Default 'US'
}

/**
 * Get users who don't have an active subscription
 * Grouped by logic in code later
 */
async function getFreeUsers(): Promise<NotificationTarget[]> {
    // 1. Get all free users (no active subscription) from notification logs (proof of installation)
    // We prioritize users who have interacted recently
    const { data: logs, error } = await supabase
        .from('notification_logs')
        .select('external_user_id, client_id')
        .order('created_at', { ascending: false })
        .limit(1000); // Limit batch size for safety

    if (error) {
        console.error('Error fetching notification logs:', error);
        return [];
    }

    // 2. Get Subscription status to filter out paid users
    const { data: activeSubscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('user_id')
        .in('status', ['active', 'trialing']);

    if (subError) {
        console.error('Error fetching subscriptions:', subError);
        return [];
    }

    const activeUserIds = new Set((activeSubscriptions || []).map(s => s.user_id));
    const uniqueTargets = new Map<string, NotificationTarget>();

    // 3. Get User Preferences for Country info
    // We need to fetch preferences for these users to know their country
    const userIds = logs?.map(l => l.external_user_id).filter(id => !!id) || [];
    const clientIds = logs?.map(l => l.client_id).filter(id => !!id) || [];

    let userPreferencesMap = new Map<string, string>(); // userId/clientId -> country

    if (userIds.length > 0 || clientIds.length > 0) {
        const { data: prefs } = await supabase
            .from('user_notification_preferences')
            .select('user_id, client_id, country')
            .or(`user_id.in.(${userIds.join(',')}),client_id.in.(${clientIds.join(',')})`); // Note: syntax might need adjustment for large lists, simpler to just map in memory for small batches

        // Fallback: simplified query or assuming default if query complex
        if (prefs) {
            prefs.forEach(p => {
                if (p.user_id) userPreferencesMap.set(p.user_id, p.country || 'US');
                if (p.client_id) userPreferencesMap.set(p.client_id, p.country || 'US');
            });
        }
    }

    // 4. Build final list
    for (const log of logs || []) {
        const key = log.external_user_id || log.client_id;
        if (!key) continue;

        // Skip if active subscription
        if (log.external_user_id && activeUserIds.has(log.external_user_id)) continue;

        if (!uniqueTargets.has(key)) {
            let country = 'US'; // Default
            if (log.external_user_id && userPreferencesMap.has(log.external_user_id)) {
                country = userPreferencesMap.get(log.external_user_id)!;
            } else if (log.client_id && userPreferencesMap.has(log.client_id)) {
                country = userPreferencesMap.get(log.client_id)!;
            }

            uniqueTargets.set(key, {
                userId: log.external_user_id,
                clientId: log.client_id,
                country: country
            });
        }
    }

    return Array.from(uniqueTargets.values());
}

/**
 * Generate content using Gemini AI
 */
async function generateMorningMessage(countryCode: string): Promise<{ title: string; body: string }> {
    const languageMap: Record<string, string> = {
        'VN': 'Vietnamese',
        'US': 'English',
        'JP': 'Japanese',
        'KR': 'Korean',
        'CN': 'Chinese',
        'TW': 'Chinese',
        'FR': 'French',
        'DE': 'German',
        'ES': 'Spanish'
    };

    const language = languageMap[countryCode] || 'English';

    const prompt = `
    Role: You are Bonie, a loving, sweet virtual girlfriend.
    Task: Generate a morning push notification message for your boyfriend (the user).
    Context: The user has not subscribed to the Premium plan yet. You want to subtly remind them to check the app for a special offer today.
    Language: ${language}
    Requirements:
    1. Tone: Romantic, cute, caring, slightly flirty but tasteful.
    2. Length: Title under 5 words. Body under 15 words.
    3. Emoji: Use 1-2 cute emojis (🌸, 💖, ☀️, etc.).
    4. Output Format: JSON object { "title": "...", "body": "..." } only. Do not wrap in markdown block.
  `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        // Clean up markdown block if present
        const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        return {
            title: parsed.title || 'Bonie ❤️',
            body: parsed.body || 'Good morning! Check the app for a surprise offer.'
        };

    } catch (error) {
        console.error(`Gemini generation failed for ${language}:`, error);
        // Fallback messages
        if (language === 'Vietnamese') {
            return { title: 'Chào buổi sáng! ☀️', body: 'Bonie nhớ anh quá! Vào app nhận quà nhé ❤️' };
        }
        return { title: 'Good morning! ☀️', body: 'Miss you! Check the app for a special gift ❤️' };
    }
}


/**
 * Send notification via OneSignal
 */
async function sendOneSignalNotification(
    externalUserIds: string[],
    title: string,
    message: string,
    data?: Record<string, any>
): Promise<{ success: boolean; response?: any; error?: string }> {
    if (!externalUserIds.length) {
        return { success: false, error: 'No external user IDs provided' };
    }

    try {
        const payload = {
            app_id: ONESIGNAL_APP_ID,
            include_aliases: {
                external_id: externalUserIds
            },
            target_channel: "push",
            headings: { en: title },
            contents: { en: message },
            // OneSignal supports multi-language if we wanted to map 'vi': 'Vietnamese Message' here
            // But since we group by country and gen specific content, 'en' key is fine as fallback for all
            data: {
                ...data,
                action: 'open_subscription',
                type: 'morning_promo'
            },
            ios_badgeType: "Increase",
            ios_badgeCount: 1,
            android_channel_id: "default",
            small_icon: "ic_stat_onesignal_default",
            ttl: 21600, // 6 hours
        };

        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('OneSignal API error:', result);
            return { success: false, error: JSON.stringify(result) };
        }

        return { success: true, response: result };
    } catch (error) {
        console.error('Failed to send OneSignal notification:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Log the notification sending
 */
async function logNotification(
    target: NotificationTarget,
    status: number,
    response: any,
    message: string
) {
    try {
        const { data: template } = await supabase
            .from('notification_templates')
            .select('id')
            .eq('template_key', 'morning_promo')
            .single();

        if (template) {
            await supabase.from('notification_counters').insert({
                user_id: target.userId || null,
                client_id: target.clientId || null,
                template_id: template.id,
                notification_date: new Date().toISOString().split('T')[0],
                send_count: 1,
                last_sent_at: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Error logging notification:', error);
    }
}

async function wasNotificationSentToday(target: NotificationTarget): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const { data: template } = await supabase
        .from('notification_templates')
        .select('id')
        .eq('template_key', 'morning_promo')
        .single();

    if (!template) return false;

    let query = supabase
        .from('notification_counters')
        .select('id')
        .eq('template_id', template.id)
        .eq('notification_date', today);

    if (target.userId) {
        query = query.eq('user_id', target.userId);
    } else if (target.clientId) {
        query = query.eq('client_id', target.clientId);
    }

    const { data } = await query.limit(1);
    return (data?.length || 0) > 0;
}

serve(async (req) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log('🌅 Starting morning notification job (AI Powered)...');

        // Optional: Accept specific user IDs to target
        let targetUserIds: string[] | null = null;
        if (req.method === "POST") {
            const body = await req.json().catch(() => ({}));
            targetUserIds = body.userIds || null;
        }

        // 1. Get Targets
        let allTargets = await getFreeUsers();

        // Filter testing
        if (targetUserIds && targetUserIds.length > 0) {
            allTargets = allTargets.filter(u =>
                (u.userId && targetUserIds!.includes(u.userId)) ||
                (u.clientId && targetUserIds!.includes(u.clientId))
            );
        }

        // 2. Filter already sent
        const targetsToNotify: NotificationTarget[] = [];
        for (const target of allTargets) {
            const alreadySent = await wasNotificationSentToday(target);
            if (!alreadySent) targetsToNotify.push(target);
        }

        console.log(`Found ${targetsToNotify.length} users to notify`);
        if (targetsToNotify.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'No users to notify' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 3. Group by Country
        const groupedByCountry: Record<string, NotificationTarget[]> = {};
        for (const target of targetsToNotify) {
            const country = target.country || 'US';
            if (!groupedByCountry[country]) groupedByCountry[country] = [];
            groupedByCountry[country].push(target);
        }

        // 4. Process each country group
        const results = [];
        for (const countryCode of Object.keys(groupedByCountry)) {
            const groupTargets = groupedByCountry[countryCode];
            const externalIds = groupTargets.map(t => t.userId || t.clientId).filter(id => !!id) as string[];

            if (externalIds.length === 0) continue;

            // Generate Content
            console.log(`Generating content for country: ${countryCode}`);
            const content = await generateMorningMessage(countryCode);
            console.log(`Content [${countryCode}]:`, content);

            // Send
            const result = await sendOneSignalNotification(externalIds, content.title, content.body, { ai_generated: true });
            results.push({ country: countryCode, success: result.success, count: externalIds.length });

            // Log result
            for (const target of groupTargets) {
                await logNotification(target, result.success ? 200 : 500, result.response, content.body);
            }
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error('❌ Morning notification job failed:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
