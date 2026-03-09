import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { PluginOption } from "vite";
import { componentTagger } from "lovable-tagger";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

function buildCsp(mode: string): string {
  const connectSources =
    mode === "development"
      ? [
          "'self'",
          "http://127.0.0.1:8080",
          "ws://127.0.0.1:8080",
          "http://localhost:8080",
          "ws://localhost:8080",
        ]
      : ["'self'"];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src " + connectSources.join(" "),
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
  ].join("; ");
}

function securityMetaPlugin(mode: string): PluginOption {
  return {
    name: "security-meta-plugin",
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content: buildCsp(mode),
            },
            injectTo: "head-prepend",
          },
        ],
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isElectron = !!process.env.ELECTRON;

  return {
    server: {
      host: "127.0.0.1",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      securityMetaPlugin(mode),
      react(),
      mode === "development" && componentTagger(),
      isElectron &&
        electron([
          {
            entry: "electron/main.ts",
            vite: {
              build: {
                outDir: "dist-electron",
                rollupOptions: {
                  external: ["better-sqlite3"],
                },
              },
            },
          },
          {
            entry: "electron/preload.ts",
            onstart(args) {
              args.reload();
            },
            vite: {
              build: {
                outDir: "dist-electron",
                rollupOptions: {
                  output: {
                    format: "cjs",
                    entryFileNames: "preload.js",
                  },
                },
              },
            },
          },
        ]),
      isElectron && renderer(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
