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
 * Finish PGLite bootstrap during dev-server setup.
 * This is intentionally limited to the Vite dev server.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;

      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };

        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app] DB bootstrap failed:", err);
        throw err;
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
