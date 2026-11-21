import { CANVAS_PAGE, is_page, symbol_of } from "../map/catalog";
import { steps_of } from "../map/steps";
import { trace_of } from "../map/trace";

/** One view of the map: a page, and what is selected on it. `stop` is the place in history a crumb was seen at. */
export type Entry = { id: string; step?: number; trace?: number; focus?: string; stop?: number };

const HASH_START = "#/";

const readable = (text: string): string => encodeURIComponent(text).replace(/%2F/g, "/").replace(/%3A/g, ":");

/** The address of a view, such as `#/GET%20/api/orders/:id?step=2`. Steps count from 1 in the address. */
export function hash_of(entry: Entry): string {
  const parts: string[] = [];
  if (entry.step !== undefined) {
    parts.push(`step=${entry.step + 1}`);
  }
  if (entry.trace !== undefined) {
    parts.push(`call=${entry.trace}`);
  }
  if (entry.focus !== undefined) {
    parts.push(`focus=${readable(entry.focus)}`);
  }
  let hash = HASH_START;
  if (entry.id !== CANVAS_PAGE) {
    hash += readable(entry.id);
  }
  if (parts.length > 0) {
    hash += `?${parts.join("&")}`;
  }
  return hash;
}

const whole_number = (text: string | null): number | undefined => {
  if (text === null || !/^\d+$/.test(text)) {
    return undefined;
  }
  return Number(text);
};

/** The view an address names, or undefined when the address names none. */
export function entry_of_hash(hash: string): Entry | undefined {
  if (!hash.startsWith(HASH_START)) {
    return undefined;
  }
  const [path = "", query = ""] = hash.slice(HASH_START.length).split("?");
  const asked = new URLSearchParams(query);
  let id: string;
  try {
    id = decodeURIComponent(path);
  } catch {
    return undefined;
  }
  const step = whole_number(asked.get("step"));
  const entry: Entry = { id: id || CANVAS_PAGE, trace: whole_number(asked.get("call")), focus: asked.get("focus") ?? undefined };
  if (step !== undefined && step > 0) {
    entry.step = step - 1;
  }
  return entry;
}

/** The view with only what the map really has, or undefined when the map has no such page. */
export function known_entry({ id, step, trace, focus }: Entry): Entry | undefined {
  const symbol = symbol_of(id);
  if (symbol === undefined) {
    if (is_page(id)) {
      return { id, focus };
    }
    return undefined;
  }
  const entry: Entry = { id, focus };
  let row;
  if (trace !== undefined) {
    row = trace_of(symbol).rows[trace];
  }
  if (row !== undefined && row.kind !== "return" && row.instance !== 0) {
    entry.trace = trace;
  } else if (step !== undefined && steps_of(symbol)[step] !== undefined) {
    entry.step = step;
  }
  return entry;
}
