import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Conditionally load Replit plugins only in Replit environment
const getReplitPlugins = async (): Promise<PluginOption[]> => {
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    try {
      const [cartographerModule, devBannerModule] = await Promise.all([
        import("@replit/vite-plugin-cartographer"),
        import("@replit/vite-plugin-dev-banner"),
      ]);
      return [cartographerModule.cartographer(), devBannerModule.devBanner()];
    } catch {
      // Plugins not available, skip them
      return [];
    }
  }
  return [];
};

export default defineConfig(async () => {
  const replitPlugins = await getReplitPlugins();

  return {
    plugins: [
      react(),
      runtimeErrorOverlay(),
      ...replitPlugins,
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: process.env.NODE_ENV !== "production",
    },
    server: {
      fs: {
        strict: true,
        deny: [".env", ".env.*", ".git", "*.pem", "*.key"],
      },
    },
  };
});
