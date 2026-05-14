import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "src", "assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist-standalone"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@monaco-editor") || id.includes("node_modules/monaco-editor")) return "vendor-monaco";
          if (id.includes("node_modules/react-dom")) return "vendor-react-dom";
          if (id.includes("node_modules/react/")) return "vendor-react";
          if (id.includes("node_modules/framer-motion")) return "vendor-framer";
          if (id.includes("node_modules/lucide-react")) return "vendor-lucide";
          if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
          if (id.includes("node_modules/react-markdown") || id.includes("node_modules/rehype") || id.includes("node_modules/remark") || id.includes("node_modules/unified") || id.includes("node_modules/hast") || id.includes("node_modules/mdast") || id.includes("node_modules/micromark")) return "vendor-markdown";
          if (id.includes("node_modules/highlight.js")) return "vendor-highlight";
          if (id.includes("node_modules/@xterm")) return "vendor-xterm";
          if (id.includes("node_modules/jszip") || id.includes("node_modules/file-saver") || id.includes("node_modules/@isomorphic-git")) return "vendor-fs";
          if (id.includes("node_modules/@webcontainer")) return "vendor-webcontainer";
          if (id.includes("node_modules/")) return "vendor-misc";
        },
      },
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
