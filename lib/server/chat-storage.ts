import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";

const CHAT_BUCKET = "chat-history";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatTranscript = {
  id: string;
  uid: string;
  tool: string;
  provider: string;
  model: string;
  inputSummary: Record<string, unknown>;
  prompt: string;
  output: string;
  turns: ChatTurn[];
  createdAt: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function chatPath(uid: string, chatId: string) {
  return `${uid}/${chatId}.json`;
}

function normalizeTurns(value: unknown, prompt: string, output: string): ChatTurn[] {
  if (Array.isArray(value)) {
    const turns = value.filter((turn): turn is ChatTurn => {
      if (!turn || typeof turn !== "object") return false;
      const item = turn as Record<string, unknown>;
      return (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" && item.content.length <= 12000;
    });
    if (turns.length > 0) return turns;
  }

  return [
    ...(prompt ? [{ role: "user" as const, content: prompt }] : []),
    ...(output ? [{ role: "assistant" as const, content: output }] : []),
  ];
}

function toTranscript(value: unknown): ChatTranscript | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.uid !== "string" ||
    typeof item.tool !== "string" ||
    typeof item.provider !== "string" ||
    typeof item.model !== "string" ||
    typeof item.prompt !== "string" ||
    typeof item.output !== "string" ||
    typeof item.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: item.id,
    uid: item.uid,
    tool: item.tool,
    provider: item.provider,
    model: item.model,
    inputSummary:
      item.inputSummary && typeof item.inputSummary === "object"
        ? (item.inputSummary as Record<string, unknown>)
        : {},
    prompt: item.prompt,
    output: item.output,
    turns: normalizeTurns(item.turns, item.prompt, item.output),
    createdAt: item.createdAt,
  };
}

async function ensureChatBucket() {
  const { data, error } = await supabaseAdmin().storage.getBucket(CHAT_BUCKET);
  if (data && data.public === false) return true;

  logger.error(
    "Chat-history Storage is unavailable or not private. Apply the Supabase migration before serving chat history.",
    error?.message || "bucket configuration mismatch"
  );
  return false;
}

export async function saveChatTranscript(transcript: ChatTranscript) {
  if (!UUID_PATTERN.test(transcript.uid) || !UUID_PATTERN.test(transcript.id)) return false;
  if (!(await ensureChatBucket())) return false;

  const supabase = supabaseAdmin();
  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(
      chatPath(transcript.uid, transcript.id),
      JSON.stringify(transcript),
      {
        // The private bucket allow-list is application/json. Keep the upload
        // MIME type exact so Supabase Storage accepts the transcript.
        contentType: "application/json",
        upsert: true,
      }
    );

  if (error) {
    logger.warn("Could not save chat transcript to Supabase Storage.", error.message);
    return false;
  }

  return true;
}

export async function loadChatTranscript(uid: string, chatId: string) {
  if (!UUID_PATTERN.test(uid) || !UUID_PATTERN.test(chatId)) return null;

  const { data, error } = await supabaseAdmin().storage
    .from(CHAT_BUCKET)
    .download(chatPath(uid, chatId));

  if (error || !data) return null;

  try {
    return toTranscript(JSON.parse(await data.text()));
  } catch {
    return null;
  }
}

function transcriptToChatSummary(transcript: ChatTranscript) {
  const { turns: _turns, ...summary } = transcript.inputSummary;
  return {
    id: transcript.id,
    tool: transcript.tool,
    input_summary: summary,
    created_at: transcript.createdAt,
  };
}

/**
 * Lists transcripts stored under one user's private Storage prefix.
 * Returns null when Storage itself is unavailable so callers can distinguish
 * an empty history from an infrastructure failure.
 */
export async function listChatTranscripts(uid: string, limit: number) {
  if (!UUID_PATTERN.test(uid) || !(await ensureChatBucket())) return null;

  const supabase = supabaseAdmin();
  const { data: files, error } = await supabase.storage
    .from(CHAT_BUCKET)
    .list(uid, {
      limit: Math.min(Math.max(limit * 2, limit), 100),
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) {
    logger.warn("Could not list chat transcripts from Supabase Storage.", error.message);
    return null;
  }

  const chatIds = (files ?? [])
    .map((file) => file.name.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/i)?.[1])
    .filter((id): id is string => Boolean(id));

  const transcripts = await Promise.all(
    chatIds.map((chatId) => loadChatTranscript(uid, chatId))
  );

  return transcripts
    .filter((transcript): transcript is ChatTranscript => Boolean(transcript))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map(transcriptToChatSummary);
}
