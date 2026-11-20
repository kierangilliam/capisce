import { symbol_of } from "../map/catalog";

export type TooltipState = { id: string; anchor: DOMRect };

export const overlays = $state({
  tooltip: undefined as TooltipState | undefined,
  real_code_of: undefined as string | undefined,
  menu_open: false,
});

export function show_real_code(id: string): void {
  if (symbol_of(id) === undefined) {
    return;
  }
  overlays.tooltip = undefined;
  overlays.real_code_of = id;
}

export function close_overlays(): void {
  overlays.tooltip = undefined;
  overlays.real_code_of = undefined;
  overlays.menu_open = false;
}
