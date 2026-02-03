import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Disable icon requirement for development
      includeAssets: [],
      manifest: {
        name: "S-IDE Studio IDE",
        short_name: "S-IDE",
        description: "A modern IDE for AI agent workflows",
        theme_color: "#2563eb",
        // Icons will be added later
        icons: [],
      },
    }),
  ],
  server: {
    host: true, // Allow network access
    port: 5173,
    strictPort: false, // Allow alternative port if 5173 is busy
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8787",
        ws: true,
      },
    },
  },
});
