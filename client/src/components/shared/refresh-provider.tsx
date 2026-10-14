import { useCallback, useState } from "react";
import { RefreshContext } from "@/lib/refresh";

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState(0);
  const refresh = useCallback(() => setKey((k) => k + 1), []);
  return <RefreshContext.Provider value={{ key, refresh }}>{children}</RefreshContext.Provider>;
}
