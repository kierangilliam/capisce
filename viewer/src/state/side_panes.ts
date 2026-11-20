import { comments } from "./comments.svelte";
import { notes } from "./notes.svelte";
import { overlays } from "./overlays.svelte";

export function set_commenting(on: boolean): void {
  if (!comments.available) {
    return;
  }
  comments.on = on;
  if (on) {
    notes.on = false;
  } else {
    comments.draft = undefined;
    comments.focused = undefined;
  }
  overlays.tooltip = undefined;
}

export function set_noting(on: boolean): void {
  if (!notes.available) {
    return;
  }
  if (on) {
    set_commenting(false);
  }
  notes.on = on;
}
