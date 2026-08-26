import { ApiError, jsonError } from "@/lib/api";
import { loadChatTranscript, type ChatTranscript, type ChatTurn } from "@/lib/server/chat-storage";
import { requireUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

type GenerationRow = {
  id: string;
  uid: string;
  tool: string;
  provider: string;
  model: string;
  input_summary: Record<string, unknown> | null;
  output: string | null;
  created_at: string;
};

function legacyTranscript(row: GenerationRow): ChatTranscript {
  const summary = row.input_summary ?? {};
  const agenda = typeof summary.agenda === "string" ? summary.agenda : "";
  const output = row.output ?? "";
  const turns = Array.isArray(summary.turns)
    ? summary.turns.filter((turn): turn is ChatTurn => {
        if (!turn || typeof turn !== "object") return false;
        const item = turn as Record<string, unknown>;
        return (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string" && item.content.length <= 12000;
      })
    : [];

  return {
    id: row.id,
    uid: row.uid,
    tool: row.tool,
    provider: row.provider,
    model: row.model,
    inputSummary: summary,
    prompt: turns.find((turn) => turn.role === "user")?.content || agenda.split("\n\nTool focus:")[0] || agenda,
    output: turns.filter((turn) => turn.role === "assistant").at(-1)?.content || output,
    turns: turns.length > 0 ? turns : [
      ...(agenda ? [{ role: "user" as const, content: agenda.split("\n\nTool focus:")[0] || agenda }] : []),
      ...(output ? [{ role: "assistant" as const, content: output }] : []),
    ],
    createdAt: row.created_at,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;

    if (!id || id.length > 100 || !/^[a-zA-Z0-9-]+$/.test(id)) {
      throw new ApiError(400, "invalid_chat_id", "That chat could not be opened.");
    }

    const storedChat = await loadChatTranscript(user.uid, id);
    if (storedChat && storedChat.uid === user.uid) {
      return Response.json({ chat: storedChat });
    }

    const { data, error } = await supabaseAdmin()
      .from("ai_generations")
      .select("id, uid, tool, provider, model, input_summary, output, created_at")
      .eq("id", id)
      .eq("uid", user.uid)
      .maybeSingle();

    if (error || !data) {
      throw new ApiError(404, "chat_not_found", "That saved chat could not be found.");
    }

    const chat = legacyTranscript(data as GenerationRow);
    return Response.json({ chat });
  } catch (error) {
    return jsonError(error);
  }
}
