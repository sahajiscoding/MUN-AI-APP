import { requireUser as supabaseRequireUser, type VerifiedUser } from "@/lib/supabase/auth";

export type { VerifiedUser };

export async function requireUser(request: Request): Promise<VerifiedUser> {
  return supabaseRequireUser(request);
}
