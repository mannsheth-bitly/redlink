import { useEffect } from "react";

/** Sets the browser tab title, e.g. "Log in · Red Link". */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Red Link`;
  }, [title]);
}
