<script lang="ts">
  import { KIND_LABELS, symbol_of } from "../map/catalog";
  import { current, go } from "../state/navigation.svelte";
  import { show_real_code, type TooltipState } from "../state/overlays.svelte";

  let { tooltip }: { tooltip: TooltipState } = $props();

  const EDGE_GAP = 8;
  const ANCHOR_GAP = 6;
  let element: HTMLDivElement | undefined = $state();
  let position = $state({ left: 0, top: 0 });

  const symbol = $derived(symbol_of(tooltip.id));
  const can_open = $derived(symbol !== undefined && symbol.kind !== "term" && symbol.id !== current().id);

  $effect(() => {
    const frame = element?.offsetParent?.getBoundingClientRect();
    const tip = element?.getBoundingClientRect();
    if (frame === undefined || tip === undefined) {
      return;
    }
    const anchor = tooltip.anchor;
    const left = Math.max(EDGE_GAP, Math.min(anchor.left - frame.left, frame.width - tip.width - EDGE_GAP));
    let top = anchor.bottom - frame.top + ANCHOR_GAP;
    const fits_above = anchor.top - frame.top > tip.height + EDGE_GAP;
    if (top + tip.height > frame.height - EDGE_GAP && fits_above) {
      top = anchor.top - frame.top - tip.height - ANCHOR_GAP;
    }
    position = { left, top: Math.max(EDGE_GAP, Math.min(top, frame.height - tip.height - EDGE_GAP)) };
  });
</script>

{#if symbol !== undefined}
  <div class="tooltip" bind:this={element} style:left="{position.left}px" style:top="{position.top}px">
    <div class="panel_label">{KIND_LABELS[symbol.kind]}</div>
    <div class="tooltip_name">{symbol.id}</div>
    <div class="tooltip_doc">{symbol.doc}</div>
    {#if symbol.src.path !== ""}
      <div class="tooltip_path">{symbol.src.path}:{symbol.src.start}</div>
    {/if}
    <div class="tooltip_actions">
      {#if can_open}
        <button class="bar_button" data-go={symbol.id} onclick={() => go(symbol.id)}>
          {symbol.pseudo.length > 0 ? "Pseudo-code" : "Open"}<span class="key">⌘ click</span>
        </button>
      {/if}
      {#if symbol.src.path !== ""}
        <button class="bar_button" data-real={symbol.id} onclick={() => show_real_code(symbol.id)}>Real code<span class="key">⌘⇧ click</span></button>
      {/if}
    </div>
  </div>
{/if}
