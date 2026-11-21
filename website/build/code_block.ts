// Renders the site's first code block at build time: one function's Rust beside its capisce pseudo-code.
// The pseudo-code goes through the capisce page's own tokenizer, so names link exactly where they do on the page.
import { readFileSync } from "node:fs";
import { KIND_LABELS, load_catalog, symbol_of } from "../../viewer/src/map/catalog";
import { pseudo_tokens, type Token } from "../../viewer/src/map/pseudo_tokens";
import { hash_of } from "../../viewer/src/state/page_url";
import type { MapData, MapSymbol } from "../../viewer/src/types";
import { rust_lines } from "./rust_tokens";

export type CodeSymbol = { kind: string; name: string; doc: string; where: string; href: string | undefined };

const STEP_LINE = /^\s*#>/;

const escape_html = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const span = (kind: string, text: string): string => `<span class="${kind}">${escape_html(text)}</span>`;

/** The address of a symbol's page in the demo. A term has no page of its own. */
function demo_href(demo: string, symbol: MapSymbol): string | undefined {
  if (symbol.kind === "term") {
    return undefined;
  }
  return `${demo}${hash_of({ id: symbol.id })}`;
}

function symbol_html(token: Token & { kind: "symbol" }, demo: string, used: Map<string, CodeSymbol>): string {
  const symbol = symbol_of(token.id);
  if (symbol === undefined) {
    return escape_html(token.text);
  }
  const href = demo_href(demo, symbol);
  let where = "";
  if (symbol.src.path !== "") {
    where = `${symbol.src.path}:${symbol.src.start}`;
  }
  used.set(symbol.id, { kind: KIND_LABELS[symbol.kind], name: symbol.id, doc: symbol.doc, where, href });
  let name = escape_html(token.text);
  const module_cut = token.text.lastIndexOf(".");
  if (symbol.kind === "def" && module_cut > 0) {
    name = `${span("module", token.text.slice(0, module_cut))}${escape_html(token.text.slice(module_cut))}`;
  }
  const attributes = `class="symbol ${symbol.kind}" data-symbol="${escape_html(symbol.id)}"`;
  if (href === undefined) {
    return `<span ${attributes} tabindex="0" role="button">${name}</span>`;
  }
  return `<a ${attributes} href="${escape_html(href)}" target="_blank" rel="noopener">${name}</a>`;
}

function tokens_html(tokens: Token[], demo: string, used: Map<string, CodeSymbol>): string {
  return tokens
    .map((token) => {
      if (token.kind === "symbol") {
        return symbol_html(token, demo, used);
      }
      if (token.kind === "comment") {
        return `<span class="comment">${tokens_html(token.parts, demo, used)}</span>`;
      }
      if (token.kind === "text") {
        return escape_html(token.text);
      }
      return span(token.kind, token.text);
    })
    .join("");
}

function column(label: string, path: string, kind: string, lines: string[]): string {
  const rows = lines.map((line) => `<span class="code_line">${line || " "}</span>`).join("");
  return (
    `<div class="code_column ${kind}"><div class="code_label">${label} <span class="code_path">${escape_html(path)}</span></div>` +
    `<pre><code>${rows}</code></pre></div>`
  );
}

/** The block's HTML, and what the page needs to describe each name in it. Step names are left out: the block shows code only. */
export function code_block(map_path: string, id: string, demo: string): string {
  load_catalog(JSON.parse(readFileSync(map_path, "utf8")) as MapData);
  const symbol = symbol_of(id);
  if (symbol === undefined) {
    throw new Error(`The map has no "${id}" to show in the first code block.`);
  }
  const used = new Map<string, CodeSymbol>();
  const rust = rust_lines(symbol.src.code).map((tokens) =>
    tokens.map((token) => (token.kind === "text" ? escape_html(token.text) : span(token.kind, token.text))).join(""),
  );
  const pseudo = symbol.pseudo
    .filter((line) => !STEP_LINE.test(line))
    .map((line) => tokens_html(pseudo_tokens(line, symbol), demo, used));
  const symbols = JSON.stringify(Object.fromEntries(used)).replace(/</g, "\\u003c");
  return (
    `<div class="side_by_side wide">` +
    column("Rust", symbol.src.path, "rust", rust) +
    column("Capisce", symbol.id, "pseudo", pseudo) +
    `<script type="application/json" id="code_symbols">${symbols}</script>` +
    `</div>`
  );
}
