import { createServerClient } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getRequiredEnv(
  name: string
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value;
}

// Cookie-based client for reading
// authenticated user sessions.
export async function createClient() {
  const cookieStore =
    await cookies();

  const supabaseUrl =
    getRequiredEnv(
      "NEXT_PUBLIC_SUPABASE_URL"
    );

  const supabasePublishableKey =
    getRequiredEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );

  return createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(
          cookiesToSet
        ) {
          try {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch {
            // Server Components cannot
            // always modify cookies.
          }
        },
      },
    }
  );
}

// Trusted server-side Supabase client.
//
// IMPORTANT:
// This key must NEVER be exposed to
// browser/client code.
function getSupabaseAdmin() {
  const url =
    getRequiredEnv(
      "NEXT_PUBLIC_SUPABASE_URL"
    );

  const serviceKey =
    getRequiredEnv(
      "SUPABASE_SECRET_KEY"
    );

  return createSupabaseClient(
    url,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

let adminClient:
  | ReturnType<
      typeof getSupabaseAdmin
    >
  | null = null;

export function supabaseAdmin() {
  if (!adminClient) {
    adminClient =
      getSupabaseAdmin();
  }

  return adminClient;
}
