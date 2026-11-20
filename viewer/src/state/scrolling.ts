import type { PanelName } from "../types";

const PHONE_WIDTH = 600;

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

export function scroll_to_selected_stage(): void {
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
  const row = panel_element("flow")?.querySelector(".trace_row.selected");
  const flow = panel_element("flow");
  if (row !== null && row !== undefined && flow !== null) {
    const box = row.getBoundingClientRect();
    const frame = flow.getBoundingClientRect();
    if (box.top < frame.top + 40 || box.bottom > frame.bottom) {
      scroll_into_panel(row, 120);
    }
  }
}
