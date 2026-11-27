import type { Trace, TraceRow } from "./trace";
import { wrap_words } from "./text_width";

export type TraceFonts = { label: (text: string) => number; mono: (text: string) => number };
export type ArrowHead = { x: number; y: number; direction: 1 | -1 };
export type DrawnExit = { x: number; y: number; width: number; text: string };
export type DrawnRow = {
  index: number;
  row: TraceRow;
  top: number;
  height: number;
  arrow_path: string;
  arrow_head: ArrowHead | undefined;
  note: { x: number; y: number; width: number; height: number } | undefined;
  /** The solid box a call's label sits in, so the lines of the diagram never run through its words. */
  label_box: { x: number; y: number; width: number; height: number } | undefined;
  text: { x: number; y: number; lines: string[] };
  exits: DrawnExit[];
};
export type DrawnLane = { x: number; lines: string[]; first_line_y: number };
export type DrawnBar = { x: number; y: number; height: number };
export type TraceDrawing = {
  width: number;
  height: number;
  head_height: number;
  lanes: DrawnLane[];
  bars: DrawnBar[];
  rows: DrawnRow[];
};

export const TRACE = {
  lane_gap: 132,
  head_width: 120,
  head_line_height: 13,
  left: 8,
  line_height: 16,
  label_width: 178,
  bar_width: 8,
  exit_height: 16,
};

const UNNAMED_LANE = "flow";

type Placed = { top: number; bottom: number; arrow_y: number };

const lane_head_lines = (lane: string, mono: TraceFonts["mono"]): string[] =>
  wrap_words(lane.split("_").join("_ "), TRACE.head_width - 12, (text) => mono(text.replaceAll("_ ", "_"))).map((line) =>
    line.replaceAll("_ ", "_"),
  );

