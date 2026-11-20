import type { MapSymbol } from "../types";
import { catalog, resolve } from "./catalog";

export type Token =
  | { kind: "text" | "keyword" | "string" | "own_name"; text: string }
  | { kind: "symbol"; text: string; id: string }
  | { kind: "comment"; parts: Token[] };

const KEYWORDS = new Set([
  "def", "route", "model", "if", "elif", "else", "for", "in", "return", "raise", "and", "or", "not",
  "is", "None", "True", "False", "try", "except", "on", "with", "log",
]);
const TOKEN = /\[\[(.+?)\]\]|("[^"]*")|(#.*$)|([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g;
const BRACKET_LINK = /\[\[(.+?)\]\]/g;

const text_token = (text: string): Token => ({ kind: "text", text });

function identifier_tokens(text: string, owner: MapSymbol, is_called: boolean): Token[] {
  if (KEYWORDS.has(text)) {
    return [{ kind: "keyword", text }];
  }
  const parts = text.split(".");
  for (let count = parts.length; count >= 1; count -= 1) {
    const head = parts.slice(0, count).join(".");
    const id = resolve(head, owner.module, is_called && count === parts.length);
    if (id === owner.id) {
      return [{ kind: "own_name", text }];
    }
    if (id !== undefined) {
      return [{ kind: "symbol", text: head, id }, text_token(text.slice(head.length))];
    }
  }
  return [text_token(text)];
}

/** Plain words where `[[id]]` links to a symbol in the map. */
export function prose_tokens(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(BRACKET_LINK)) {
    const id = match[1] ?? "";
    tokens.push(text_token(text.slice(last, match.index)));
    last = match.index + match[0].length;
    if (catalog.symbols.has(id)) {
      tokens.push({ kind: "symbol", text: id, id });
    } else {
      tokens.push(text_token(match[0]));
    }
  }
  tokens.push(text_token(text.slice(last)));
  return tokens;
}

/** One line of pseudo-code as tokens: keywords, strings, comments and the names that link to other symbols. */
export function pseudo_tokens(line: string, owner: MapSymbol): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    tokens.push(text_token(line.slice(last, match.index)));
    last = match.index + match[0].length;
    const [whole, link, string, comment, identifier] = match;
    if (link !== undefined && catalog.symbols.has(link)) {
      tokens.push({ kind: "symbol", text: link, id: link });
    } else if (string !== undefined) {
      tokens.push({ kind: "string", text: string });
    } else if (comment !== undefined) {
      tokens.push({ kind: "comment", parts: prose_tokens(comment) });
    } else if (identifier !== undefined) {
      tokens.push(...identifier_tokens(identifier, owner, line[last] === "("));
    } else {
      tokens.push(text_token(whole));
    }
  }
  tokens.push(text_token(line.slice(last)));
  return tokens.filter((token) => token.kind === "comment" || token.text !== "");
}
