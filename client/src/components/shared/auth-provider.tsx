import { useCallback, useEffect, useState } from "react";
import type { ApiUser } from "@red-link/shared/api";
import { api, ApiError } from "@/lib/api";
import { AuthContext } from "@/lib/auth";
import { useRefreshKey } from "@/lib/refresh";

/**
 * GET /api/auth/me. Returns the user, null when logged out, or "keep" on a network error so
 * the app doesn't log you out while offline.
 */
async function fetchMe(): Promise<ApiUser | null | "keep"> {
  try {
    return (await api<{ user: ApiUser | null }>("/api/auth/me")).user;
  } catch (e) {
    return e instanceof ApiError && e.status === 401 ? null : "keep";
  }
}

/** Holds the logged-in user. Reloaded on refresh() so admin decisions apply straight away. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null | undefined>(undefined);
  const [loggedOut, setLoggedOut] = useState(false);
  const refreshKey = useRefreshKey();

  const apply = useCallback((me: ApiUser | null | "keep") => {
    if (me === "keep") {
      setUser((u) => (u === undefined ? null : u));
      return null;
    }
    setUser(me);
    if (me) setLoggedOut(false);
    return me;
  }, []);

  const reload = useCallback(async () => apply(await fetchMe()), [apply]);

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((me) => {
      if (!cancelled) apply(me);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, refreshKey]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setLoggedOut(true);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loggedOut, reload, logout }}>{children}</AuthContext.Provider>;
}
