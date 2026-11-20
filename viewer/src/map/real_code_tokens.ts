import type { LineOp, MapSymbol } from "../types";

export type CodeToken = { kind: "text" | "keyword" | "string" | "comment"; text: string };
export type RealCodeRow = { gutter: string; mark: "added" | "removed" | ""; tokens: CodeToken[] };

const CODE_KEYWORDS = new Set([
  "const", "let", "var", "function", "async", "await", "return", "if", "else", "for", "of", "in", "while", "do",
  "switch", "case", "default", "break", "continue", "new", "throw", "try", "catch", "finally", "class", "extends",
  "implements", "interface", "type", "enum", "export", "import", "from", "as", "typeof", "instanceof", "void",
  "null", "undefined", "true", "false", "this", "super", "yield", "delete", "keyof", "readonly", "static",
  "public", "private", "protected", "declare", "satisfies",
]);
const CODE_TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\[\s\S])*(?:`|$))|([A-Za-z_$][\w$]*)/g;
const LINE_MARKS: Record<LineOp, RealCodeRow["mark"]> = { "+": "added", "-": "removed", " ": "" };

/** The code split into lines of tokens, with keywords, strings and comments marked. */
export function highlighted_lines(code: string): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  const add = (text: string, kind: CodeToken["kind"]) => {
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
  for (const match of code.matchAll(CODE_TOKEN)) {
    add(code.slice(last, match.index), "text");
    last = match.index + match[0].length;
    const [, comment, string, word = ""] = match;
    if (comment !== undefined) {
      add(comment, "comment");
    } else if (string !== undefined) {
      add(string, "string");
    } else if (CODE_KEYWORDS.has(word)) {
      add(word, "keyword");
    } else {
      add(word, "text");
    }
  }
  add(code.slice(last), "text");
  return lines;
}

/** The real code with line numbers, or what the branch changed in it with a sign per line. */
export function real_code_rows(symbol: MapSymbol, with_diff: boolean): RealCodeRow[] {
  const changed = symbol.diff?.code;
  if (changed === undefined || !with_diff) {
    return highlighted_lines(symbol.src.code).map((tokens, index) => ({
      gutter: String(symbol.src.start + index),
      mark: "",
      tokens,
    }));
  }
  const lines = highlighted_lines(changed.map(([, line]) => line).join("\n"));
  return changed.map(([op], index) => ({ gutter: op.trim(), mark: LINE_MARKS[op], tokens: lines[index] ?? [] }));
}
