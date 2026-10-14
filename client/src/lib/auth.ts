import { createContext, useContext } from "react";
import type { ApiUser } from "@red-link/shared/api";

export interface AuthValue {
  /** undefined while loading, null when logged out. */
  user: ApiUser | null | undefined;
  /** True right after the user pressed "Log out", so guards go to a plain /login (no ?next=). */
  loggedOut: boolean;
  reload: () => Promise<ApiUser | null>;
  logout: () => Promise<void>;
}

/** Provided by <AuthProvider>. */
export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The logged-in user inside role pages (guarded by RequireRole, so never null there). */
export function useUser(): ApiUser {
  const { user } = useAuth();
  if (!user) throw new Error("useUser() called outside a guarded route");
  return user;
}
