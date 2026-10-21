// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Vite exposes .env values through import.meta.env, while the server-side auth
// and database modules read process.env. Bridge the project variables before
// TanStack Start creates the SSR server bundle.
const mode = process.env.NODE_ENV === "production" ? "production" : "development";
Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: Number(process.env["PORT"] ?? 8080),
      strictPort: true,
      allowedHosts: true,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
