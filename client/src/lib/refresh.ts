import { createContext, useContext } from "react";

/**
 * A global "refresh" signal: calling refresh() makes every mounted useApi() query (and the
 * current user) load again. Used after actions and when new notifications arrive, so feeds
 * and lists stay current without a page reload. Provided by <RefreshProvider>.
 */
export const RefreshContext = createContext<{ key: number; refresh: () => void }>({ key: 0, refresh: () => {} });

export const useRefreshKey = () => useContext(RefreshContext).key;
export const useRefresh = () => useContext(RefreshContext).refresh;
