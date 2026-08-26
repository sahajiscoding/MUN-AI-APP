import { ApiError, jsonError } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { listChatTranscripts } from "@/lib/server/chat-storage";
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

    const databaseChats = (data ?? []).map((chat) => {
      const summary = (chat.input_summary ?? {}) as Record<string, unknown>;
      const { turns: _turns, ...lightSummary } = summary;
      return { ...chat, input_summary: lightSummary };
    });
    const storageChats =
      error || databaseChats.length < limit
        ? await listChatTranscripts(user.uid, limit)
        : null;

    if (storageChats) {
      const merged = new Map(
        databaseChats.map((chat) => [chat.id, chat])
      );
      for (const chat of storageChats) {
        if (!merged.has(chat.id)) merged.set(chat.id, chat);
      }

      return Response.json({
        chats: [...merged.values()]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, limit),
        source: error ? "storage" : "merged",
      });
    }

    if (error) {
      throw new ApiError(500, "chat_history_unavailable", "Could not load your saved chats.");
    }

    return Response.json({ chats: databaseChats, source: "database" });
  } catch (error) {
    return jsonError(error);
  }
}
