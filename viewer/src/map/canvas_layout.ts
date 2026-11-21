import type { Domain } from "../types";

export type CanvasPoint = { x: number; y: number };
export type CanvasEdge = { from: CanvasPoint; to: CanvasPoint; head: string; label: string; middle: CanvasPoint };
export type CanvasBox = { domain: Domain; x: number; y: number };
export type CanvasLayout = {
  width: number;
  height: number;
  frame: { left: number; top: number; width: number; height: number };
  boxes: CanvasBox[];
  edges: CanvasEdge[];
};

export const BOX = { width: 168, height: 62 };
const CELL = { width: 262, height: 136 };
const FRAME = { left: 14, top: 22, pad_x: 30, pad_top: 44, pad_bottom: 30 };
const HEAD_LENGTH = 8;
const HEAD_ANGLE = 0.4;

function box_corner(domain: Domain): CanvasPoint {
  const [column = 0, row = 0] = domain.at;
  return {
    x: FRAME.left + FRAME.pad_x + column * CELL.width,
    y: FRAME.top + FRAME.pad_top + row * CELL.height,
  };
}

function box_center(domain: Domain): CanvasPoint {
  const corner = box_corner(domain);
  return { x: corner.x + BOX.width / 2, y: corner.y + BOX.height / 2 };
}

/** Where the line from one box's center toward the other's leaves the box. */
function box_edge(from: CanvasPoint, to: CanvasPoint, gap: number): CanvasPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const reach = Math.min(BOX.width / 2 / Math.abs(dx || 1e-9), BOX.height / 2 / Math.abs(dy || 1e-9));
  const length = Math.hypot(dx, dy) || 1;
  return { x: from.x + dx * reach + (dx / length) * gap, y: from.y + dy * reach + (dy / length) * gap };
}

function arrow_head_points(from: CanvasPoint, to: CanvasPoint): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const wing = (turn: number) =>
    `${to.x - HEAD_LENGTH * Math.cos(angle + turn)},${to.y - HEAD_LENGTH * Math.sin(angle + turn)}`;
  return `${to.x},${to.y} ${wing(-HEAD_ANGLE)} ${wing(HEAD_ANGLE)}`;
}

function span_of(cells: number[]): { first: number; count: number } {
  if (cells.length === 0) {
    return { first: 0, count: 1 };
  }
  const first = Math.min(...cells);
  return { first, count: Math.max(...cells) - first + 1 };
}

/** Where every domain box, relation arrow and the frame go on the canvas. The frame goes around the domains not marked outside. */
export function canvas_layout(domains: Domain[]): CanvasLayout {
  const placed = domains.filter((domain) => !domain.frame);
  const by_id = new Map(placed.map((domain) => [domain.id, domain]));
  const columns = Math.max(0, ...placed.map((domain) => domain.at[0] ?? 0)) + 1;
  const rows = Math.max(0, ...placed.map((domain) => domain.at[1] ?? 0)) + 1;
  const width_of = (column_count: number) => FRAME.pad_x * 2 + (column_count - 1) * CELL.width + BOX.width;
  const height_of = (row_count: number) => FRAME.pad_top + FRAME.pad_bottom + (row_count - 1) * CELL.height + BOX.height;

  const framed = placed.filter((domain) => !domain.outside);
  const framed_columns = span_of(framed.map((domain) => domain.at[0] ?? 0));
  const framed_rows = span_of(framed.map((domain) => domain.at[1] ?? 0));
  const frame = {
    left: FRAME.left + framed_columns.first * CELL.width,
    top: FRAME.top + framed_rows.first * CELL.height,
    width: width_of(framed_columns.count),
    height: height_of(framed_rows.count),
  };

  const edges: CanvasEdge[] = [];
  for (const domain of placed) {
    for (const relation of domain.relations) {
      const other = by_id.get(relation.to);
      if (other === undefined) {
        continue;
      }
      const from = box_edge(box_center(domain), box_center(other), 0);
      const to = box_edge(box_center(other), box_center(domain), 2);
      edges.push({
        from,
        to,
        head: arrow_head_points(from, to),
        label: relation.label,
        middle: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      });
    }
  }
  return {
    width: FRAME.left * 2 + width_of(columns),
    height: FRAME.top + height_of(rows) + 14,
    frame,
    boxes: placed.map((domain) => ({ domain, ...box_corner(domain) })),
    edges,
  };
}
