import { ApiError, jsonError } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") || "50");
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
      : 50;

    const { data, error } = await supabaseAdmin()
      .from("ai_generations")
      .select("id, tool, input_summary, created_at")
      .eq("uid", user.uid)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new ApiError(500, "chat_history_unavailable", "Could not load your saved chats.");
    }

    return Response.json({ chats: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}
