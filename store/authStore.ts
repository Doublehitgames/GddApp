"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { getPublicSiteUrl } from "@/lib/supabase/env";
import type { User, Session } from "@supabase/supabase-js";

const AUTH_INIT_TIMEOUT_MS = 4000;

type TimeoutResult<T> =
  | { timedOut: true; value: null }
  | { timedOut: false; value: T };

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<TimeoutResult<T>> {
  const timeoutPromise = new Promise<TimeoutResult<T>>((resolve) => {
    setTimeout(() => resolve({ timedOut: true, value: null }), timeoutMs);
  });

  const wrapped = Promise.resolve(promise)
    .then((value) => ({ timedOut: false as const, value }))
    .catch(() => ({ timedOut: true as const, value: null }));

  return Promise.race([wrapped, timeoutPromise]);
}

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthStore {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;

  // Actions
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,

  initialize: async () => {
    const supabase = createClient();
    try {
      const sessionResult = await withTimeout(supabase.auth.getSession(), AUTH_INIT_TIMEOUT_MS);
      const session = !sessionResult.timedOut ? sessionResult.value.data.session : null;
      let user = session?.user ?? null;

      if (!user) {
        const userResult = await withTimeout(supabase.auth.getUser(), AUTH_INIT_TIMEOUT_MS);
        if (!userResult.timedOut) {
          user = userResult.value.data.user ?? null;
        }
      }

      if (user) {
        const profileResult = await withTimeout(
          supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single(),
          AUTH_INIT_TIMEOUT_MS
        );

        const profile = !profileResult.timedOut ? profileResult.value.data : null;
        set({ user, session: session ?? null, profile, loading: false });
      } else {
        set({ user: null, session: null, profile: null, loading: false });
      }
    } catch {
      set({ user: null, session: null, profile: null, loading: false });
    }

    // Escutar mudanças de auth
    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      if (user) {
        try {
          const profileResult = await withTimeout(
            supabase
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .single(),
            AUTH_INIT_TIMEOUT_MS
          );
          const profile = !profileResult.timedOut ? profileResult.value.data : null;
          set({ user, session, profile });
        } catch {
          set({ user, session, profile: null });
        }
      } else {
        set({ user: null, session: null, profile: null });
      }
    });
  },

  signInWithEmail: async (email, password) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  },

  signUpWithEmail: async (email, password, displayName) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] },
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  signInWithGoogle: async () => {
    const supabase = createClient();
    const siteUrl = getPublicSiteUrl();
    const shouldUseConfiguredSiteUrl = Boolean(siteUrl && !siteUrl.includes("localhost"));
    const baseUrl = shouldUseConfiguredSiteUrl ? siteUrl! : window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${baseUrl}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },

  updateProfile: async (data) => {
    const supabase = createClient();
    const { user } = get();
    if (!user) return { error: "Não autenticado" };

    const { error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", user.id);

    if (error) return { error: error.message };

    set((state) => ({
      profile: state.profile ? { ...state.profile, ...data } : null,
    }));
    return { error: null };
  },
}));
