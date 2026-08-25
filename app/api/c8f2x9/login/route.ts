import { jsonError, parseJson } from "@/lib/api";
import { adminLogin, setAdminSession, clearAdminSession } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await parseJson<{ password: string }>(request);
    const session = await adminLogin(body.password);
    await setAdminSession(session);

    return Response.json({ ok: true, admin: { email: session.email } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  await clearAdminSession();
  return Response.json({ ok: true });
}
