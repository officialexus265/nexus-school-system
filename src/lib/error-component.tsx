import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert, WifiOff } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

function isOfflineChunkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("loading chunk") ||
    m.includes("loading css chunk") ||
    m.includes("importing a module script failed")
  );
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message = errorMessage(error);
  const offline =
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    isOfflineChunkError(message);

  if (offline) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center text-zinc-50">
        <span className="text-amber-400" aria-hidden="true">
          <WifiOff className="size-10" strokeWidth={2} />
        </span>
        <h1 className="text-lg font-semibold">You are offline</h1>
        <p className="max-w-md text-sm text-zinc-400">
          This screen was not fully cached yet (or the app was updated). Connect to the internet,
          open NEXUS once while online, then offline mode can reuse the saved files.
        </p>
        <p className="max-w-md text-xs text-zinc-500">
          Sign-in always needs a connection. After you have used the app online, refresh offline may
          work for pages you already opened.
        </p>
        <a
          href="/"
          className="mt-2 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
        >
          Retry
        </a>
      </main>
    );
  }

  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">{message}</p>
      <a
        href="/"
        className="mt-2 text-sm underline-offset-4 hover:underline dark:text-zinc-300"
      >
        Go home
      </a>
    </main>
  );
}
