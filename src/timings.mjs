// Timings say how long each endpoint takes where the project runs. A project plugs in its own source: a module
// named by `timings` in its config, which asks its tracing tool and returns one row per endpoint. The rows are
// kept in the state folder as timings.json. They are not part of the built page.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const timings_path = (state) => join(state, "timings.json");

const is_duration = (value) => Number.isFinite(value) && value >= 0;

/** The row to keep, or undefined when it is not a row. Steps are kept for later: the page does not show them yet. */
function row_of(row) {
  if (typeof row?.id !== "string" || !is_duration(row.count) || !is_duration(row.p50_ms) || !is_duration(row.p95_ms)) {
    return undefined;
  }
  const kept = { id: row.id, count: row.count, p50_ms: row.p50_ms, p95_ms: row.p95_ms };
  if (typeof row.link === "string" && /^https?:\/\//.test(row.link)) {
    kept.link = row.link;
  }
  if (Array.isArray(row.steps)) {
    kept.steps = row.steps
      .filter((step) => Number.isInteger(step?.stage) && is_duration(step.p50_ms) && is_duration(step.p95_ms))
      .map(({ stage, p50_ms, p95_ms }) => ({ stage, p50_ms, p95_ms }));
  }
  return kept;
}

/** Runs the project's source and keeps the rows that belong to an endpoint of the map. */
export async function fetch_timings(root, config, map) {
  if (typeof config.timings !== "string") {
    throw new Error(
      'This project has no source of timings. Add `timings: "./path/to/timings.mjs"` to capisce.config.mjs. The README says what the module returns.',
    );
  }
  const module = await import(pathToFileURL(resolve(root, config.timings)).href);
  const source = module.default ?? module.timings;
  if (typeof source !== "function") {
    throw new Error(`${config.timings} must export a function, as its default export or as \`timings\`.`);
  }
  const ids = map.symbols.filter((symbol) => symbol.kind === "route").map((symbol) => symbol.id);
  let result;
  try {
    result = await source({ ids, symbols: map.symbols });
  } catch (error) {
    throw new Error(`The source of timings (${config.timings}) failed, so the timings were left as they were.\n\n  ${error.message}`);
  }
  let given = result?.rows;
  if (Array.isArray(result)) {
    given = result;
  }
  if (!Array.isArray(given)) {
    throw new Error(`${config.timings} must return a list of rows, or { window, source, rows }.`);
  }
  const rows = given.flatMap((row) => row_of(row) ?? []);
  const kept = rows.filter((row) => ids.includes(row.id));
  const timed = new Set(kept.map((row) => row.id));
  const timings = { fetched_at: new Date().toISOString(), rows: kept };
  for (const key of ["window", "source"]) {
    if (typeof result[key] === "string") {
      timings[key] = result[key];
    }
  }
  return { timings, dropped: given.length - kept.length, missing: ids.filter((id) => !timed.has(id)) };
}

export function write_timings(state, timings) {
  mkdirSync(state, { recursive: true });
  writeFileSync(timings_path(state), `${JSON.stringify(timings, null, 2)}\n`);
}

export function read_timings(state) {
  const path = timings_path(state);
  if (!existsSync(path)) {
    return { rows: [] };
  }
  try {
    const timings = JSON.parse(readFileSync(path, "utf8"));
    if (Array.isArray(timings?.rows)) {
      return timings;
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "timings.unreadable", error: String(error) }));
  }
  return { rows: [] };
}
