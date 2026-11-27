// One symbol's pseudo-code section as a small file of its own: HTML to show inline, SVG to show as an image,
// or plain diff text. It holds what the code panel of the symbol's page holds, and takes its look from the
// page's own style sheets through theme.mjs.
import { KIND_LABELS, STATUS_WORDS, marked_lines, prose_tokens, pseudo_tokens, stage_blocks } from "./pseudo.mjs";
import { font_of, pixels_of, plain_colour, scoped_rules, style_of, theme_tokens, token_css } from "./theme.mjs";

export const FORMATS = { html: ".html", svg: ".svg", diff: ".diff" };
export const THEMES = ["light", "dark"];

const NO_PSEUDO_NOTE = "No pseudo-code yet.";
const CODE_ONLY_NOTE = "The real code changed. The pseudo-code was kept.";
const LINE_SIGNS = { added: "+", removed: "-", "": " " };
const SHOWN_SIGNS = { added: "+", removed: "−" };

// XML allows no control characters but tab and the line ends, so an SVG that holds one does not load.
const NOT_IN_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

/** Text made safe to put inside HTML or SVG, as content or as an attribute value. */
export const escape_markup = (text) =>
  String(text)
    .replace(NOT_IN_XML, "")
    .replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

/**
 * A file name for each id, in order: the id with every run of other characters turned into `_`, plus `extension`.
 * Two ids that would get the same name are told apart by a number.
 */
export function file_names(ids, extension) {
  const taken = new Set();
  return ids.map((id) => {
    const stem = id.replace(/[^A-Za-z0-9.-]+/g, "_").replace(/^[_.]+|[_.]+$/g, "") || "symbol";
    let name = stem;
    for (let count = 2; taken.has(name.toLowerCase()); count += 1) {
      name = `${stem}_${count}`;
    }
    taken.add(name.toLowerCase());
    return `${name}${extension}`;
  });
}

/** The ids closest to one that names no symbol: those that hold it, or its last part, in any letter case. */
function close_ids(id, ids) {
  const wanted = id.toLowerCase();
  const last_part = wanted.split(/[./ ]/).filter(Boolean).at(-1) ?? wanted;
  const holds = (text) => ids.filter((other) => other.toLowerCase().includes(text));
  return [...new Set([...holds(wanted), ...holds(last_part)])].slice(0, 5);
}

/** What to say about an id that names no symbol: the close ids when there are some, else how to list ids. */
export function unknown_id_message(id, ids) {
  const close = close_ids(id, ids);
  if (close.length > 0) {
    return `No symbol has the id "${id}". Did you mean one of these?\n\n${close.map((other) => `    ${other}`).join("\n")}`;
  }
  return `No symbol has the id "${id}". Run "capisce changes" to list the symbols a branch changed, or "capisce build --json <file>" to write every symbol with its id.`;
}

/** The module part and the rest of a name that links to a symbol. Only a function shows its module apart. */
function symbol_parts(token, index) {
  const kind = index.symbols.get(token.id)?.kind ?? "";
  let cut = -1;
  if (kind === "def") {
    cut = token.text.lastIndexOf(".");
  }
  return { kind, module: token.text.slice(0, Math.max(cut, 0)), rest: token.text.slice(Math.max(cut, 0)) };
}

/**
 * What a section shows, ready for any format: the name, the kind, the status when there is a diff, the doc
 * (before and after when it changed), a note, and the pseudo-code as stage blocks of token lines.
 * `index` is `name_index` of every symbol of the map. Without `with_diff` the symbol's diff is left out.
 */
export function section_of(symbol, index, with_diff) {
  let diff;
  if (with_diff) {
    diff = symbol.diff;
  }
  const is_prose = symbol.kind === "flow";
  const tokens_of = (text) => {
    if (is_prose) {
      return prose_tokens(text.trim(), index);
    }
    return pseudo_tokens(text, symbol, index);
  };
  const docs = [];
  if (diff?.doc_before !== undefined && diff.doc_before !== "") {
    docs.push({ text: diff.doc_before, mark: "removed" });
  }
  if (diff?.doc_before !== undefined) {
    docs.push({ text: symbol.doc, mark: "added" });
  } else if (symbol.doc !== "") {
    docs.push({ text: symbol.doc, mark: "" });
  }
  let name = { kind: "text", text: symbol.id };
  if (symbol.kind === "def") {
    name = { kind: "symbol", id: symbol.id, text: symbol.id };
  }
  let note = "";
  if (symbol.pseudo.length === 0 && symbol.kind !== "term") {
    note = NO_PSEUDO_NOTE;
  } else if (diff?.parts.includes("code") && !diff.parts.includes("pseudo")) {
    note = CODE_ONLY_NOTE;
  }
  const blocks = stage_blocks(symbol, with_diff).map((block) => ({
    ...block,
    lines: block.lines.map((line) => ({ mark: line.mark, text: line.text, tokens: tokens_of(line.text) })),
  }));
  return {
    id: symbol.id,
    name,
    kind_label: KIND_LABELS[symbol.kind] ?? symbol.kind,
    status: diff?.status ?? "",
    docs,
    note,
    is_prose,
    has_stages: blocks.some((block) => block.has_label),
    blocks,
    index,
  };
}

