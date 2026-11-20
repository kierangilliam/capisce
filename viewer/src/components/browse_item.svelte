<script lang="ts">
  import { bare_name } from "../map/catalog";
  import { open_from_browse } from "../state/navigation.svelte";
  import { overlays } from "../state/overlays.svelte";
  import type { MapSymbol } from "../types";

  let { symbol, current_id }: { symbol: MapSymbol; current_id: string } = $props();

  const method = $derived(symbol.id.split(" ")[0]);
  const path = $derived(symbol.id.split(" ").slice(1).join(" "));

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
  {:else}
    <span class="browse_name">{bare_name(symbol.id)}</span>
  {/if}
</button>
