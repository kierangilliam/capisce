import { symbol_of } from "../map/catalog";
import { go } from "./navigation.svelte";
import { overlays, show_real_code } from "./overlays.svelte";

/** A click on a name: a tooltip, or with cmd/ctrl its page, or with cmd/ctrl+shift its real code. */
export function symbol_clicked(event: MouseEvent, id: string): void {
  const symbol = symbol_of(id);
  if (symbol === undefined || !(event.currentTarget instanceof Element)) {
    return;
  }
  event.stopPropagation();
  const command = event.metaKey || event.ctrlKey;
  if (command && event.shiftKey && symbol.src.path !== "") {
    show_real_code(id);
  } else if (command && symbol.kind !== "term") {
    void go(id);
  } else {
    overlays.tooltip = { id, anchor: event.currentTarget.getBoundingClientRect() };
  }
}
