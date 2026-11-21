import { svelte } from "@sveltejs/vite-plugin-svelte";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { code_block } from "./build/code_block";

const website = dirname(fileURLToPath(import.meta.url));
const SLOT = "<!--side-by-side-->";
const SHOWN = { map: join(website, "src", "generated", "oxide-lite.json"), id: "sessions.login", demo: "/demo/oxide-lite/" };

/** The first code block: one function's Rust beside its capisce pseudo-code. Built into the page so it reads, highlighted, without JavaScript. */
function side_by_side(): Plugin {
  return {
    name: "side_by_side",
    transformIndexHtml(html) {
      const block = code_block(SHOWN.map, SHOWN.id, SHOWN.demo);
      return html.replace(SLOT, () => block);
    },
  };
}

export default defineConfig({
  plugins: [svelte(), side_by_side()],
  server: { port: 8212, strictPort: true },
  preview: { port: 8213, strictPort: true },
});
