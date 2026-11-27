// What the page and the command line both know about pseudo-code: its stages, its tokens and the words for a change.
// The page imports this file too, so it stays plain: no Node modules and nothing from the browser.

/**
 * @typedef {import("../viewer/src/types").MapSymbol} MapSymbol
 * @typedef {import("../viewer/src/types").SymbolKind} SymbolKind
 * @typedef {import("../viewer/src/types").DiffStatus} DiffStatus
 * @typedef {"added" | "removed" | "changed" | ""} ChangeMark
 * @typedef {{ text: string, mark: ChangeMark }} StageLine
 * @typedef {{ step: number | undefined, title: string, has_label: boolean, mark: ChangeMark, lines: StageLine[] }} StageBlock
 * @typedef {{ title: string, target: string | undefined, exits: string[], line: number }} StepHeader
 * @typedef {{ kind: "text" | "keyword" | "string" | "own_name", text: string } | { kind: "symbol", text: string, id: string } | { kind: "comment", parts: Token[] }} Token
 * @typedef {{ symbols: Map<string, MapSymbol>, bare_owners: Map<string, string[]> }} NameIndex
 */

/** @type {Record<SymbolKind, string>} */
export const KIND_LABELS = { route: "Endpoint", def: "Function", model: "Model", term: "Term", flow: "Flow" };

/** @type {Record<DiffStatus, string>} */
export const STATUS_WORDS = { added: "New", removed: "Removed", changed: "Changed" };

const STEP_HEADER = /^\s*#> (.*)$/;
/** @type {Record<string, ChangeMark>} */
const STEP_MARKS = { "+": "added", "~": "changed", "-": "removed", " ": "" };
/** @type {Record<string, ChangeMark>} */
const LINE_MARKS = { "+": "added", "-": "removed", " ": "" };

/** @type {(line: string) => boolean} */
export const is_step_header = (line) => STEP_HEADER.test(line);

/** @type {(id: string) => string} */
export const bare_name = (id) => id.split(".").at(-1) ?? id;

/**
 * The `#> Title -> target | exit` lines of some pseudo-code, each with the name it calls as it is written.
 * @param {string[]} pseudo
 * @returns {StepHeader[]}
 */
export function step_headers(pseudo) {
  /** @type {StepHeader[]} */
  const headers = [];
  pseudo.forEach((line, index) => {
    const header = STEP_HEADER.exec(line)?.[1];
    if (header === undefined) {
      return;
    }
    const [call = "", ...exits] = header.split(" | ");
    const [title = "", target] = call.split(" -> ");
    headers.push({ title: title.trim(), target: target?.trim(), exits: exits.map((exit) => exit.trim()), line: index });
  });
  return headers;
}

/**
 * The title of a `#> Title -> target | exit` line, without its target and exits.
 * @param {string} line
 * @returns {string}
 */
export const step_title = (line) => step_headers([line])[0]?.title ?? "";

/**
 * The names that pseudo-code can link to: every symbol by id, and each function with pseudo-code by its bare name.
 * @param {MapSymbol[]} symbols
 * @returns {NameIndex}
 */
export function name_index(symbols) {
  /** @type {NameIndex} */
  const index = { symbols: new Map(symbols.map((symbol) => [symbol.id, symbol])), bare_owners: new Map() };
  for (const symbol of symbols) {
    if (symbol.kind === "def" && symbol.pseudo.length > 0) {
      const bare = bare_name(symbol.id);
      index.bare_owners.set(bare, [...(index.bare_owners.get(bare) ?? []), symbol.id]);
    }
  }
  return index;
}

/**
 * The id that `name` means when written inside `from_module`, or undefined when it names nothing in the map.
 * @param {NameIndex} index
 * @param {string} name
 * @param {string} from_module
 * @param {boolean} is_called
 * @returns {string | undefined}
 */
export function resolve_name(index, name, from_module, is_called) {
  if (index.symbols.has(name)) {
    return name;
  }
  if (name.includes(".") || !is_called) {
    return undefined;
  }
  if (index.symbols.has(`${from_module}.${name}`)) {
    return `${from_module}.${name}`;
  }
  const owners = index.bare_owners.get(name) ?? [];
  if (owners.length === 1) {
    return owners[0];
  }
  return undefined;
}

/**
 * The pseudo-code lines to show, in order, with the lines the branch removed put back where they were.
 * @param {MapSymbol} symbol
 * @param {boolean} with_diff
 * @returns {StageLine[]}
 */
export function marked_lines(symbol, with_diff) {
  const diff = symbol.diff;
  if (with_diff && diff?.status === "removed") {
    return symbol.pseudo.map((text) => ({ text, mark: "removed" }));
  }
  if (!with_diff || diff?.pseudo === undefined) {
    return symbol.pseudo.map((text) => ({ text, mark: "" }));
  }
  return diff.pseudo.map(([op, text]) => ({ text, mark: LINE_MARKS[op] ?? "" }));
}

/**
 * @param {MapSymbol} symbol
 * @param {boolean} with_diff
 * @returns {Map<string, ChangeMark>}
 */
function changed_step_marks(symbol, with_diff) {
  /** @type {Map<string, ChangeMark>} */
  const marks = new Map();
  if (!with_diff) {
    return marks;
  }
  for (const [op, title] of symbol.diff?.steps ?? []) {
    if (op === "+" || op === "~") {
      marks.set(title, STEP_MARKS[op] ?? "");
    }
  }
  return marks;
}

