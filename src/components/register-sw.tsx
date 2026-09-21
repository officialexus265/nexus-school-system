import { useEffect } from "react";

/** Register service worker once in the browser. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Avoid noisy errors on vite dev HMR; still try so offline works in preview/prod
    void navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[nexus] SW register failed", err);
    });
  }, []);
  return null;
}
