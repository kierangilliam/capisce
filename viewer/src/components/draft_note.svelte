<script lang="ts">
  import { tick } from "svelte";
  import { add_pictures, cancel_draft, comments, pictures_in, save_draft } from "../state/comments.svelte";
  import type { CommentDraft } from "../types";
  import AddPicture from "./add_picture.svelte";
  import Pictures from "./pictures.svelte";

  let { draft }: { draft: CommentDraft } = $props();

  const EDGE_GAP = 8;
  let element: HTMLDivElement | undefined = $state();
  let input: HTMLTextAreaElement | undefined = $state();
  let position: { left: number; top: number } | undefined = $state();
  let grip: { x: number; y: number } | undefined = $state();

  /** Beside the draft's pin, or where the reader dragged it, kept inside the page. */
  function place() {
    const frame = element?.offsetParent?.getBoundingClientRect();
    const note = element?.getBoundingClientRect();
    const pin = document.querySelector('.pin[data-pin="draft"]')?.getBoundingClientRect();
    if (frame === undefined || note === undefined || pin === undefined) {
      position = undefined;
      return;
    }
    const wanted = comments.note_moved_to ?? { left: pin.right - frame.left + EDGE_GAP, top: pin.top - frame.top };
    position = {
      left: Math.max(EDGE_GAP, Math.min(wanted.left, frame.width - note.width - EDGE_GAP)),
      top: Math.max(EDGE_GAP, Math.min(wanted.top, frame.height - note.height - EDGE_GAP)),
    };
  }

  $effect(() => {
    void [draft.pin.x, draft.pin.y, draft.pin.panel, draft.strokes.length, draft.images.length, draft.text, comments.note_moved_to, comments.hint];
    void tick().then(() => {
      place();
      input?.focus();
    });
  });

  async function pasted(event: ClipboardEvent) {
    const files = pictures_in(event);
    if (files.length > 0) {
      event.preventDefault();
      draft.images.push(...(await add_pictures(files)));
    }
  }

  function grip_down(event: PointerEvent) {
    const note = element?.getBoundingClientRect();
    if (note === undefined) {
      return;
    }
    event.preventDefault();
    grip = { x: event.clientX - note.left, y: event.clientY - note.top };
  }

  function grip_move(event: PointerEvent) {
    const frame = element?.offsetParent?.getBoundingClientRect();
    if (grip === undefined || frame === undefined) {
      return;
    }
    comments.note_moved_to = { left: event.clientX - grip.x - frame.left, top: event.clientY - grip.y - frame.top };
  }
</script>

<svelte:document onscrollcapture={place} />
<svelte:window onpointermove={grip_move} onpointerup={() => (grip = undefined)} />

<div
  class="draft_note"
  class:moving={grip !== undefined}
  bind:this={element}
  style:visibility={position === undefined ? "hidden" : "visible"}
  style:left="{position?.left ?? 0}px"
  style:top="{position?.top ?? 0}px"
>
  <div class="note_handle" role="presentation" title="Drag to move" onpointerdown={grip_down}></div>
  <textarea class="comment_input" data-draft-input placeholder="Leave a comment" bind:this={input} bind:value={draft.text} onpaste={pasted}></textarea>
  <Pictures names={draft.images} remove={(name) => (draft.images = draft.images.filter((each) => each !== name))} />
  {#if comments.hint !== "" || comments.error !== ""}
    <div class="comment_note" role="alert">{comments.hint || comments.error}</div>
  {/if}
  <div class="comment_row">
    <AddPicture added={(names) => draft.images.push(...names)} />
    {#if draft.strokes.length > 0}
      <button class="text_button" onclick={() => (draft.strokes = [])}>Clear drawing</button>
    {/if}
    <button class="text_button" onclick={cancel_draft}>Cancel</button>
    <button class="bar_button" data-draft-save onclick={save_draft}>Save<span class="key">⌘↵</span></button>
  </div>
</div>
