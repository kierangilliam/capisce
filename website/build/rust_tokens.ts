// A small pass over Rust, for the site's first code block. It marks what a reader needs to tell apart at a
// glance (comments, strings, keywords, types, macros, attributes, lifetimes, numbers, calls and the name a `fn` defines) and leaves the rest plain.

export type RustToken = {
  kind: "text" | "comment" | "string" | "keyword" | "type" | "macro" | "attribute" | "lifetime" | "own_name" | "number" | "call";
  text: string;
};

const KEYWORDS = new Set([
  "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false", "fn", "for",
  "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static",
  "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while",
]);
const PRIMITIVE_TYPES = new Set([
  "bool", "char", "str", "u8", "u16", "u32", "u64", "u128", "usize", "i8", "i16", "i32", "i64", "i128", "isize", "f32", "f64",
]);
const TOKEN = new RegExp(
  [
    /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))/,
    /(b?r#*"[\s\S]*?"#*|b?"(?:[^"\\]|\\[\s\S])*"?|b?'(?:[^'\\\n]|\\.[^'\n]*)')/,
    /(#!?\[[^\]\n]*\])/,
    /('[A-Za-z_]\w*)/,
    /([A-Za-z_]\w*!?)/,
    /(\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?(?:[iu](?:8|16|32|64|128|size)|f32|f64)?\b)/,
  ]
    .map((part) => part.source)
    .join("|"),
  "g",
);
const TYPE_NAME = /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$|^[A-Z]$/;

function word_kind(word: string, after_fn: boolean, called: boolean): RustToken["kind"] {
  if (word.endsWith("!")) {
    return "macro";
  }
  if (KEYWORDS.has(word)) {
    return "keyword";
  }
  if (after_fn) {
    return "own_name";
  }
  if (PRIMITIVE_TYPES.has(word) || TYPE_NAME.test(word)) {
    return "type";
  }
  if (called) {
    return "call";
  }
  return "text";
}

/** The Rust code split into lines of tokens. */
export function rust_lines(code: string): RustToken[][] {
  const lines: RustToken[][] = [[]];
  const add = (text: string, kind: RustToken["kind"]) => {
    text.split("\n").forEach((part, index) => {
      if (index > 0) {
        lines.push([]);
      }
      if (part !== "") {
        lines.at(-1)?.push({ kind, text: part });
      }
    });
  };
  let last = 0;
  let after_fn = false;
  for (const match of code.matchAll(TOKEN)) {
    add(code.slice(last, match.index), "text");
    last = match.index + match[0].length;
    const [, comment, string, attribute, lifetime, word, number] = match;
    if (comment !== undefined) {
      add(comment, "comment");
    } else if (string !== undefined) {
      add(string, "string");
    } else if (attribute !== undefined) {
      add(attribute, "attribute");
    } else if (lifetime !== undefined) {
      add(lifetime, "lifetime");
    } else if (word !== undefined) {
      const called = /^\s*(?:::<[^>]*>)?\(/.test(code.slice(last));
      add(word, word_kind(word, after_fn, called));
      after_fn = word === "fn";
    } else if (number !== undefined) {
      add(number, "number");
    }
  }
  add(code.slice(last), "text");
  return lines;
}
