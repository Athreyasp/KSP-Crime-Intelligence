import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Keep maplibre-gl in its own chunk so its inlined Worker blob
        // does not reference class names across chunk boundaries
        // (that cross-chunk reference causes "OF is not defined" in production)
        // NOTE: Vite v8 (rolldown) requires manualChunks to be a function
        manualChunks(id: string) {
          if (id.includes("maplibre-gl")) {
            return "maplibre-gl";
          }
        },
      },
    },
  },
  server: {
    proxy: {
      "/server": {
        target: "https://ksp-60078060929.development.catalystserverless.in",
        changeOrigin: true,
        secure: true,
        headers: {
          Connection: "keep-alive"
        }
      },
      "/baas": {
        target: "https://ksp-60078060929.development.catalystserverless.in",
        changeOrigin: true,
        secure: true,
        headers: {
          Connection: "keep-alive"
        }
      },
      "/__catalyst": {
        target: "https://ksp-60078060929.development.catalystserverless.in",
        changeOrigin: true,
        secure: true,
        headers: {
          Connection: "keep-alive"
        }
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    tailwindcss(),
    react(),
  ],
});
