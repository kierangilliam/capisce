import { tick } from "svelte";
import { CANVAS_PAGE, CHANGES_PAGE, catalog, domain_of_page, domain_page, is_page, symbol_of } from "../map/catalog";
import { steps_of } from "../map/steps";
import { row_of_step, trace_of } from "../map/trace";
import type { Domain, MapSymbol } from "../types";
import { overlays, show_real_code } from "./overlays.svelte";
import { entry_of_hash, hash_of, known_entry, type Entry } from "./page_url";
import { panel_element, reset_scroll, scroll_to_focus, scroll_to_selected_stage } from "./scrolling";

export type { Entry } from "./page_url";

/** One place in the reader's history: the trail of pages that led to the page shown, which is its last entry. */
type Stop = { trail: Entry[]; index: number; last: number };
type Scrolls = Partial<Record<(typeof SCROLLED)[number], [number, number]>>;

const SCROLLED = ["flow", "code"] as const;
const MAX_TRAIL = 40;

export const nav = $state({ entries: [] as Entry[], index: 0, last: 0 });
export const view = $state({ real_code: false });

/** Inside another page the browser's history belongs to that page, so the map keeps its own. */
let uses_browser_history = !is_embedded();
const own_stops: Stop[] = [];
const scrolls = new Map<number, Scrolls>();

export const current = (): Entry => nav.entries.at(-1) ?? { id: CANVAS_PAGE };

function is_embedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function saved_stop(state: unknown): Stop | undefined {
  const stop = (state as { capisce?: Stop } | null)?.capisce;
  if (stop === undefined || !Array.isArray(stop.trail) || !Number.isInteger(stop.index)) {
    return undefined;
  }
  const shown = known_entry(stop.trail.at(-1) ?? { id: "" });
  if (shown === undefined) {
    return { trail: [{ id: CANVAS_PAGE }], index: stop.index, last: stop.last };
  }
  return { trail: [...stop.trail.slice(0, -1).filter((entry) => known_entry(entry) !== undefined), shown], index: stop.index, last: stop.last };
}

/** Records a stop in the browser's history, as a new entry or over the current one, and in the map's own. */
function write_stop(stop: Stop, as_new: boolean): void {
  own_stops[stop.index] = stop;
  const hash = hash_of(stop.trail.at(-1) ?? { id: CANVAS_PAGE });
  try {
    if (as_new && uses_browser_history) {
      history.pushState({ capisce: stop }, "", hash);
    } else if (uses_browser_history) {
      history.replaceState({ capisce: stop }, "", hash);
    } else {
      history.replaceState(null, "", hash);
    }
  } catch {
    uses_browser_history = false;
  }
}

function keep_scroll(): void {
  const kept: Scrolls = {};
  for (const panel of SCROLLED) {
    const element = panel_element(panel);
    if (element !== null) {
      kept[panel] = [element.scrollLeft, element.scrollTop];
    }
  }
  scrolls.set(nav.index, kept);
}

async function show(stop: Stop): Promise<void> {
  nav.entries = stop.trail;
  nav.index = stop.index;
  nav.last = stop.last;
  overlays.tooltip = undefined;
  await tick();
  const kept = scrolls.get(stop.index);
  if (kept === undefined) {
    reset_scroll();
    scroll_to_selected_stage();
    if (current().focus !== undefined) {
      scroll_to_focus();
    }
    return;
  }
  for (const panel of SCROLLED) {
    panel_element(panel)?.scrollTo(...(kept[panel] ?? [0, 0]));
  }
}

/** The trail so far, with the page shown marked as seen at this place in history. */
function trail_here(): Entry[] {
  const trail = $state.snapshot(nav.entries);
  const shown = trail.at(-1);
  if (shown !== undefined) {
    shown.stop = nav.index;
  }
  return trail;
}

/** Opens the last page of `trail` as a new place in history. */
function open(trail: Entry[]): Promise<void> {
  keep_scroll();
  const stop = { trail: trail.slice(-MAX_TRAIL), index: nav.index + 1, last: nav.index + 1 };
  scrolls.delete(stop.index);
  write_stop(stop, true);
  return show(stop);
}

/** Saves what is selected on the page shown over its place in history: selecting is not a new place. */
function remember(): void {
  write_stop({ trail: $state.snapshot(nav.entries), index: nav.index, last: nav.last }, false);
}

