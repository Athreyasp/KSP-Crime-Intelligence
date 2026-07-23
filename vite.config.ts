import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/server": {
        target: "https://ksp-60078060929.development.catalystserverless.in",
        changeOrigin: true,
        secure: false,
      },
      "/baas": {
        target: "https://ksp-60078060929.development.catalystserverless.in",
        changeOrigin: true,
        secure: false,
      },
      "/__catalyst": {
        target: "https://ksp-60078060929.development.catalystserverless.in",
        changeOrigin: true,
        secure: false,
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
