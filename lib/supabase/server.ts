import { createServerClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Read a required environment variable, throwing when it is missing. */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

/** Create a Supabase server client bound to the current request cookies. */
export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabasePublishableKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // Keep the cookie options supplied by @supabase/ssr intact.
          // In particular, do not force HttpOnly here: the browser Supabase
          // client must be able to read/update the auth session cookie.
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always modify cookies.
        }
      },
    },
  });
}

// Backend-only Supabase secret key. This is intentionally never imported by
// client components. Use separate Supabase secret keys per backend component
// where the project supports them, rather than sharing one credential across
// unrelated services.
/** Build a backend-only Supabase client using the secret service key. */
function getSupabaseAdmin() {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = getRequiredEnv("SUPABASE_SECRET_KEY");

  return createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

let adminClient: ReturnType<typeof getSupabaseAdmin> | null = null;

/** Return the shared backend Supabase admin client, creating it on first use. */
export function supabaseAdmin() {
  if (!adminClient) adminClient = getSupabaseAdmin();
  return adminClient;
}
