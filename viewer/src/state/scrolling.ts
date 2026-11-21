import type { PanelName } from "../types";

const PHONE_WIDTH = 600;
const SIDE_ROOM = 48;

export const panel_element = (panel: PanelName): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-panel="${panel}"]`);

export function reset_scroll(): void {
  for (const panel of ["flow", "code"] as const) {
    panel_element(panel)?.scrollTo(0, 0);
  }
}

function scroll_into_panel(target: Element | null | undefined, room_above: number): void {
  const scroller = target?.closest<HTMLElement>("[data-panel]");
  if (target === null || target === undefined || scroller === null || scroller === undefined) {
    return;
  }
  const offset = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTop = Math.max(0, offset - room_above);
}

/** Scrolls each panel to the part of the page the reader asked to see. */
export function scroll_to_focus(): void {
  scroll_into_panel(panel_element("code")?.querySelector(".focused"), 140);
  scroll_into_panel(panel_element("flow")?.querySelector(".trace_row.selected, .trace_row.changed"), 140);
}

/** Brings the selected row of the trace into sight, sideways too: on a narrow screen its lane may be off to the side. */
function scroll_to_selected_row(): void {
  const flow = panel_element("flow");
  const row = flow?.querySelector(".trace_row.selected");
  if (flow === null || row === null || row === undefined) {
    return;
  }
  const frame = flow.getBoundingClientRect();
  const box = row.getBoundingClientRect();
  if (box.top < frame.top + 40 || box.bottom > frame.bottom) {
    scroll_into_panel(row, 120);
  }
  const label = row.querySelector(".trace_note, .trace_label")?.getBoundingClientRect();
  if (label !== undefined && (label.left < frame.left || label.right > frame.right)) {
    flow.scrollLeft = Math.max(0, flow.scrollLeft + label.left - frame.left - SIDE_ROOM);
  }
}

export function scroll_to_selected_stage(): void {
  scroll_to_selected_row();
  if (window.innerWidth <= PHONE_WIDTH) {
    return;
  }
  const code = panel_element("code");
  const label = code?.querySelector(".stage.selected");
  if (code !== null && label !== null && label !== undefined) {
    const box = label.getBoundingClientRect();
    const frame = code.getBoundingClientRect();
    if (box.top < frame.top || box.top > frame.bottom - 80) {
      scroll_into_panel(label, 60);
    }
  }
}
