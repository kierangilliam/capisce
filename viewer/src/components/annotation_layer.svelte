<script lang="ts">
  import { tick } from "svelte";
  import { comments, finish_press, number_of, shown_on } from "../state/comments.svelte";
  import { current, view } from "../state/navigation.svelte";
  import type { CommentDraft, PanelName, Point, SavedComment } from "../types";

  let { panel }: { panel: PanelName } = $props();

  const DRAG_PIXELS = 4;
  type Press = { points: Point[]; drew: boolean };

  let layer: SVGSVGElement | undefined = $state();
  let size = $state({ width: 0, height: 0 });
  let press: Press | undefined = $state();

  const shown = $derived.by(() => {
    const list: (SavedComment | CommentDraft)[] = comments.list.filter(
      (comment) => shown_on(panel, comment) && (comment.status === "open" || comment.id === comments.focused),
    );
    if (comments.draft !== undefined && shown_on(panel, comments.draft)) {
      list.push(comments.draft);
    }
    return list;
  });
  const is_dimmed = (comment: SavedComment | CommentDraft) =>
    comments.focused !== undefined && !("id" in comment && comment.id === comments.focused);
  const pin_id = (comment: SavedComment | CommentDraft) => {
    if ("id" in comment) {
      return comment.id;
    }
    return "draft";
  };
  const stroke_path = (points: Point[]) => points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");

  /** The layer covers everything the panel can scroll to, so it is measured with the layer itself out of the way. */
  async function cover_panel() {
    size = { width: 0, height: 0 };
    await tick();
    const host = layer?.parentElement;
    if (host !== null && host !== undefined) {
      size = { width: host.scrollWidth, height: host.scrollHeight };
    }
  }

  $effect(() => {
    const entry = current();
    void [entry.id, entry.step, entry.trace, view.real_code];
    void cover_panel();
  });

  function layer_point(event: PointerEvent): Point {
    const box = layer?.getBoundingClientRect() ?? new DOMRect();
    return [Math.round(event.clientX - box.left), Math.round(event.clientY - box.top)];
  }

  function pointer_down(event: PointerEvent) {
    event.preventDefault();
    press = { points: [layer_point(event)], drew: false };
  }

  function pointer_move(event: PointerEvent) {
    const start = press?.points[0];
    if (press === undefined || start === undefined) {
      return;
    }
    const point = layer_point(event);
    if (!press.drew && Math.hypot(point[0] - start[0], point[1] - start[1]) < DRAG_PIXELS) {
      return;
    }
    press.drew = true;
    press.points.push(point);
  }

  function pointer_up(event: PointerEvent) {
    if (press === undefined) {
      return;
    }
    const { points, drew } = $state.snapshot(press);
    press = undefined;
    finish_press(panel, points, drew, event.clientX, event.clientY);
  }
</script>

<svelte:window onresize={cover_panel} onpointermove={pointer_move} onpointerup={pointer_up} />

<svg
  class="annotation_layer"
  role="presentation"
  bind:this={layer}
  data-layer={panel}
  style:width="{size.width}px"
  style:height="{size.height}px"
  onpointerdown={pointer_down}
>
  {#each shown as comment}
    {#each comment.strokes.filter((stroke) => stroke.panel === panel) as stroke}
      <path class="stroke" class:dimmed={is_dimmed(comment)} d={stroke_path(stroke.points)} />
    {/each}
  {/each}
  {#if press?.drew}
    <path class="stroke" d={stroke_path(press.points)} />
  {/if}
</svg>
{#each shown.filter((comment) => comment.pin.panel === panel) as comment (pin_id(comment))}
  <div class="pin" class:dimmed={is_dimmed(comment)} data-pin={pin_id(comment)} style:left="{comment.pin.x}px" style:top="{comment.pin.y}px">
    {number_of(comment)}
  </div>
{/each}