/** Moves back (-1) or forward (+1) through history, by any number of places. */
export function move(by: number): void {
  if (by === 0) {
    return;
  }
  if (uses_browser_history) {
    history.go(by);
    return;
  }
  const stop = own_stops[nav.index + by];
  if (stop !== undefined) {
    keep_scroll();
    write_stop(stop, false);
    void show({ ...stop, last: nav.last });
  }
}

/** The browser moved through history, or the reader changed the address by hand. */
function browser_moved(event: PopStateEvent): void {
  keep_scroll();
  let stop = saved_stop(event.state);
  if (stop === undefined) {
    const asked = known_entry(entry_of_hash(location.hash) ?? { id: CANVAS_PAGE }) ?? { id: CANVAS_PAGE };
    stop = { trail: trail_from_canvas(asked), index: nav.index + 1, last: nav.index + 1 };
    scrolls.delete(stop.index);
  } else {
    stop.last = Math.max(nav.last, stop.index);
  }
  write_stop(stop, false);
  void show(stop);
}

/** The pages that lead to a page from the canvas: its domain, when it has one. Those the reader did come through keep their place in history. */
function trail_from_canvas(entry: Entry): Entry[] {
  const domain = catalog.domains.get(symbol_of(entry.id)?.domain ?? "") ?? domain_of_page(entry.id);
  const here = trail_here();
  const trail: Entry[] = [];
  for (const id of [CANVAS_PAGE, domain_page(domain?.id ?? "")]) {
    const seen = here[trail.length];
    if (id === entry.id || !is_page(id)) {
      continue;
    }
    if (seen?.id === id) {
      trail.push(seen);
    } else {
      trail.push({ id });
    }
  }
  return [...trail, entry];
}

/** Shows the page the address names, or the place in history a reload came back to, and follows the browser's history. */
export function start_history(): void {
  let stop: Stop | undefined;
  try {
    if (uses_browser_history) {
      stop = saved_stop(history.state);
    }
  } catch {
    uses_browser_history = false;
  }
  if (stop === undefined) {
    let asked = entry_of_hash(location.hash);
    if (asked === undefined && catalog.changes !== undefined) {
      asked = { id: CHANGES_PAGE };
    }
    stop = { trail: trail_from_canvas(known_entry(asked ?? { id: CANVAS_PAGE }) ?? { id: CANVAS_PAGE }), index: 0, last: 0 };
  }
  write_stop(stop, false);
  window.addEventListener("popstate", browser_moved);
  void show(stop);
}

export async function go(id: string, { step, trace, focus }: { step?: number; trace?: number; focus?: string } = {}): Promise<void> {
  const entry = known_entry({ id, step, trace, focus });
  if (entry === undefined) {
    return;
  }
  await open([...trail_here(), entry]);
  if (focus === "code") {
    show_real_code(id);
  }
}

/** A click on a crumb: back to where that page was seen, or to the page anew when it was only passed on the way. */
export function go_to_crumb(index: number): void {
  const crumb = nav.entries[index];
  if (crumb === undefined || index === nav.entries.length - 1) {
    return;
  }
  if (crumb.stop !== undefined) {
    move(crumb.stop - nav.index);
    return;
  }
  void open($state.snapshot(nav.entries).slice(0, index + 1));
}

/** Opens a changed thing from the Changes page and points at the part that changed. */
export async function open_change(id: string, part: string | undefined): Promise<void> {
  const symbol = symbol_of(id);
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
  const entry = known_entry({ id, step, focus: part });
  if (entry === undefined) {
    return;
  }
  await open([...trail_here().slice(-1), entry]);
  if (part === "code") {
    show_real_code(id);
  }
}

/** Opens `id` as if reached from the canvas through its domain. */
export function open_from_browse(id: string): Promise<void> {
  return open(trail_from_canvas({ id }));
}

export function open_changes(): Promise<void> {
  return open_from_browse(CHANGES_PAGE);
}

/** The domain the reader is in: the current page's, or the last one they came through. */
export function context_domain(): Domain | undefined {
  for (let index = nav.entries.length - 1; index >= 0; index -= 1) {
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
  remember();
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
  remember();
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
