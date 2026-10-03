import { requireUser as supabaseRequireUser, type VerifiedUser } from "@/lib/supabase/auth";

export type { VerifiedUser };

/** Verify the request user via Supabase auth for server-side routes. */
export async function requireUser(request: Request): Promise<VerifiedUser> {
  return supabaseRequireUser(request);
}
