import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const website = dirname(fileURLToPath(import.meta.url));
const SLOT = "<!--side-by-side-->";

type SideBySide = { id: string; pseudo: string; code: string; path: string };

const escape_html = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function pseudo_code_line(line: string): string {
  const comment_at = line.indexOf("#");
  if (comment_at === -1) {
    return escape_html(line);
  }
  return `${escape_html(line.slice(0, comment_at))}<span class="muted">${escape_html(line.slice(comment_at))}</span>`;
}

/** The pseudo-code as the page shows it: each step's name in the margin, beside the lines of that step. */
function pseudo_column(label: string, id: string, lines: string[]): string {
  const stages: { title: string; lines: string[] }[] = [{ title: "", lines: [] }];
  for (const line of lines) {
    const step = line.match(/^\s*#>\s*([^|]*?)\s*(->.*)?(\|.*)?$/);
    if (step !== null) {
      stages.push({ title: step[1] ?? "", lines: [] });
    } else {
      stages.at(-1)?.lines.push(line);
    }
  }
  const rows = stages
    .filter((stage) => stage.lines.length > 0)
    .map((stage) => {
      const code = stage.lines.map((line) => `<span class="code_line">${pseudo_code_line(line) || " "}</span>`).join("");
      return `<div class="stage_name">${escape_html(stage.title)}</div><pre><code>${code}</code></pre>`;
    })
    .join("");
  return `<div class="code_column"><div class="code_label">${label} <span class="code_path">${escape_html(id)}</span></div><div class="stages">${rows}</div></div>`;
}

function rust_line(line: string): string {
  if (line.trimStart().startsWith("///")) {
    return `<span class="muted">${escape_html(line)}</span>`;
  }
  return escape_html(line);
}

function code_column(label: string, path: string, lines: string[]): string {
  const rows = lines.map((line) => `<span class="code_line">${line || " "}</span>`).join("");
  return `<div class="code_column"><div class="code_label">${label} <span class="code_path">${escape_html(path)}</span></div><pre><code>${rows}</code></pre></div>`;
}

/** The first code block: one function as capisce shows it, beside the Rust it describes. Built into the page so it reads without JavaScript. */
function side_by_side(): Plugin {
  return {
    name: "side_by_side",
    transformIndexHtml(html) {
      const data = JSON.parse(readFileSync(join(website, "src", "generated", "side_by_side.json"), "utf8")) as SideBySide;
      const rust = data.code.split("\n").map(rust_line);
      const block =
        `<div class="side_by_side wide">` +
        code_column("Rust", data.path, rust) +
        pseudo_column("Capisce", data.id, data.pseudo.split("\n")) +
        `</div>`;
      return html.replace(SLOT, () => block);
    },
  };
}

export default defineConfig({
  plugins: [svelte(), side_by_side()],
  server: { port: 8212, strictPort: true },
  preview: { port: 8213, strictPort: true },
});
