import { ApiError, jsonError } from "@/lib/api";
import { AI_DAILY_TOKEN_LIMIT } from "@/lib/server/ai-usage";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const admin = supabaseAdmin();
    const [{ data: users, error: userError }, { data: usage, error: usageError }] = await Promise.all([
      admin.from("users").select("uid, display_name, email, last_seen_at").order("last_seen_at", { ascending: false }).limit(100),
      admin.from("ai_usage_daily").select("uid, usage_date, tokens_used, reserved_tokens, updated_at").eq("usage_date", today).order("tokens_used", { ascending: false }).limit(100),
    ]);

    if (userError || usageError) {
      console.error("AI usage dashboard query failed:", userError?.message || usageError?.message);
      throw new ApiError(500, "ai_usage_dashboard_unavailable", "Could not load AI usage data.");
    }

    const usageByUid = new Map((usage ?? []).map((row) => [row.uid, row]));
    const rows = (users ?? []).map((user) => {
      const row = usageByUid.get(user.uid);
      const used = Number(row?.tokens_used ?? 0);
      const reserved = Number(row?.reserved_tokens ?? 0);
      return {
        uid: user.uid,
        displayName: user.display_name || "Delegate",
        email: user.email || "",
        lastActivity: row?.updated_at ?? user.last_seen_at ?? null,
        used: Number.isSafeInteger(used) && used >= 0 ? used : 0,
        remaining: Math.max(AI_DAILY_TOKEN_LIMIT - (Number.isSafeInteger(used) ? used : 0) - (Number.isSafeInteger(reserved) ? reserved : 0), 0),
      };
    });

    return Response.json({ date: today, limit: AI_DAILY_TOKEN_LIMIT, users: rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
