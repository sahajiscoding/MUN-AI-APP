import { supabaseAdmin } from "@/lib/supabase/server";

const CHAT_BUCKET = "chat-history";

export type ChatTranscript = {
  id: string;
  uid: string;
  tool: string;
  provider: string;
  model: string;
  inputSummary: Record<string, unknown>;
  prompt: string;
  output: string;
  createdAt: string;
};

function chatPath(uid: string, chatId: string) {
  return `${uid}/${chatId}.json`;
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
    createdAt: item.createdAt,
  };
}

async function ensureChatBucket() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.storage.getBucket(CHAT_BUCKET);
  if (data) return true;

  const { error: createError } = await supabase.storage.createBucket(CHAT_BUCKET, {
    public: false,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ["application/json"],
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    console.warn("Could not provision the private chat-history bucket.", (error || createError).message);
    return false;
  }

  return true;
}

export async function saveChatTranscript(transcript: ChatTranscript) {
  if (!(await ensureChatBucket())) return false;

  const supabase = supabaseAdmin();
  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(
      chatPath(transcript.uid, transcript.id),
      JSON.stringify(transcript),
      {
        contentType: "application/json; charset=utf-8",
        upsert: true,
      }
    );

  if (error) {
    console.warn("Could not save chat transcript to Supabase Storage.", error.message);
    return false;
  }

  return true;
}

export async function loadChatTranscript(uid: string, chatId: string) {
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
