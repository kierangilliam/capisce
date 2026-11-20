import { tick } from "svelte";
import { CANVAS_PAGE, CHANGES_PAGE, catalog, domain_of_page, domain_page, is_page, symbol_of } from "../map/catalog";
import { steps_of } from "../map/steps";
import { row_of_step, trace_of } from "../map/trace";
import type { Domain, MapSymbol } from "../types";
import { overlays, show_real_code } from "./overlays.svelte";
import { reset_scroll, scroll_to_focus, scroll_to_selected_stage } from "./scrolling";

export type Entry = { id: string; step?: number; trace?: number; focus?: string };

export const nav = $state({ entries: [{ id: CANVAS_PAGE }] as Entry[], at: 0 });
export const view = $state({ real_code: false });

export const current = (): Entry => nav.entries[nav.at] ?? { id: CANVAS_PAGE };

export async function go(id: string, { step, focus }: { step?: number; focus?: string } = {}): Promise<void> {
  const symbol = symbol_of(id);
  if (symbol === undefined && !is_page(id)) {
    return;
  }
  if (step !== undefined && steps_of(symbol)[step] === undefined) {
    step = undefined;
  }
  nav.entries = [...nav.entries.slice(0, nav.at + 1), { id, step, focus }];
  nav.at = nav.entries.length - 1;
  overlays.tooltip = undefined;
  await tick();
  reset_scroll();
  if (focus === "code") {
    show_real_code(id);
  } else if (focus !== undefined) {
    scroll_to_focus();
  }
}

export function go_to_entry(index: number): void {
  if (index >= 0 && index < nav.entries.length) {
    nav.at = index;
    overlays.tooltip = undefined;
  }
}

/** Opens a changed thing from the Changes page and points at the part that changed. */
export function open_change(id: string, part: string | undefined): Promise<void> {
  const symbol = symbol_of(id);
  nav.entries = [{ id: CHANGES_PAGE }];
  nav.at = 0;
  if (part === undefined && symbol !== undefined && symbol.diff?.status !== "changed") {
    part = "pseudo";
  }
  let step: number | undefined;
  if (part?.startsWith("step:") && symbol?.diff?.status !== "removed") {
    const title = part.slice("step:".length);
    const index = steps_of(symbol).findIndex((each) => each.title === title);
    if (index !== -1) {
      step = index;
    }
  }
  return go(id, { step, focus: part });
}

/** Opens `id` as if reached from the canvas through its domain. */
export function open_from_browse(id: string): Promise<void> {
  const domain = catalog.domains.get(symbol_of(id)?.domain ?? "") ?? domain_of_page(id);
  const entries: Entry[] = [{ id: CANVAS_PAGE }];
  if (domain !== undefined && id !== domain_page(domain.id)) {
    entries.push({ id: domain_page(domain.id) });
  }
  nav.entries = entries;
  nav.at = entries.length - 1;
  overlays.tooltip = undefined;
  if (id === CANVAS_PAGE) {
    return Promise.resolve();
  }
  return go(id);
}

export function open_changes(): Promise<void> {
  nav.entries = [{ id: CANVAS_PAGE }];
  nav.at = 0;
  return go(CHANGES_PAGE);
}

/** The domain the reader is in: the current page's, or the last one they came through. */
export function context_domain(): Domain | undefined {
  for (let index = nav.at; index >= 0; index -= 1) {
    const id = nav.entries[index]?.id ?? "";
    const domain = domain_of_page(id) ?? catalog.domains.get(symbol_of(id)?.domain ?? "");
    if (domain !== undefined) {
      return domain;
    }
  }
  return undefined;
}

/** What the code panel shows: the page's own symbol, or the function picked from a nested call in its trace. */
export function shown_code(entry: Entry): { symbol: MapSymbol; step: number | undefined; trace_root: MapSymbol | undefined } | undefined {
  const root = symbol_of(entry.id);
  if (root === undefined) {
    return undefined;
  }
  if (entry.trace === undefined) {
    return { symbol: root, step: entry.step, trace_root: undefined };
  }
  const picked = trace_of(root).rows[entry.trace];
  const owner = symbol_of(picked?.owner);
  if (picked === undefined || owner === undefined) {
    return { symbol: root, step: entry.step, trace_root: undefined };
  }
  return { symbol: owner, step: picked.step, trace_root: root };
}

export async function select_step(step: number): Promise<void> {
  const entry = current();
  entry.trace = undefined;
  if (entry.step === step) {
    entry.step = undefined;
  } else {
    entry.step = step;
  }
  await tick();
  scroll_to_selected_stage();
}

export async function select_trace_row(index: number): Promise<void> {
  const entry = current();
  const symbol = symbol_of(entry.id);
  if (symbol === undefined) {
    return;
  }
  const row = trace_of(symbol).rows[index];
  if (row === undefined || row.kind === "return") {
    return;
  }
  if (row.instance === 0) {
    await select_step(row.step);
    return;
  }
  if (entry.trace === index) {
    entry.trace = undefined;
  } else {
    entry.trace = index;
  }
  entry.step = undefined;
  await tick();
  scroll_to_selected_stage();
}

/** A stage clicked in the code panel: a step of the page's symbol, or of the function picked from the trace. */
export function select_stage(step: number): Promise<void> {
  const entry = current();
  const symbol = symbol_of(entry.id);
  if (entry.trace === undefined || symbol === undefined) {
    return select_step(step);
  }
  const trace = trace_of(symbol);
  const instance = trace.rows[entry.trace]?.instance ?? 0;
  const index = row_of_step(trace, instance, step);
  if (index === undefined) {
    return Promise.resolve();
  }
  return select_trace_row(index);
}

export function toggle_real_code(): void {
  view.real_code = !view.real_code;
}
