import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type VerifiedUser = {
  uid: string;
  email?: string;
  name?: string;
};

const JWKS_URL = process.env.SUPABASE_JWKS_URL;

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!JWKS_URL) {
    throw new Error("SUPABASE_JWKS_URL is not configured.");
  }
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return _jwks;
}

export async function verifySupabaseToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: "supabase",
  });
  return payload;
}

export async function requireUser(request: Request): Promise<VerifiedUser> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "missing_token", "Sign in again before continuing.");
  }

  const token = authorization.slice("Bearer ".length);

  try {
    const payload = await verifySupabaseToken(token);
    return {
      uid: payload.sub!,
      email: payload.email as string | undefined,
      name: (payload.user_metadata as Record<string, unknown>)?.full_name as string | undefined,
    };
  } catch {
    throw new ApiError(401, "invalid_token", "Your session could not be verified.");
  }
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
