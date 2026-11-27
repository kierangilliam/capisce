import type { LineOp, MapSymbol } from "../types";

export type CodeKind =
  | "text"
  | "keyword"
  | "string"
  | "comment"
  | "type"
  | "number"
  | "call"
  | "own_name"
  | "macro"
  | "attribute"
  | "constant";
export type CodeToken = { kind: CodeKind; text: string };
export type RealCodeRow = { gutter: string; mark: "added" | "removed" | ""; tokens: CodeToken[] };

/** What one language needs to be told apart: its keywords, its comment and string forms, and its extras. */
type Language = {
  keywords: Set<string>;
  types: Set<string>;
  /** Words that open a definition, so the name after them is marked as the name being defined. */
  definers: Set<string>;
  line_comment: string;
  /** Strings, in the order they should be tried; the first group of the token pattern. */
  strings: RegExp;
  /** Rust's `name!` macros and `#[attributes]`, Python's `@decorators`, TypeScript's `@decorators`. */
  macros: boolean;
  attributes: RegExp | undefined;
};

const words = (text: string) => new Set(text.split(/\s+/).filter(Boolean));

const C_STRINGS = /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/;
const LANGUAGES: Record<string, Language> = {
  rust: {
    keywords: words(`as async await break const continue crate dyn else enum extern false fn for if impl in let loop match
      mod move mut pub ref return self Self static struct super trait true type unsafe use where while Some None Ok Err`),
    types: words("bool char str u8 u16 u32 u64 u128 usize i8 i16 i32 i64 i128 isize f32 f64 String Vec Option Result Box"),
    definers: words("fn struct enum trait type mod"),
    line_comment: "//",
    strings: /b?r#*"[\s\S]*?"#*|b?"(?:[^"\\]|\\[\s\S])*"?|b?'(?:[^'\\\n]|\\.[^'\n]*)'/,
    macros: true,
    attributes: /#!?\[[^\]\n]*\]/,
  },
  typescript: {
    keywords: words(`const let var function async await return if else for of in while do switch case default break
      continue new throw try catch finally class extends implements interface type enum export import from as typeof
      instanceof void null undefined true false this super yield delete keyof readonly static public private protected
      declare satisfies get set`),
    types: words("string number boolean bigint symbol unknown never any object Promise Array Record Map Set"),
    definers: words("function class interface type enum"),
    line_comment: "//",
    strings: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\[\s\S])*(?:`|$)/,
    macros: false,
    attributes: /@[A-Za-z_]\w*/,
  },
  go: {
    keywords: words(`break case chan const continue default defer else fallthrough for func go goto if import interface map
      package range return select struct switch type var nil true false iota`),
    types: words(`bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8
      uint16 uint32 uint64 uintptr any`),
    definers: words("func type"),
    line_comment: "//",
    strings: /"(?:[^"\\\n]|\\.)*"?|`[^`]*(?:`|$)|'(?:[^'\\\n]|\\.)*'?/,
    macros: false,
    attributes: undefined,
  },
  python: {
    keywords: words(`and as assert async await break class continue def del elif else except False finally for from global
      if import in is lambda None nonlocal not or pass raise return True try while with yield self`),
    types: words("int float str bool bytes list dict set tuple object"),
    definers: words("def class"),
    line_comment: "#",
    strings: /[rbfu]*"""[\s\S]*?(?:"""|$)|[rbfu]*'''[\s\S]*?(?:'''|$)|[rbfu]*"(?:[^"\\\n]|\\.)*"?|[rbfu]*'(?:[^'\\\n]|\\.)*'?/,
    macros: false,
    attributes: /@[A-Za-z_][\w.]*/,
  },
};
const GENERIC: Language = { ...LANGUAGES.typescript!, attributes: undefined };
const EXTENSIONS: Record<string, string> = {
  rs: "rust",
  ts: "typescript",
  tsx: "typescript",
  js: "typescript",
  jsx: "typescript",
  mjs: "typescript",
  cjs: "typescript",
  svelte: "typescript",
  go: "go",
  py: "python",
};

const language_of = (path: string): Language => LANGUAGES[EXTENSIONS[path.split(".").pop() ?? ""] ?? ""] ?? GENERIC;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TYPE_NAME = /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$|^[A-Z]$/;
const CONSTANT = /^[A-Z][A-Z0-9_]{2,}$/;

/** One pattern per language, with a group per kind: comment, string, attribute, word, number. */
const patterns = new Map<Language, RegExp>();
function pattern_of(language: Language): RegExp {
  let pattern = patterns.get(language);
  if (pattern === undefined) {
    const comment = `${escape(language.line_comment)}[^\\n]*${language.line_comment === "//" ? "|\\/\\*[\\s\\S]*?(?:\\*\\/|$)" : ""}`;
    pattern = new RegExp(
      [
        `(${comment})`,
        `(${language.strings.source})`,
        `(${language.attributes?.source ?? "(?!)"})`,
        `([A-Za-z_$][\\w$]*${language.macros ? "!?" : ""})`,
        `(\\b\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?[A-Za-z0-9]*\\b)`,
      ].join("|"),
      "g",
    );
    patterns.set(language, pattern);
  }
  return pattern;
}

function word_kind(language: Language, word: string, after_definer: boolean, called: boolean): CodeKind {
  if (language.macros && word.endsWith("!")) {
    return "macro";
  }
  if (language.keywords.has(word)) {
    return "keyword";
  }
  if (after_definer) {
    return "own_name";
  }
  if (language.types.has(word) || TYPE_NAME.test(word)) {
    return "type";
  }
  if (CONSTANT.test(word)) {
    return "constant";
  }
  if (called) {
    return "call";
  }
  return "text";
}

/** The code split into lines of tokens, marked for the language its file is written in. */
export function highlighted_lines(code: string, path = ""): CodeToken[][] {
  const language = language_of(path);
  const lines: CodeToken[][] = [[]];
  const add = (text: string, kind: CodeKind) => {
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
  let after_definer = false;
  for (const match of code.matchAll(pattern_of(language))) {
    add(code.slice(last, match.index), "text");
    last = match.index + match[0].length;
    const [, comment, string, attribute, word, number] = match;
    if (comment !== undefined) {
      add(comment, "comment");
    } else if (string !== undefined) {
      add(string, "string");
    } else if (attribute !== undefined) {
      add(attribute, "attribute");
    } else if (word !== undefined) {
      const called = /^\s*(?:::<[^>]*>|<[^>()]*>)?\(/.test(code.slice(last, last + 80));
      add(word, word_kind(language, word, after_definer, called));
      after_definer = language.definers.has(word);
    } else if (number !== undefined) {
      add(number, "number");
    }
  }
  add(code.slice(last), "text");
  return lines;
}

const LINE_MARKS: Record<LineOp, RealCodeRow["mark"]> = { "+": "added", "-": "removed", " ": "" };

/** The real code with line numbers, or what the branch changed in it with a sign per line. */
export function real_code_rows(symbol: MapSymbol, with_diff: boolean): RealCodeRow[] {
  const changed = symbol.diff?.code;
  if (changed === undefined || !with_diff) {
    return highlighted_lines(symbol.src.code, symbol.src.path).map((tokens, index) => ({
      gutter: String(symbol.src.start + index),
      mark: "",
      tokens,
    }));
  }
  const lines = highlighted_lines(changed.map(([, line]) => line).join("\n"), symbol.src.path);
  return changed.map(([op], index) => ({ gutter: op.trim(), mark: LINE_MARKS[op], tokens: lines[index] ?? [] }));
}
