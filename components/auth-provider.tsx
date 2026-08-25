"use client";

import { User as SupaUser } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";

type AuthContextValue = {
  user: SupaUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupaUser | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUserRecord = useCallback(async (supaUser: SupaUser) => {
    try {
      const { error } = await supabase.from("users").upsert(
        {
          uid: supaUser.id,
          display_name: supaUser.user_metadata?.full_name ?? supaUser.user_metadata?.name ?? "",
          email: supaUser.email ?? "",
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "uid" }
      );
      if (error) {
        console.warn("Could not sync Supabase user profile yet.", error.message);
      }
    } catch (err) {
      console.warn("Could not sync Supabase user profile yet.", err);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        syncUserRecord(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        syncUserRecord(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncUserRecord]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
      },
      async signInWithEmail(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUpWithEmail(name, email, password) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        });
        if (error) throw error;
      },
      async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      async getIdToken() {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          throw new Error("You need to sign in again.");
        }
        return token;
      },
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
