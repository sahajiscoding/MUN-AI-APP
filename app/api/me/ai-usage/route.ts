import { jsonError } from "@/lib/api";
import { getDailyAiUsage } from "@/lib/server/ai-usage";
import { requireUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const usage = await getDailyAiUsage(user.uid);
    return Response.json(usage, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}
