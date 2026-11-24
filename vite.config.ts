import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Capacitor uses a static SPA build. Web production builds use Nitro's Vercel
// output; local development runs through TanStack Start's own Vite server.
const isSpaMode = process.env.VITE_SPA === "true";

export default defineConfig(({ command, mode }) => {
  // Vite reads .env files into import.meta.env but doesn't populate process.env.
  // Server functions use process.env, so load only their private variables in
  // local development. These values are never added to Vite's client defines.
  if (command === "serve" && !isSpaMode) {
    const serverEnv = loadEnv(mode, process.cwd(), ["DASHBOARD_", "GOOGLE_", "AUTH_", "FLIPKART_", "AMAZON_SP_API_"]);
    for (const [key, value] of Object.entries(serverEnv)) {
      process.env[key] ??= value;
    }
  }

  return {
    // The canvas package contains native platform binaries. Keep it out of
    // Vite's browser dependency optimizer; the invoice OCR module uses it only
    // in the Node server runtime.
    optimizeDeps: {
      exclude: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist/legacy/build/pdf.mjs"],
    },
    plugins: isSpaMode
      ? [react(), tailwindcss(), tsconfigPaths()]
      : [
          tanstackStart({ server: { entry: "server" } }),
          ...(command === "build" ? [nitro({
            preset: "vercel",
            renderer: false,
            vercel: {
              functions: {
                includeFiles: [
                  "node_modules/tesseract.js/**",
                  "node_modules/tesseract.js-core/**",
                  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
                ],
                maxDuration: 60,
              },
            },
          })] : []),
          react(),
          tailwindcss(),
          tsconfigPaths(),
        ],
    ...(isSpaMode && {
      build: {
        outDir: "dist",
        rollupOptions: { input: "index.html" },
      },
    }),
  };
});
