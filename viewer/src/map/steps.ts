import type { MapSymbol, Step } from "../types";
import { resolve } from "./catalog";

const STEP_HEADER = /^\s*#> (.*)$/;

export const is_step_header = (line: string): boolean => STEP_HEADER.test(line);

/** The title of a `#> Title -> target | exit` line, without its target and exits. */
export function step_title(line: string): string {
  const header = STEP_HEADER.exec(line)?.[1] ?? "";
  const call = header.split(" | ")[0] ?? "";
  return (call.split(" -> ")[0] ?? "").trim();
}

export function steps_of(symbol: MapSymbol | undefined): Step[] {
  const steps: Step[] = [];
  if (symbol === undefined) {
    return steps;
  }
  symbol.pseudo.forEach((line, index) => {
    const header = STEP_HEADER.exec(line)?.[1];
    if (header === undefined) {
      return;
    }
    const [call = "", ...exits] = header.split(" | ");
    const [title = "", target] = call.split(" -> ");
    let target_id: string | undefined;
    if (target !== undefined) {
      target_id = resolve(target.trim(), symbol.module, true);
    }
    steps.push({ title: title.trim(), target: target_id, exits: exits.map((exit) => exit.trim()), line: index });
  });
  return steps;
}
