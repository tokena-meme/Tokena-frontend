// vite.config.ts
import { defineConfig } from "node_modules/vite/dist/node/index.js";
import react from "node_modules/@vitejs/plugin-react/dist/index.mjs";
import { nodePolyfills } from "node_modules/vite-plugin-node-polyfills/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "D:\\WorkPlace\\Ranofty\\Bolt.new\\tokena-main";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "process", "crypto", "stream", "util", "events", "http", "https", "os", "url", "zlib", "path"],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  optimizeDeps: {
    exclude: ["lucide-react"],
    include: ["@solana/web3.js", "@solana/spl-token", "buffer"]
  }
});
export {
  vite_config_default as default
};
