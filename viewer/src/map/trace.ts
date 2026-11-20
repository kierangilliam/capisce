import type { MapSymbol } from "../types";
import { catalog, symbol_of } from "./catalog";
import { steps_of } from "./steps";

export type TraceRow = {
  kind: "note" | "call" | "return";
  owner: string;
  instance: number;
  step: number;
  title: string;
  exits: string[];
  target: string | undefined;
  from: string;
  to: string;
  level: number;
  to_level: number;
  opens: number | undefined;
};
export type TraceInstance = { id: number; lane: string; level: number; first: number; last: number; parent_row: number | undefined };
export type Trace = { rows: TraceRow[]; instances: TraceInstance[]; lanes: string[] };

const MAX_TRACE_DEPTH = 6;

/** The lane a step's target sits in, or undefined when the step stays in its own function. */
function lane_of(target: MapSymbol | undefined): string | undefined {
  if (target === undefined || target.module === "") {
    return undefined;
  }
  if (target.kind === "term" && !catalog.modules_with_code.has(target.module)) {
    return undefined;
  }
  return target.module;
}

/** Every step of `symbol` and, in order, the steps of what it calls, as rows of a sequence diagram. */
export function trace_of(symbol: MapSymbol): Trace {
  const rows: TraceRow[] = [];
  const instances: TraceInstance[] = [];
  const lanes = [symbol.module];
  const open_on_lane = new Map<string, number>();

  const walk = (owner: MapSymbol, depth: number, stack: string[], parent_row: number | undefined) => {
    const instance: TraceInstance = {
      id: instances.length,
      lane: owner.module,
      level: open_on_lane.get(owner.module) ?? 0,
      first: rows.length,
      last: rows.length - 1,
      parent_row,
    };
    instances.push(instance);
    open_on_lane.set(owner.module, instance.level + 1);
    steps_of(owner).forEach((step, index) => {
      const target = symbol_of(step.target);
      const row: TraceRow = {
        kind: "note",
        owner: owner.id,
        instance: instance.id,
        step: index,
        title: step.title,
        exits: step.exits,
        target: step.target,
        from: owner.module,
        to: owner.module,
        level: instance.level,
        to_level: instance.level,
        opens: undefined,
      };
      const lane = lane_of(target);
      if (target !== undefined && lane !== undefined) {
        row.kind = "call";
        row.to = lane;
        if (!lanes.includes(lane)) {
          lanes.push(lane);
        }
      }
      rows.push(row);
      const opens =
        target !== undefined &&
        row.kind === "call" &&
        target.kind !== "term" &&
        depth < MAX_TRACE_DEPTH &&
        !stack.includes(target.id) &&
        steps_of(target).length > 0;
      if (!opens) {
        return;
      }
      row.opens = instances.length;
      walk(target, depth + 1, [...stack, target.id], rows.length - 1);
      if (row.to !== row.from) {
        rows.push({
          ...row,
          kind: "return",
          title: "",
          exits: [],
          target: undefined,
          from: row.to,
          to: row.from,
          level: instances[row.opens]?.level ?? 0,
          to_level: instance.level,
          opens: undefined,
        });
      }
    });
    instance.last = rows.length - 1;
    open_on_lane.set(owner.module, instance.level);
  };

  walk(symbol, 0, [symbol.id], undefined);
  return { rows, instances, lanes };
}

/** The row of the trace that stands for a step of the symbol the trace starts from. */
export const row_of_step = (trace: Trace, instance: number, step: number | undefined): number | undefined => {
  if (step === undefined) {
    return undefined;
  }
  const index = trace.rows.findIndex((row) => row.instance === instance && row.step === step && row.kind !== "return");
  if (index === -1) {
    return undefined;
  }
  return index;
};
