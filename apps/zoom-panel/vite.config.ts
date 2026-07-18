import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Security headers are applied on the preview (production-like) server only.
// The dev server skips them so Vite's HMR and React Fast Refresh inline scripts
// are never blocked by a strict Content-Security-Policy.
const productionHeaders = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' https://appssdk.zoom.us; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https: ws: wss:;",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

export default defineConfig({
  plugins: [react()],
  preview: {
    headers: productionHeaders,
  },
});
