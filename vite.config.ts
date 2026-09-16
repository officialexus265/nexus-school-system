import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Warm PGLite after the dev server is listening.
 * Avoids calling ssrLoadModule during configureServer (Vite environments
 * may not mark SSR as runnable that early).
 * First request still boots the DB via ensureDbReady() if this fails.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app:pglite-bootstrap",
    apply: "serve",
    configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;

      const warm = async () => {
        try {
          // Prefer environments API when present (Vite 6+)
          const envs = (
            server as unknown as {
              environments?: Record<
                string,
                { runner?: { import: (id: string) => Promise<unknown> } }
              >;
            }
          ).environments;

          let mod: { ensureDbReady?: () => Promise<void> } | undefined;

          if (envs?.ssr?.runner?.import) {
            mod = (await envs.ssr.runner.import("/src/lib/db.ts")) as {
              ensureDbReady?: () => Promise<void>;
            };
          } else if (typeof server.ssrLoadModule === "function") {
            try {
              mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
                ensureDbReady?: () => Promise<void>;
              };
            } catch (err) {
              console.warn(
                "[app] Early DB warm skipped (SSR not ready yet). DB will init on first request.",
                err instanceof Error ? err.message : err,
              );
              return;
            }
          } else {
            return;
          }

          if (typeof mod?.ensureDbReady === "function") {
            await mod.ensureDbReady();
            console.log("[app] PGLite migrations ready");
          }
        } catch (err) {
          console.warn(
            "[app] DB warm failed (non-fatal):",
            err instanceof Error ? err.message : err,
          );
        }
      };

      // Defer until after server is fully up
      if (server.httpServer) {
        server.httpServer.once("listening", () => {
          void warm();
        });
      } else {
        // Fallback: next tick
        setTimeout(() => void warm(), 0);
      }
    },
  };
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080,
  },

  preview: {
    host: "127.0.0.1",
    port: 8081,
  },

  resolve: {
    tsconfigPaths: true,
  },

  plugins: [
    pgliteBootstrapPlugin(),
    tailwindcss(),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
});
