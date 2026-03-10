import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      "/generate": "http://localhost:3000",
      "/upload": "http://localhost:3000",
      "/download": "http://localhost:3000",
      "/images": "http://localhost:3000",
      "/health": "http://localhost:3000"
    }
  }
});
