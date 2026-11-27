import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { name_index } from "../src/pseudo.mjs";
import { mark_changes } from "../src/review.mjs";
import { file_names, render_section, unknown_id_message } from "../src/show.mjs";
import { theme_tokens } from "../src/theme.mjs";

const home = join(dirname(fileURLToPath(import.meta.url)), "..");
const LONG_LINE = `    if basket.total < 3 and basket.note != "rush <now>" & more:`;

function symbol(id, doc, pseudo) {
  const module = id.split(".").slice(0, -1).join(".");
  return {
    id,
    kind: "def",
    doc,
    module,
    domain: "Orders",
    authored: true,
    pseudo,
    hash: "same",
    src: { path: "orders.py", start: 1, end: 2, code: "" },
  };
}

/** A small map before and after a branch: one function changed, one added, one removed, one left alone. */
function changed_map() {
  const kept = symbol("orders.total", "Adds up a basket.", ["def total(basket):", "    return sum(basket)"]);
  const base = {
    domains: [],
    symbols: [
      kept,
      symbol("orders.place", "Places an order.", [
        "def place(basket):",
        "    #> Check the basket",
        "    check(basket)",
        "    #> Take the money -> orders.total",
        "    charge(total(basket))",
      ]),
      symbol("orders.cancel", "Cancels an order.", ["def cancel(order):", "    #> Give the money back", "    refund(order)"]),
    ],
  };
  const head = {
    domains: [],
    symbols: [
      structuredClone(kept),
      symbol("orders.place", "Places an order & tells the kitchen.", [
        "def place(basket):",
        "    #> Refuse a small basket",
        LONG_LINE,
        '        raise TooSmall("a basket needs 3 items")',
        "    #> Take the money -> orders.total",
        "    charge(total(basket))",
        "    log(basket)",
      ]),
      symbol("orders.track", "Says where an order is.", ["def track(order):", "    #> Ask the courier", "    return courier(order)"]),
    ],
  };
  mark_changes(base, head);
  const index = name_index(head.symbols);
  return (id, format, options = {}) => render_section(index.symbols.get(id), index, { format, with_diff: true, ...options });
}

test("the diff text marks added, removed and kept lines", () => {
  const show = changed_map();
  assert.equal(
    show("orders.place", "diff"),
    [
      "@@ orders.place (changed) @@",
      "-doc: Places an order.",
      "+doc: Places an order & tells the kitchen.",
      " def place(basket):",
      "+    #> Refuse a small basket",
      `+${LONG_LINE}`,
      '+        raise TooSmall("a basket needs 3 items")',
      "-    #> Check the basket",
      "-    check(basket)",
      "     #> Take the money -> orders.total",
      "     charge(total(basket))",
      "+    log(basket)",
      "",
    ].join("\n"),
  );
  assert.match(show("orders.track", "diff"), /^@@ orders\.track \(added\) @@\n\+def track\(order\):\n\+/);
  assert.match(show("orders.cancel", "diff"), /^@@ orders\.cancel \(removed\) @@\n-def cancel\(order\):\n-/);
  assert.match(show("orders.total", "diff"), /^@@ orders\.total \(unchanged\) @@\n def total\(basket\):\n /);
  assert.equal(show("orders.total", "diff", { with_diff: false }), "def total(basket):\n    return sum(basket)\n");
});

