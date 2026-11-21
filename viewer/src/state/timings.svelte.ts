import type { TimingRow, Timings } from "../types";
import { api_request } from "./api";

const REMEMBERED = "capisce_timings_on";

export const timings = $state({
  rows: new Map<string, TimingRow>(),
  window: "",
  source: "",
  available: false,
  on: false,
});

function remembered(): boolean {
  try {
    return localStorage.getItem(REMEMBERED) === "yes";
  } catch {
    return false;
  }
}

export function set_timings_on(on: boolean): void {
  if (!timings.available) {
    return;
  }
  timings.on = on;
  try {
    localStorage.setItem(REMEMBERED, on ? "yes" : "no");
  } catch {
    return;
  }
}

/** Timings are shown only when the page's server has some. */
export async function load_timings(): Promise<void> {
  try {
    const loaded = await api_request<Timings>("timings", "GET");
    timings.rows = new Map(loaded.rows.map((row) => [row.id, row]));
    timings.window = loaded.window ?? "";
    timings.source = loaded.source ?? "";
    timings.available = loaded.rows.length > 0;
    timings.on = timings.available && remembered();
  } catch {
    timings.available = false;
  }
}
