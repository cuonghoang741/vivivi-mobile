import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = "7450216881:AAEfiWq4TGQ371gixL2oVKBepBH3BTAfDUA";
const TELEGRAM_CHAT_ID = "-1003509600397";
const TELEGRAM_MESSAGE_THREAD_ID = 686;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const TRANSLATE_MARKUP = { inline_keyboard: [[{ text: "🌐 Translate", callback_data: "translate" }]] };

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
        clearTimeout(t);
    }
}

function formatTimeAgo(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const s = Math.floor(diffMs / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
    const y = Math.floor(d / 365);
    return `${y} year${y === 1 ? "" : "s"} ago`;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok");
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

    try {
        const payload = await req.json().catch(() => null) || {};
        const { user_id, client_id, character_id, message, is_agent, created_at } = payload;

        if (!message) return new Response(JSON.stringify({ error: "Missing message" }), { status: 400 });

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const isAgentMessage = is_agent === true || is_agent === "true";

        const authHeaders = {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
        };

        // 1) Character name
        let characterName = "Unknown";
        if (character_id && SERVICE_KEY) {
            try {
                const r = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/characters?select=name&id=eq.${character_id}&limit=1`, { headers: authHeaders });
                if (r.ok) {
                    const rows = await r.json();
                    if (rows[0]?.name) characterName = rows[0].name;
                }
            } catch { }
        }

        // 2) For USER messages only: total count, tier, username, country, registered
        let totalMessages: number | null = null;
        let userTier: "pro" | "free" = "free";
        let username: string | null = null;
        let country: string | null = null;
        let registeredAgo: string | null = null;

        if (!isAgentMessage && (user_id || client_id) && SERVICE_KEY) {
            // Total user messages (count=exact)
            try {
                const filter = user_id ? `user_id=eq.${user_id}` : `client_id=eq.${client_id}`;
                const r = await fetchWithTimeout(
                    `${SUPABASE_URL}/rest/v1/conversation?${filter}&is_agent=eq.false&select=id`,
                    { headers: { ...authHeaders, "Prefer": "count=exact", "Range": "0-0" } }
                );
                if (r.ok) {
                    const cr = r.headers.get("content-range");
                    const match = cr?.match(/\/(\d+)$/);
                    if (match) totalMessages = parseInt(match[1], 10);
                }
            } catch { }

            // Tier
            if (user_id) {
                try {
                    const r = await fetchWithTimeout(
                        `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${user_id}&status=in.(active,trialing)&expires_at=gt.${new Date().toISOString()}&select=tier,plan&limit=1`,
                        { headers: authHeaders }
                    );
                    if (r.ok) {
                        const rows = await r.json();
                        if (rows && rows.length > 0) {
                            const tierField = (rows[0].tier || rows[0].plan || "").toString().toLowerCase();
                            if (tierField.includes("pro")) userTier = "pro";
                        }
                    }
                } catch { }
            }

            // Username / country / registered_at via RPC
            if (user_id) {
                try {
                    const r = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/get_user_info`, {
                        method: "POST",
                        headers: { ...authHeaders, "Content-Type": "application/json" },
                        body: JSON.stringify({ user_uuid: user_id }),
                    });
                    if (r.ok) {
                        const rows = await r.json();
                        const row = Array.isArray(rows) ? rows[0] : rows;
                        if (row) {
                            username = row.username || null;
                            country = row.country || null;
                            if (row.created_at) registeredAgo = formatTimeAgo(new Date(row.created_at));
                        }
                    }
                } catch { }
            }
        }

        const userIdentifier = user_id || client_id || "anonymous";
        const msgEscaped = escapeHtml(message);

        // One field per line for quick scanning.
        let text: string;
        if (isAgentMessage) {
            text =
                `🤖 <b>AI Reply</b>\n` +
                `<blockquote>${msgEscaped}</blockquote>\n` +
                `🎭 ${escapeHtml(characterName)}\n` +
                `🙋 <code>${escapeHtml(userIdentifier)}</code>`;
        } else {
            const lines: string[] = [
                `💬 <b>User Message</b>`,
                `<blockquote>${msgEscaped}</blockquote>`,
                `🎭 ${escapeHtml(characterName)}`,
            ];
            if (username) lines.push(`👤 <b>${escapeHtml(username)}</b>`);
            lines.push(`🆔 <code>${escapeHtml(userIdentifier)}</code>`);
            if (country) lines.push(`🌍 ${escapeHtml(country)}`);
            lines.push(userTier === "pro" ? `💎 <b>Pro</b>` : `🆓 Free`);
            if (totalMessages !== null) lines.push(`🔢 ${totalMessages} msgs`);
            if (registeredAgo) lines.push(`📅 ${registeredAgo}`);
            text = lines.join("\n");
        }

        // Telegram hard limit is 4096 chars. Protect against exceeding.
        if (text.length > 4000) text = text.slice(0, 3990) + "\n…";

        const tgRes = await fetchWithTimeout(`${TELEGRAM_API_BASE}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                message_thread_id: TELEGRAM_MESSAGE_THREAD_ID,
                text,
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: TRANSLATE_MARKUP,
            }),
        });

        if (!tgRes.ok) {
            const errText = await tgRes.text();
            console.error("Telegram API error", tgRes.status, errText);
            return new Response(JSON.stringify({ error: "Telegram send failed", status: tgRes.status, detail: errText }), { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (e: any) {
        console.error("user-message-telegram error", e);
        return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
    }
});
