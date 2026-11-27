import * as pseudo from "../../../src/pseudo.mjs";
import type { MapSymbol } from "../types";
import { catalog } from "./catalog";

export type Token = pseudo.Token;

/** Plain words where `[[id]]` links to a symbol in the map. */
export const prose_tokens = (text: string): Token[] => pseudo.prose_tokens(text, catalog);

/** One line of pseudo-code as tokens: keywords, strings, comments and the names that link to other symbols. */
export const pseudo_tokens = (line: string, owner: MapSymbol): Token[] => pseudo.pseudo_tokens(line, owner, catalog);
