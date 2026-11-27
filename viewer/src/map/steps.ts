import { step_headers } from "../../../src/pseudo.mjs";
import type { MapSymbol, Step } from "../types";
import { resolve } from "./catalog";

/** The steps of a symbol's pseudo-code, each with the id of the symbol it calls. */
export function steps_of(symbol: MapSymbol | undefined): Step[] {
  if (symbol === undefined) {
    return [];
  }
  return step_headers(symbol.pseudo).map((header) => {
    let target: string | undefined;
    if (header.target !== undefined) {
      target = resolve(header.target, symbol.module, true);
    }
    return { ...header, target };
  });
}