test("the HTML shows the status, the doc change, the stage labels and the lines, with nothing fetched", () => {
  const show = changed_map();
  const changed = show("orders.place", "html");
  assert.match(changed, /<span class="section_status is_changed">Changed<\/span>/);
  assert.match(changed, /<p class="code_doc removed">Places an order\.<\/p>\n<p class="code_doc added">Places an order &#38; tells the kitchen\.<\/p>/);
  assert.match(changed, /<div class="stage_label added"><span class="stage_title">Refuse a small basket<\/span><span class="stage_change">added<\/span>/);
  assert.match(changed, /<div class="stage_label removed"><span class="stage_title">Check the basket<\/span>/);
  assert.match(changed, /<div class="stage_label changed"><span class="stage_title">Take the money<\/span>/);
  assert.match(changed, /<div class="line removed"> {4}check\(basket\)<\/div>/);
  assert.match(changed, /<span class="string">&#34;rush &#60;now&#62;&#34;<\/span> &#38; more:/);
  assert.match(changed, /<div class="code_name"><span class="symbol def"><span class="module">orders<\/span>\.place<\/span><\/div>/);
  assert.match(changed, /charge\(<span class="symbol def">total<\/span>\(basket\)\)/);
  assert.match(changed, /prefers-color-scheme: dark/);
  assert.doesNotMatch(changed, /<script|<link|<img|@import|url\(|https?:/);

  assert.match(show("orders.track", "html"), /is_added">New<\/span>/);
  assert.match(show("orders.cancel", "html"), /is_removed">Removed<\/span>[^]*<div class="line removed">/);
  const plain = show("orders.total", "html");
  assert.doesNotMatch(plain, /section_status is_|class="line (added|removed)"/);
  assert.doesNotMatch(show("orders.place", "html", { with_diff: false }), /section_status is_|class="line (added|removed)"/);
});

test("the SVG is plain shapes and text, escaped, and wide enough for its longest line", () => {
  const show = changed_map();
  const light = theme_tokens("light");
  const dark = theme_tokens("dark");
  for (const id of ["orders.place", "orders.track", "orders.cancel"]) {
    const svg = show(id, "svg");
    const tags = new Set([...svg.matchAll(/<([A-Za-z][\w:]*)/g)].map((match) => match[1]));
    assert.deepEqual([...tags].filter((tag) => !["svg", "title", "g", "rect", "text", "tspan", "line", "path"].includes(tag)), []);
    assert.doesNotMatch(svg, /href|style=|<style|url\(|https?:\/\/(?!www\.w3\.org\/2000\/svg")/);
    const [, width, height, box] = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="(\d+)" height="(\d+)" viewBox="0 0 ([\d ]+)"/.exec(svg);
    assert.equal(box, `${width} ${height}`);
    assert.match(svg, new RegExp(`<rect x="0" y="0" width="${width}" height="${height}" fill="${light.background}"`));
    assert.match(svg, /font-family="[^"]*monospace"/);
    assert.match(svg, /font-family="[^"]*sans-serif"/);
  }

  const changed = show("orders.place", "svg");
  const width = Number(/width="(\d+)"/.exec(changed)[1]);
  const label_width = 156;
  const widest_character = 12 * 0.6;
  assert.ok(width >= label_width + LONG_LINE.length * widest_character, `${width} is too narrow for the longest line`);
  assert.ok(width < 1000, `${width} is far wider than the longest line`);
  assert.match(changed, /&#34;rush &#60;now&#62;&#34;<\/tspan> &#38; more:/);
  assert.doesNotMatch(changed, /<now>|& more/);
  assert.match(changed, />Changed<\/text>/);
  assert.match(changed, /text-decoration="line-through"[^>]*>check\(basket\)</);
  assert.match(show("orders.track", "svg"), />New<\/text>/);
  assert.match(show("orders.cancel", "svg"), />Removed<\/text>/);

  assert.notEqual(dark.background, light.background);
  assert.match(show("orders.place", "svg", { theme: "dark" }), new RegExp(`<rect x="0" y="0"[^>]* fill="${dark.background}"`));
});

test("a file name is the id made safe, and two ids never share one", () => {
  assert.deepEqual(file_names(["PUT /api/things/:id", "orders.place", "GET /things/{id}", "../../etc", "///"], ".svg"), [
    "PUT_api_things_id.svg",
    "orders.place.svg",
    "GET_things_id.svg",
    "etc.svg",
    "symbol.svg",
  ]);
  assert.deepEqual(file_names(["GET /a/b", "GET /a_b", "get /a b"], ".html"), ["GET_a_b.html", "GET_a_b_2.html", "get_a_b_3.html"]);
});

test("an id that names no symbol gets close ids, or a way to list ids", () => {
  const ids = ["orders.place", "orders.total", "GET /orders"];
  assert.match(unknown_id_message("place", ids), /No symbol has the id "place"\. Did you mean one of these\?\n\n {4}orders\.place$/);
  assert.match(unknown_id_message("billing.refund", ids), /capisce changes/);
});

test("the command prints one symbol of a sample project, and says which ids are close to a wrong one", () => {
  const capisce = (...args) =>
    execFileSync(process.execPath, [join(home, "bin", "capisce.mjs"), ...args, "--root", join(home, "examples", "help-desk")], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  assert.match(capisce("show", "GET /tickets", "--format", "diff"), /^route GET \/tickets\(status=None\):\n/);
  assert.match(capisce("show", "GET /tickets", "--format", "svg"), /^<svg [^]*<\/svg>\n$/);
  const listed = JSON.parse(capisce("changes", "--base", "HEAD", "--json"));
  assert.deepEqual(Object.keys(listed), ["base", "head", "changes"]);
  assert.throws(() => capisce("show", "GET /ticket"), /capisce could not finish\.\n\n {2}No symbol has the id "GET \/ticket"\. Did you mean/);
});

test("control characters are left out, and a wide character counts as two columns in the SVG", () => {
  const width_of = (line) => {
    const one = symbol("orders.note", "Notes.", ["def note():", line]);
    const index = name_index([one]);
    const svg = render_section(one, index, { format: "svg", with_diff: false });
    assert.doesNotMatch(svg, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    return Number(/width="(\d+)"/.exec(svg)[1]);
  };
  assert.equal(width_of(`    a\u0001b\u001b = 1`), width_of("    ab = 1"));
  assert.equal(width_of(`    ${"全".repeat(60)}`), width_of(`    ${"x".repeat(120)}`));
});

test("a term has no note about missing pseudo-code", () => {
  const term = { ...symbol("basket", "What a customer means to buy.", []), kind: "term" };
  const html = render_section(term, name_index([term]), { format: "html", with_diff: false });
  assert.doesNotMatch(html, /No pseudo-code yet/);
});