/**
 * The pseudo-code grouped into stages: each `#>` line becomes the label of the lines under it.
 * Lines before the first stage form a block without a label. A removed stage keeps its label and is not a step.
 * @param {MapSymbol} symbol
 * @param {boolean} with_diff
 * @returns {StageBlock[]}
 */
export function stage_blocks(symbol, with_diff) {
  const titles = step_headers(symbol.pseudo).map((header) => header.title);
  const step_marks = changed_step_marks(symbol, with_diff);
  /** @type {StageBlock[]} */
  const blocks = [];
  /** @type {StageBlock} */
  let block = { step: undefined, title: "", has_label: false, mark: "", lines: [] };
  let live_step = -1;
  /** @param {StageBlock} next */
  const start = (next) => {
    if (block.has_label || block.lines.length > 0) {
      blocks.push(block);
    }
    block = next;
  };
  const continue_live_step = () => {
    /** @type {number | undefined} */
    let step;
    if (live_step >= 0) {
      step = live_step;
    }
    start({ step, title: titles[live_step] ?? "", has_label: false, mark: "", lines: [] });
  };

  for (const line of marked_lines(symbol, with_diff)) {
    const is_header = is_step_header(line.text);
    const was_removed = line.mark === "removed" && symbol.diff?.status !== "removed";
    if (is_header && was_removed) {
      start({ step: undefined, title: step_title(line.text), has_label: true, mark: "removed", lines: [] });
    } else if (is_header) {
      live_step += 1;
      const title = titles[live_step] ?? step_title(line.text);
      start({ step: live_step, title, has_label: true, mark: step_marks.get(title) ?? line.mark, lines: [] });
    } else {
      if (!was_removed && block.mark === "removed" && block.has_label && symbol.diff?.status !== "removed") {
        continue_live_step();
      }
      block.lines.push(line);
    }
  }
  start(block);
  return blocks;
}

/**
 * The index of the last block of `step`, where the function it calls opens.
 * @param {StageBlock[]} blocks
 * @param {number | undefined} step
 * @returns {number}
 */
export const last_block_of = (blocks, step) => {
  if (step === undefined) {
    return -1;
  }
  return blocks.findLastIndex((block) => block.step === step);
};

const KEYWORDS = new Set([
  "def", "route", "model", "if", "elif", "else", "for", "in", "return", "raise", "and", "or", "not",
  "is", "None", "True", "False", "try", "except", "on", "with", "log",
]);
const TOKEN = /\[\[(.+?)\]\]|("[^"]*")|(#.*$)|([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g;
const BRACKET_LINK = /\[\[(.+?)\]\]/g;

/** @type {(text: string) => Token} */
const text_token = (text) => ({ kind: "text", text });

/**
 * @param {string} text
 * @param {MapSymbol} owner
 * @param {boolean} is_called
 * @param {NameIndex} index
 * @returns {Token[]}
 */
function identifier_tokens(text, owner, is_called, index) {
  if (KEYWORDS.has(text)) {
    return [{ kind: "keyword", text }];
  }
  const parts = text.split(".");
  for (let count = parts.length; count >= 1; count -= 1) {
    const head = parts.slice(0, count).join(".");
    const id = resolve_name(index, head, owner.module, is_called && count === parts.length);
    if (id === owner.id) {
      return [{ kind: "own_name", text }];
    }
    if (id !== undefined) {
      return [{ kind: "symbol", text: head, id }, text_token(text.slice(head.length))];
    }
  }
  return [text_token(text)];
}

/**
 * Plain words where `[[id]]` links to a symbol in the map.
 * @param {string} text
 * @param {NameIndex} index
 * @returns {Token[]}
 */
export function prose_tokens(text, index) {
  /** @type {Token[]} */
  const tokens = [];
  let last = 0;
  for (const match of text.matchAll(BRACKET_LINK)) {
    const id = match[1] ?? "";
    tokens.push(text_token(text.slice(last, match.index)));
    last = match.index + match[0].length;
    if (index.symbols.has(id)) {
      tokens.push({ kind: "symbol", text: id, id });
    } else {
      tokens.push(text_token(match[0]));
    }
  }
  tokens.push(text_token(text.slice(last)));
  return tokens;
}

/**
 * One line of pseudo-code as tokens: keywords, strings, comments and the names that link to other symbols.
 * @param {string} line
 * @param {MapSymbol} owner
 * @param {NameIndex} index
 * @returns {Token[]}
 */
export function pseudo_tokens(line, owner, index) {
  /** @type {Token[]} */
  const tokens = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    tokens.push(text_token(line.slice(last, match.index)));
    last = match.index + match[0].length;
    const [whole, link, string, comment, identifier] = match;
    if (link !== undefined && index.symbols.has(link)) {
      tokens.push({ kind: "symbol", text: link, id: link });
    } else if (string !== undefined) {
      tokens.push({ kind: "string", text: string });
    } else if (comment !== undefined) {
      tokens.push({ kind: "comment", parts: prose_tokens(comment, index) });
    } else if (identifier !== undefined) {
      tokens.push(...identifier_tokens(identifier, owner, line[last] === "(", index));
    } else {
      tokens.push(text_token(whole));
    }
  }
  tokens.push(text_token(line.slice(last)));
  return tokens.filter((token) => token.kind === "comment" || token.text !== "");
}
