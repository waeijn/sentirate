import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_BACKEND_TARGET || env.VITE_API_URL || "http://localhost:8050";

  return {
    plugins: [
      react(),
      tailwindcss(), // New integration for v4
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      open: true,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
