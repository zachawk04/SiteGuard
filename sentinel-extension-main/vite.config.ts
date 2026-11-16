import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      // The side panel page is listed in the manifest, but naming it here
      // guarantees Vite bundles it regardless of CRXJS version.
      input: { sidepanel: "sidepanel.html" },
    },
  },
});
