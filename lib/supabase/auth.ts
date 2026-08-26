import { ApiError } from "@/lib/api";
import { createClient, supabaseAdmin } from "@/lib/supabase/server";

export type VerifiedUser = {
  uid: string;
  email?: string;
  name?: string;
};

export async function requireUser(request: Request): Promise<VerifiedUser> {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const supabase = bearerToken ? supabaseAdmin() : await createClient();

  const {
    data: { user },
    error,
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, "invalid_token", "Your session could not be verified.");
  }

  return {
    uid: user.id,
    email: user.email,
    name: user.user_metadata?.full_name,
  };
}
