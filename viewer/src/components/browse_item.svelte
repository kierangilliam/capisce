<script lang="ts">
  import { bare_name } from "../map/catalog";
  import { open_from_browse } from "../state/navigation.svelte";
  import { duration_text } from "../map/timing_text";
  import { overlays } from "../state/overlays.svelte";
  import { timings } from "../state/timings.svelte";
  import type { MapSymbol } from "../types";

  let { symbol, current_id }: { symbol: MapSymbol; current_id: string } = $props();

  const method = $derived(symbol.id.split(" ")[0]);
  const path = $derived(symbol.id.split(" ").slice(1).join(" "));
  const timing = $derived(timings.on ? timings.rows.get(symbol.id) : undefined);

  function open() {
    overlays.menu_open = false;
    void open_from_browse(symbol.id);
  }
</script>

<button
  class="browse_item"
  class:current={symbol.id === current_id}
  class:unmapped={symbol.pseudo.length === 0}
  class:changed_item={symbol.diff !== undefined}
  class:removed_item={symbol.diff?.status === "removed"}
  data-route={symbol.id}
  onclick={open}
>
  {#if symbol.kind === "route"}
    <span class="method">{method}</span><span class="browse_name">{path}</span>
    {#if timing !== undefined}<span class="browse_time" data-browse-time>{duration_text(timing.p50_ms)}</span>{/if}
  {:else}
    <span class="browse_name">{bare_name(symbol.id)}</span>
  {/if}
</button>
