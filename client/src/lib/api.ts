import { useCallback, useEffect, useState } from "react";
import { useRefreshKey } from "@/lib/refresh";

/** An error response from the Express API (`{ error }` with a status code). */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** fetch() wrapper for /api: JSON in and out, cookies included, errors thrown as ApiError. */
export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status}).`);
  return data as T;
}

export interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Loads `path` (or nothing when null) and reloads it whenever the global refresh signal
 * fires. Previous data stays visible while reloading, so lists don't flash. A response that
 * arrives after a newer request has started is ignored.
 */
export function useApi<T>(path: string | null): ApiState<T> {
  const refreshKey = useRefreshKey();
  const [retries, setRetries] = useState(0);
  // Identifies the current request; `loading` is true until a response for it arrives.
  const requestKey = path === null ? null : `${path}#${refreshKey}#${retries}`;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: ApiError | null }>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (path === null) return;
    let current = true;
    api<T>(path).then(
      (data) => current && setState({ key: requestKey, data, error: null }),
      (e: unknown) =>
        current &&
        setState((s) => ({ key: requestKey, data: s.data, error: e instanceof ApiError ? e : new ApiError(0, "Something went wrong.") })),
    );
    return () => {
      current = false;
    };
  }, [path, requestKey]);

  const reload = useCallback(async () => setRetries((n) => n + 1), []);
  return { data: state.data, error: state.error, loading: requestKey !== null && state.key !== requestKey, reload };
}
