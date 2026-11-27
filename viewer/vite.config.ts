import { svelte } from "@sveltejs/vite-plugin-svelte";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const viewer_folder = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: viewer_folder,
  publicDir: false,
  plugins: [svelte({ configFile: join(viewer_folder, "svelte.config.js") }), viteSingleFile()],
  server: { fs: { allow: [join(viewer_folder, "..")] } },
  build: {
    outDir: join(viewer_folder, "..", "dist"),
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { input: join(viewer_folder, "viewer.html") },
  },
});
