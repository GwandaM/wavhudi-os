import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isElectron = !!process.env.ELECTRON;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
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
