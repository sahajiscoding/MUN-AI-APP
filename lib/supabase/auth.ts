import { createClient } from "@/lib/supabase/server";

export type VerifiedUser = {
  uid: string;
  email?: string;
  name?: string;
};

export async function requireUser(request: Request): Promise<VerifiedUser> {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, "invalid_token", "Your session could not be verified.");
  }

  return {
    uid: user.id,
    email: user.email,
    name: user.user_metadata?.full_name,
  };
}

class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