/**
 * The pseudo-code as plain text. With a diff, every line starts with " ", "+" or "-" under one `@@` line,
 * so it reads well in a fenced `diff` block. A doc that changed comes first, as a `doc:` line before and after.
 * Without a diff, it is the pseudo-code as written.
 */
export function section_diff(symbol, with_diff) {
  if (!with_diff) {
    return `${symbol.pseudo.join("\n")}\n`;
  }
  const status = symbol.diff?.status ?? "unchanged";
  const doc_lines = [];
  if (symbol.diff?.doc_before !== undefined) {
    doc_lines.push(`-doc: ${symbol.diff.doc_before}`, `+doc: ${symbol.doc}`);
  }
  const lines = marked_lines(symbol, true).map((line) => `${LINE_SIGNS[line.mark]}${line.text}`);
  return `${[`@@ ${symbol.id} (${status}) @@`, ...doc_lines, ...lines].join("\n")}\n`;
}

function html_tokens(tokens, index) {
  return tokens
    .map((token) => {
      if (token.kind === "text") {
        return escape_markup(token.text);
      }
      if (token.kind === "comment") {
        return `<span class="comment">${html_tokens(token.parts, index)}</span>`;
      }
      if (token.kind !== "symbol") {
        return `<span class="${token.kind}">${escape_markup(token.text)}</span>`;
      }
      const { kind, module, rest } = symbol_parts(token, index);
      let module_span = "";
      if (module !== "") {
        module_span = `<span class="module">${escape_markup(module)}</span>`;
      }
      return `<span class="symbol ${kind}">${module_span}${escape_markup(rest)}</span>`;
    })
    .join("");
}

const SHARED_RULES =
  /^\.(keyword|comment|string|own_name|added|removed|symbol\.model|symbol\.route|symbol \.module|panel_label|group_title|page_name|code_name|code_doc|no_pseudo|lines|stage|stage_label|stage_label\.(added|changed|removed)|stage_label\.removed \.stage_title|stage_change|stage_body|line|line\.(added|removed)::before|lines\.no_stages > \.stage > \.stage_label|lines\.prose|lines\.prose > \.stage|lines\.prose > \.stage > \.stage_(label|body)|lines\.prose > \.stage > \.stage_body > \.line)$/;

/** The style sheet of an HTML section: the tokens, the page's own rules for what a section holds, then the frame. */
function section_css() {
  const scope = ".capisce_section";
  return [
    token_css(scope),
    `${scope}, ${scope} * { box-sizing: border-box; }`,
    `${scope} { ${Object.entries(style_of(".capisce"))
      .filter(([name]) => ["color", "background", "font", "border", "border-radius"].includes(name))
      .map(([name, value]) => `${name}: ${value};`)
      .join(" ")} container-type: inline-size; padding: 12px 0; overflow: hidden; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }`,
    scoped_rules(scope, SHARED_RULES),
    `${scope} .code_header { padding: 0 14px 10px; }`,
    `${scope} .section_title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }`,
    `${scope} .section_title > * { margin: 0; }`,
    `${scope} .section_status { border: 1px solid var(--cp_border); border-radius: 999px; padding: 1px 9px; font-size: 12px; white-space: nowrap; }`,
    `${scope} .section_status.is_added { border-color: var(--cp_added); }`,
    `${scope} .section_status.is_removed { border-color: var(--cp_removed); }`,
    `${scope} .section_status.is_changed { border-color: var(--cp_foreground); }`,
    `${scope} .code_doc { padding: 0 2px; }`,
    `${scope} .no_pseudo { margin: 6px 0 0; padding: 0; }`,
    `${scope} .section_scroll { overflow-x: auto; }`,
    `@container (max-width: 560px) {`,
    `  ${scope} .stage { display: block; }`,
    `  ${scope} .lines > .stage > .stage_label { width: max-content; max-width: calc(100cqw - 4px); border-right: 0; padding: 8px 14px 1px; font-weight: 600; color: var(--cp_foreground); background: none; }`,
    `  ${scope} .lines > .stage > .stage_label:empty { display: none; }`,
    `}`,
  ].join("\n");
}

