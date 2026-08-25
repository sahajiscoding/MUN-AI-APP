import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { getEntitlement } from "@/lib/server/entitlements";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const entitlement = await getEntitlement(user.uid);

    return Response.json({ entitlement });
  } catch (error) {
    return jsonError(error);
  }
}
