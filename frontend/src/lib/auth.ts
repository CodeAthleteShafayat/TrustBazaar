import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  email: string;
  display_name?: string;
  trust_score?: number | null;
  trust_tier?: string;
  avatar_url?: string | null;
  joined_at?: string;
  is_admin?: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  // zustand's persist middleware hydrates from localStorage asynchronously (a microtask),
  // so `token` reads as null for a brief moment on every hard page load/refresh even when
  // a valid session exists. Route guards must wait for hasHydrated before trusting `token`,
  // otherwise they redirect to /login on every refresh of a protected page.
  hasHydrated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser | null) => void;
  clear: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "trustbazaar-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);