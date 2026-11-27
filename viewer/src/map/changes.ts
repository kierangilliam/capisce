import { STATUS_WORDS } from "../../../src/pseudo.mjs";
import type { Domain, MapSymbol, StepOp } from "../types";
import { catalog, domain_of_page, domain_page, KIND_LABELS } from "./catalog";

export type Chip = { part: string; label: string; tone: "added" | "removed" | "warning" | "" };
export type ChangedThing = { id: string; status_line: string; chips: Chip[] };
export type ChangeGroup = { name: string; things: ChangedThing[] };

const STEP_WORDS: Record<StepOp, string> = { "+": "Stage added", "~": "Stage changed", "-": "Stage removed", " ": "" };
const STEP_TONES: Record<StepOp, Chip["tone"]> = { "+": "added", "-": "removed", "~": "", " ": "" };
const UNGROUPED = "Shared";

function symbol_chips(symbol: MapSymbol): Chip[] {
  const diff = symbol.diff;
  if (diff === undefined) {
    return [];
  }
  const chips: Chip[] = [];
  const lines = diff.pseudo ?? [];
  if (diff.parts.includes("doc")) {
    chips.push({ part: "doc", label: "Description", tone: "" });
  }
  if (diff.status === "changed" && diff.parts.includes("pseudo")) {
    const added = lines.filter(([op]) => op === "+").length;
    const removed = lines.filter(([op]) => op === "-").length;
    chips.push({ part: "pseudo", label: `Pseudo-code +${added} −${removed}`, tone: "" });
  }
  for (const [op, title] of diff.steps ?? []) {
    if (op !== " " && diff.status === "changed") {
      chips.push({ part: `step:${title}`, label: `${STEP_WORDS[op]}: ${title}`, tone: STEP_TONES[op] });
    }
  }
  if (diff.parts.includes("code") && symbol.pseudo.length > 0 && !diff.parts.includes("pseudo")) {
    chips.push({ part: "code", label: "Real code changed, pseudo-code kept", tone: "warning" });
  } else if (diff.parts.includes("code")) {
    chips.push({ part: "code", label: "Real code", tone: "" });
  }
  if (diff.status !== "changed" && lines.length === 0) {
    chips.push({ part: "", label: "No pseudo-code", tone: "warning" });
  }
  return chips;
}

function domain_chips(domain: Domain): Chip[] {
  const chips: Chip[] = [];
  if (domain.diff?.parts.includes("doc")) {
    chips.push({ part: "doc", label: "Description", tone: "" });
  }
  if (domain.diff?.parts.includes("relations")) {
    chips.push({ part: "relations", label: "Relations", tone: "" });
  }
  return chips;
}

function changed_thing(id: string): ChangedThing | undefined {
  const symbol = catalog.symbols.get(id);
  if (symbol?.diff !== undefined) {
    const kind = KIND_LABELS[symbol.kind].toLowerCase();
    return { id, status_line: `${STATUS_WORDS[symbol.diff.status]} ${kind}`, chips: symbol_chips(symbol) };
  }
  const domain = domain_of_page(id);
  if (domain?.diff !== undefined) {
    return { id, status_line: `${STATUS_WORDS[domain.diff.status]} domain`, chips: domain_chips(domain) };
  }
  return undefined;
}

function reading_order(id: string): number {
  const symbol = catalog.symbols.get(id);
  if (symbol === undefined) {
    return 0;
  }
  if (symbol.kind === "flow") {
    return 1;
  }
  if (symbol.pseudo.length > 0) {
    return 2;
  }
  return 3;
}

/** Everything the branch changed, grouped by domain: the domain itself first, then flows, mapped code, unmapped code. */
export function change_groups(): ChangeGroup[] {
  const groups = new Map<string, string[]>();
  for (const id of catalog.changes?.ids ?? []) {
    const name = domain_of_page(id)?.id ?? (catalog.symbols.get(id)?.domain || UNGROUPED);
    groups.set(name, [...(groups.get(name) ?? []), id]);
  }
  return [...groups].map(([name, ids]) => ({
    name,
    things: ids
      .toSorted((a, b) => reading_order(a) - reading_order(b))
      .map(changed_thing)
      .filter((thing) => thing !== undefined),
  }));
}

export const changed_count_in = (domain: Domain): number =>
  (catalog.changes?.ids ?? []).filter(
    (id) => id === domain_page(domain.id) || catalog.symbols.get(id)?.domain === domain.id,
  ).length;