/** The section as one HTML document: styles inside it, no script, and nothing fetched. */
export function section_html(section) {
  const { index } = section;
  let name_class = "code_name";
  if (section.is_prose) {
    name_class = "page_name";
  }
  let status = "";
  if (section.status !== "") {
    status = `<span class="section_status is_${section.status}">${STATUS_WORDS[section.status]}</span>`;
  }
  const docs = section.docs.map((doc) => `<p class="${`code_doc ${doc.mark}`.trim()}">${escape_markup(doc.text)}</p>`);
  if (section.note !== "") {
    docs.push(`<p class="no_pseudo">${section.note}</p>`);
  }
  const stages = section.blocks.map((block) => {
    let label = "";
    if (block.has_label) {
      label = `<span class="stage_title">${escape_markup(block.title)}</span>`;
    }
    if (block.has_label && block.mark !== "") {
      label += `<span class="stage_change">${block.mark}</span>`;
    }
    let label_class = "stage_label";
    if (block.has_label && block.mark !== "") {
      label_class += ` ${block.mark}`;
    }
    const lines = block.lines.map(
      (line) => `<div class="${`line ${line.mark}`.trim()}">${html_tokens(line.tokens, index)}</div>`,
    );
    return `<div class="stage"><div class="${label_class}">${label}</div><div class="stage_body">${lines.join("")}</div></div>`;
  });
  let lines_class = "lines";
  if (section.is_prose) {
    lines_class += " prose";
  }
  if (!section.has_stages) {
    lines_class += " no_stages";
  }
  let lines = "";
  if (stages.length > 0) {
    lines = `<div class="section_scroll"><div class="${lines_class}">\n${stages.join("\n")}\n</div></div>`;
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escape_markup(section.id)}</title>
<style>
body { margin: 0; }
${section_css()}
</style>
</head>
<body>
<article class="capisce_section">
<header class="code_header">
<div class="section_title"><div class="${name_class}">${html_tokens([section.name], index)}</div><span class="panel_label">${escape_markup(section.kind_label)}</span>${status}</div>
${docs.join("\n")}
</header>
${lines}
</article>
</body>
</html>
`;
}

// Node cannot measure text, so an SVG is laid out from advances: the share of the font size one character takes.
// Monospace fonts sit at 0.6. For the sans stack this is a wide guess, so that text stays inside its box.
const MONO_ADVANCE = 0.605;
const SANS_ADVANCE = 0.56;
const SVG_MIN_WIDTH = 480;
const DOC_CHARACTERS = 62;
const PROSE_CHARACTERS = 72;
const EDGE = 14;
const FRAME_PADDING = 12;
const HEADER_BOTTOM = 10;
const TITLE_GAP = 10;
const BADGE = { height: 20, padding: 9, size: 12 };
const LABEL_PADDING_RIGHT = 10;
const LINE_PADDING_LEFT = 16;
const SIGN_LEFT = 4;
const CHANGE_BAR = 3;
const MARK_GAP = 6;
const PROSE_STAGE_GAP = 12;
const TEXT_SELECTORS = {
  keyword: [".keyword, .comment"],
  comment: [".keyword, .comment", ".comment"],
  string: [".string"],
  own_name: [".own_name"],
  model: [".symbol.model"],
  route: [".symbol.route"],
  module: [".symbol .module"],
};
const TEXT_PROPERTIES = { color: "fill", "font-weight": "font-weight", "font-style": "font-style", "text-decoration": "text-decoration" };

// A wide character, such as a CJK one, takes two columns of a monospace font.
const WIDE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/gu;

/** How many columns `text` takes: one for each character, two for each wide one. */
const columns_of = (text) => [...text].length + (text.match(WIDE)?.length ?? 0);

const advance_of = (font) => {
  if (font.family === "mono") {
    return font.size * MONO_ADVANCE;
  }
  return font.size * SANS_ADVANCE;
};

/** The start of `text` that fits in `limit` columns. It always holds one character. */
function start_that_fits(text, limit) {
  let start = "";
  for (const character of text) {
    if (start !== "" && columns_of(start + character) > limit) {
      break;
    }
    start += character;
  }
  return start;
}

/** `text` cut into lines of at most `limit` columns, at spaces where it can. */
export function wrap_text(text, limit) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word;
    if (line !== "" && columns_of(line) + 1 + columns_of(rest) > limit) {
      lines.push(line);
      line = "";
    }
    while (columns_of(rest) > limit) {
      const start = start_that_fits(rest, limit);
      lines.push(start);
      rest = rest.slice(start.length);
    }
    if (line === "") {
      line = rest;
    } else {
      line = `${line} ${rest}`;
    }
  }
  if (line !== "" || lines.length === 0) {
    lines.push(line);
  }
  return lines;
}

/** Tokens as flat pieces of text, each with the selectors of the page's rules that style it. */
function pieces_of(tokens, index, selectors = []) {
  return tokens.flatMap((token) => {
    if (token.kind === "text") {
      return [{ text: token.text, selectors }];
    }
    if (token.kind === "comment") {
      return pieces_of(token.parts, index, [...selectors, ...TEXT_SELECTORS.comment]);
    }
    if (token.kind !== "symbol") {
      return [{ text: token.text, selectors: [...selectors, ...TEXT_SELECTORS[token.kind]] }];
    }
    const { kind, module, rest } = symbol_parts(token, index);
    const own = [...selectors, ...(TEXT_SELECTORS[kind] ?? [])];
    return [
      { text: module, selectors: [...own, ...TEXT_SELECTORS.module] },
      { text: rest, selectors: own },
    ].filter((piece) => piece.text !== "");
  });
}

/** Pieces cut into lines of at most `limit` characters, at spaces, each piece keeping its style. */
function wrap_pieces(pieces, limit) {
  const lines = [[]];
  let length = 0;
  for (const piece of pieces) {
    for (const word of piece.text.split(/(\s+)/).filter((part) => part !== "")) {
      const is_space = word.trim() === "";
      if (length + word.length > limit && length > 0 && !is_space) {
        lines.push([]);
        length = 0;
      }
      if (is_space && length === 0) {
        continue;
      }
      lines.at(-1).push({ text: word, selectors: piece.selectors });
      length += word.length;
    }
  }
  return lines;
}

/** The section as an SVG picture made of rectangles, lines and text only, so it shows the same as an image. */
export function section_svg(section, theme = "light") {
  const tokens = theme_tokens(theme);
  const colour = (value) => plain_colour(value, tokens);
  const families = { mono: tokens.mono, sans: tokens.sans };
  const attributes = (values) =>
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([name, value]) => ` ${name}="${escape_markup(value)}"`)
      .join("");
  const number = (value) => String(Math.round(value * 100) / 100);
  /** The SVG text attributes that the page's rules give to these selectors, later ones winning. */
  const text_look = (selectors) => {
    const look = {};
    for (const selector of selectors) {
      for (const [property, value] of Object.entries(style_of(selector))) {
        if (property === "color") {
          look.fill = colour(value);
        } else if (TEXT_PROPERTIES[property] !== undefined) {
          look[TEXT_PROPERTIES[property]] = value;
        }
      }
    }
    return look;
  };
  const spans = (pieces) =>
    pieces
      .map((piece) => {
        const look = attributes(text_look(piece.selectors));
        if (look === "") {
          return escape_markup(piece.text);
        }
        return `<tspan${look}>${escape_markup(piece.text)}</tspan>`;
      })
      .join("");
  const shown_family = (family) => {
    if (family === "mono") {
      return undefined;
    }
    return families[family];
  };
  const baseline = (top, font) => top + font.line / 2 + font.size * 0.35;
  const text = (x, top, font, content, look = {}) =>
    `<text${attributes({
      x: number(x),
      y: number(baseline(top, font)),
      "font-family": shown_family(font.family),
      "font-size": number(font.size),
      "font-weight": font.weight,
      ...look,
    })} xml:space="preserve">${content}</text>`;
  const rect = (x, y, width, height, fill, more = {}) =>
    `<rect${attributes({ x: number(x), y: number(y), width: number(width), height: number(height), fill, ...more })}/>`;

  const base_font = font_of(".capisce");
  let code_font = font_of(".lines");
  let label_font = font_of(".stage_label");
  let name_font = font_of(".code_name");
  if (section.is_prose) {
    code_font = font_of(".lines.prose");
    label_font = font_of(".lines.prose > .stage > .stage_label");
    name_font = font_of(".page_name");
  }
  const mark_font = font_of(".stage_change");
  const kind_font = font_of(".panel_label, .group_title");
  const badge_font = { ...base_font, size: BADGE.size };
  const marks = {
    added: { fill: colour(style_of(".added").background), bar: tokens.added },
    removed: { fill: colour(style_of(".removed").background), bar: tokens.removed, look: text_look([".removed"]) },
    changed: { bar: tokens.foreground },
  };

  let label_width = 0;
  if (section.has_stages) {
    let lines_selector = ".lines";
    if (section.is_prose) {
      lines_selector = ".lines.prose";
    }
    label_width = pixels_of(style_of(lines_selector)["--stage_margin"]) ?? 156;
  }
  const label_characters = Math.max(8, Math.floor((label_width - EDGE - LABEL_PADDING_RIGHT) / advance_of(label_font)));
  const code_advance = advance_of(code_font);

  const blocks = section.blocks.map((block) => {
    let label_lines = [];
    let mark_line = -1;
    if (block.has_label) {
      label_lines = wrap_text(block.title, label_characters);
      mark_line = label_lines.length - 1;
    }
    if (block.has_label && block.mark !== "" && label_lines.at(-1).length + 1 + block.mark.length > label_characters) {
      mark_line += 1;
    }
    const rows = block.lines.flatMap((line) => {
      const pieces = pieces_of(line.tokens, section.index);
      if (section.is_prose) {
        return wrap_pieces(pieces, PROSE_CHARACTERS).map((row) => ({ mark: line.mark, indent: 0, pieces: row }));
      }
      const indent = line.text.length - line.text.trimStart().length;
      const [first, ...others] = pieces;
      let shown = pieces;
      if (first !== undefined && indent > 0) {
        shown = [{ ...first, text: first.text.slice(indent) }, ...others];
      }
      return [{ mark: line.mark, indent, pieces: shown, length: columns_of(line.text) }];
    });
    return { ...block, label_lines, mark_line, rows, height: Math.max(mark_line + 1, 1) * label_font.line };
  });
  for (const block of blocks) {
    block.height = Math.max(block.height, block.rows.length * code_font.line);
  }
  const row_lengths = blocks.flatMap((block) =>
    block.rows.map((row) => row.length ?? row.pieces.reduce((sum, piece) => sum + columns_of(piece.text), 0)),
  );
  const name_pieces = pieces_of([section.name], section.index);
  const name_width = columns_of(section.id) * advance_of(name_font);
  const kind_text = section.kind_label.toUpperCase();
  const kind_spacing = kind_font.size * 0.08;
  const kind_width = kind_text.length * (kind_font.size * 0.7 + kind_spacing);
  const status_word = STATUS_WORDS[section.status] ?? "";
  const badge_width = status_word.length * advance_of(badge_font) + BADGE.padding * 2;
  const width = Math.ceil(
    Math.max(
      SVG_MIN_WIDTH,
      label_width + LINE_PADDING_LEFT + Math.max(0, ...row_lengths) * code_advance + EDGE,
      EDGE + name_width + EDGE,
      EDGE + kind_width + TITLE_GAP + badge_width + EDGE,
    ),
  );

  const parts = [];
  let y = FRAME_PADDING;
  let name_look = { fill: colour(style_of(".code_name").color) };
  if (section.is_prose) {
    name_look = {};
  }
  parts.push(text(EDGE, y, name_font, spans(name_pieces), name_look));
  y += name_font.line + 4;
  const title_line = { ...kind_font, line: BADGE.height };
  parts.push(text(EDGE, y, title_line, escape_markup(kind_text), { fill: tokens.muted, "letter-spacing": number(kind_spacing) }));
  if (status_word !== "") {
    const badge_left = EDGE + kind_width + TITLE_GAP;
    parts.push(
      rect(badge_left + 0.5, y + 0.5, badge_width - 1, BADGE.height - 1, "none", {
        stroke: marks[section.status].bar,
        rx: number(BADGE.height / 2),
      }),
      text(badge_left + badge_width / 2, y, { ...badge_font, line: BADGE.height }, escape_markup(status_word), {
        "text-anchor": "middle",
      }),
    );
  }
  y += BADGE.height;
  const doc_width = Math.min(width - EDGE * 2, DOC_CHARACTERS * advance_of(base_font) + 4);
  for (const doc of section.docs) {
    y += 4;
    const doc_lines = wrap_text(doc.text, DOC_CHARACTERS);
    if (doc.mark !== "") {
      parts.push(rect(EDGE - 2, y, doc_width, doc_lines.length * base_font.line, marks[doc.mark].fill));
    }
    for (const line of doc_lines) {
      parts.push(text(EDGE, y, base_font, escape_markup(line), marks[doc.mark]?.look));
      y += base_font.line;
    }
  }
  if (section.note !== "") {
    const note_font = font_of(".no_pseudo");
    y += 6;
    parts.push(text(EDGE, y, note_font, escape_markup(section.note), { fill: tokens.muted }));
    y += note_font.line;
  }
  y += HEADER_BOTTOM;

  const lines_top = y;
  const body_left = label_width;
  blocks.forEach((block, block_index) => {
    if (section.is_prose && block_index > 0) {
      y += PROSE_STAGE_GAP;
    }
    const mark = marks[block.mark];
    if (block.has_label && mark !== undefined && label_width > 0) {
      if (mark.fill !== undefined) {
        parts.push(rect(0, y, label_width, block.height, mark.fill));
      }
      parts.push(rect(0, y, CHANGE_BAR, block.height, mark.bar));
    }
    let label_look = { fill: tokens.muted };
    if (section.is_prose || block.mark === "added" || block.mark === "changed") {
      label_look = {};
    }
    const mark_look = { "font-family": families.mono, "font-size": number(mark_font.size), "font-weight": "400", fill: tokens.muted };
    block.label_lines.forEach((line, line_index) => {
      let title = escape_markup(line);
      if (block.mark === "removed") {
        title = `<tspan text-decoration="line-through">${title}</tspan>`;
      }
      if (block.mark !== "" && line_index === block.mark_line) {
        title += `<tspan${attributes({ dx: MARK_GAP, ...mark_look })}>${block.mark}</tspan>`;
      }
      parts.push(text(EDGE, y + line_index * label_font.line, label_font, title, label_look));
    });
    if (block.mark !== "" && block.mark_line === block.label_lines.length) {
      parts.push(text(EDGE, y + block.mark_line * label_font.line, { ...mark_font, line: label_font.line }, block.mark, mark_look));
    }
    block.rows.forEach((row, row_index) => {
      const top = y + row_index * code_font.line;
      const row_mark = marks[row.mark];
      if (row_mark !== undefined) {
        parts.push(
          rect(body_left, top, width - body_left, code_font.line, row_mark.fill),
          text(body_left + SIGN_LEFT, top, code_font, SHOWN_SIGNS[row.mark], { fill: tokens.muted }),
        );
      }
      let look = row_mark?.look;
      if (section.is_prose && look === undefined) {
        look = { fill: tokens.muted };
      }
      const left = body_left + LINE_PADDING_LEFT + row.indent * code_advance;
      if (row.pieces.some((piece) => piece.text !== "")) {
        parts.push(text(left, top, code_font, spans(row.pieces), look));
      }
    });
    y += block.height;
  });
  if (label_width > 0 && y > lines_top) {
    parts.push(
      `<line${attributes({ x1: number(label_width - 0.5), y1: number(lines_top), x2: number(label_width - 0.5), y2: number(y), stroke: tokens.border })}/>`,
    );
  }
  const height = Math.ceil(y + FRAME_PADDING);
  const radius = pixels_of(tokens.radius) ?? 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
<title>${escape_markup(section.id)}</title>
${rect(0, 0, width, height, tokens.background, { rx: number(radius) })}
<g${attributes({ "font-family": families.mono, fill: tokens.foreground })}>
${parts.join("\n")}
</g>
${rect(0.5, 0.5, width - 1, height - 1, "none", { stroke: tokens.border, rx: number(radius) })}
</svg>
`;
}

/** The section of `symbol` in `format`, as the text of a file. */
export function render_section(symbol, index, { format = "html", with_diff = false, theme = "light" } = {}) {
  if (format === "diff") {
    return section_diff(symbol, with_diff);
  }
  const section = section_of(symbol, index, with_diff);
  if (format === "svg") {
    return section_svg(section, theme);
  }
  return section_html(section);
}