/** The trace as shapes to draw: a lane per module, an arrow per call, a box per step done in place. */
export function trace_drawing(trace: Trace, fonts: TraceFonts): TraceDrawing {
  const { rows, instances, lanes } = trace;
  const lane_x = (lane: string) => TRACE.left + TRACE.head_width / 2 + lanes.indexOf(lane) * TRACE.lane_gap;
  const bar_left = (lane: string, level: number) => lane_x(lane) - TRACE.bar_width / 2 + level * 5;
  const widest = (lines: string[]) => Math.max(...lines.map(fonts.label));
  const head_lines = lanes.map((lane) => lane_head_lines(lane || UNNAMED_LANE, fonts.mono));
  const head_height = Math.max(...head_lines.map((lines) => lines.length)) * TRACE.head_line_height + 22;

  let width = lane_x(lanes.at(-1) ?? "") + TRACE.head_width / 2 + TRACE.left;
  let y = head_height + 16;
  const placed: Placed[] = [];
  const drawn: DrawnRow[] = [];

  rows.forEach((row, index) => {
    const top = y;
    const from_right = bar_left(row.from, row.level) + TRACE.bar_width;
    if (row.kind === "return") {
      const from = bar_left(row.from, row.level);
      const to = bar_left(row.to, row.to_level) + TRACE.bar_width;
      const arrow_y = top + 8;
      y += 18;
      placed.push({ top, bottom: y, arrow_y });
      drawn.push({
        index,
        row,
        top,
        height: y - top,
        arrow_path: `M${from} ${arrow_y} L${to + 1} ${arrow_y}`,
        arrow_head: { x: to, y: arrow_y, direction: -1 },
        note: undefined,
        label_box: undefined,
        text: { x: 0, y: 0, lines: [] },
        exits: [],
      });
      return;
    }

    let arrow_y = top + 8;
    let bottom = top;
    let arrow_path = "";
    let arrow_head: ArrowHead | undefined;
    let note: DrawnRow["note"];
    let label_box: DrawnRow["label_box"];
    let text: DrawnRow["text"];
    const opened = instances[row.opens ?? -1];
    if (row.kind === "call" && row.to !== row.from) {
      let end = lane_x(row.to) - 1;
      if (opened !== undefined) {
        end = bar_left(row.to, opened.level) - 1;
      }
      const left = Math.min(from_right, end);
      const span = Math.abs(end - from_right);
      const lines = wrap_words(row.title, Math.max(span - 24, TRACE.label_width), fonts.label);
      const box_height = lines.length * TRACE.line_height + 10;
      label_box = { x: left + 8, y: top + 2, width: widest(lines) + 18, height: box_height };
      arrow_y = top + 2 + box_height + 7;
      const direction = end < from_right ? -1 : 1;
      arrow_path = `M${from_right} ${arrow_y} L${end - direction} ${arrow_y}`;
      arrow_head = { x: end, y: arrow_y, direction };
      text = { x: left + 17, y: top + 18, lines };
      bottom = arrow_y + 4;
      width = Math.max(width, label_box.x + label_box.width + 12);
    } else if (row.kind === "call") {
      const lines = wrap_words(row.title, TRACE.label_width, fonts.label);
      let back = from_right + 2;
      if (opened !== undefined) {
        back = bar_left(row.from, opened.level) + TRACE.bar_width + 1;
      }
      arrow_path = `M${from_right} ${arrow_y} H${from_right + 22} V${arrow_y + 14} H${back + 6}`;
      arrow_head = { x: back, y: arrow_y + 14, direction: -1 };
      const box_height = lines.length * TRACE.line_height + 10;
      label_box = { x: from_right + 30, y: top + 2, width: widest(lines) + 18, height: box_height };
      text = { x: from_right + 39, y: top + 18, lines };
      bottom = Math.max(arrow_y + 20, top + 2 + box_height);
      width = Math.max(width, label_box.x + label_box.width + 12);
    } else {
      const x = from_right + 6;
      const lines = wrap_words(row.title, TRACE.label_width - 14, fonts.label);
      const box_width = widest(lines) + 18;
      const box_height = lines.length * TRACE.line_height + 10;
      arrow_y = top + 4 + box_height / 2;
      note = { x, y: top + 4, width: box_width, height: box_height };
      text = { x: x + 9, y: top + 20, lines };
      bottom = top + 4 + box_height;
      width = Math.max(width, x + box_width + 12);
    }

    const exits: DrawnExit[] = [];
    let exit_x = from_right + 6;
    for (const exit of row.exits) {
      const exit_width = fonts.mono(exit) + 10;
      exits.push({ x: exit_x, y: bottom + 4, width: exit_width, text: exit });
      exit_x += exit_width + 5;
    }
    if (exits.length > 0) {
      bottom += TRACE.exit_height + 6;
      width = Math.max(width, exit_x + 7);
    }
    y = bottom + 8;
    placed.push({ top, bottom: y, arrow_y });
    drawn.push({ index, row, top, height: y - top, arrow_path, arrow_head, note, label_box, text, exits });
  });

  const height = y + 10;
  const bars = instances.map((instance) => {
    const parent = placed[instance.parent_row ?? -1];
    const parent_row = rows[instance.parent_row ?? -1];
    let start = head_height + 10;
    let end = height - 10;
    if (parent !== undefined && parent_row !== undefined) {
      start = parent.arrow_y;
      if (parent_row.from === instance.lane) {
        start += 14;
      }
      if (instance.last >= instance.first) {
        end = (placed[instance.last]?.bottom ?? start) - 6;
        if (rows[instance.last + 1]?.kind === "return") {
          end = placed[instance.last + 1]?.arrow_y ?? end;
        }
      }
    }
    return { x: bar_left(instance.lane, instance.level), y: start, height: Math.max(end - start, 6) };
  });

  const drawn_lanes = lanes.map((lane, index) => {
    const lines = head_lines[index] ?? [];
    return {
      x: lane_x(lane),
      lines,
      first_line_y: (head_height - lines.length * TRACE.head_line_height) / 2 + 9.5,
    };
  });

  return { width: Math.ceil(width), height, head_height, lanes: drawn_lanes, bars, rows: drawn };
}
