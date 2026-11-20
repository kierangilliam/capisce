<script lang="ts">
  import { start_draft_on_selection } from "../state/comments.svelte";
  import { set_commenting } from "../state/side_panes";
  import type { PanelName, Point } from "../types";

  const GAP = 6;
  const BUTTON_HEIGHT = 26;
  const BUTTON_WIDTH = 80;
  type Selected = { panel: PanelName; point: Point; text: string; left: number; top: number };

  let element: HTMLButtonElement | undefined = $state();
  let selected: Selected | undefined = $state();
  let pressing = false;

  /** The text the reader selected in one part of the page, and where it starts. Nothing while they type in a box. */
  function read_selection(): Selected | undefined {
    const selection = document.getSelection();
    const typing = document.activeElement?.closest("textarea, input") ?? null;
    if (selection === null || selection.isCollapsed || selection.rangeCount === 0 || typing !== null) {
      return undefined;
    }
    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    const start = range.startContainer.parentElement;
    const host = start?.closest<HTMLElement>("[data-panel]");
    const frame = element?.closest(".capisce")?.getBoundingClientRect();
    const first = [...range.getClientRects()].find((box) => box.width > 0);
    if (text === "" || host === null || host === undefined || frame === undefined || first === undefined) {
      return undefined;
    }
    const origin = host.getBoundingClientRect();
    let top = first.top - frame.top - BUTTON_HEIGHT - GAP;
    if (top < GAP) {
      top = range.getBoundingClientRect().bottom - frame.top + GAP;
    }
    return {
      panel: host.dataset.panel as PanelName,
      point: [Math.round(first.left - origin.left + host.scrollLeft), Math.round(first.top - origin.top + host.scrollTop)],
      text,
      left: Math.max(GAP, Math.min(first.left - frame.left, frame.width - BUTTON_WIDTH - GAP)),
      top,
    };
  }

  function selection_changed() {
    if (pressing) {
      selected = undefined;
    } else {
      selected = read_selection();
    }
  }

  function press_ended() {
    pressing = false;
    selected = read_selection();
  }

  function comment_on_selection() {
    if (selected === undefined) {
      return;
    }
    const { panel, point, text } = selected;
    document.getSelection()?.removeAllRanges();
    selected = undefined;
    set_commenting(true);
    start_draft_on_selection(panel, point, text);
  }
</script>

<svelte:document onselectionchange={selection_changed} onscrollcapture={selection_changed} />
<svelte:window onpointerdown={() => (pressing = true)} onpointerup={press_ended} />

<button
  class="bar_button selection_comment"
  data-selection-comment
  bind:this={element}
  hidden={selected === undefined}
  style:left="{selected?.left ?? 0}px"
  style:top="{selected?.top ?? 0}px"
  onmousedown={(event) => event.preventDefault()}
  onclick={comment_on_selection}>Comment</button
>
