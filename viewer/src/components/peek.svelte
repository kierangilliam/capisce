<script lang="ts">
  import { go } from "../state/navigation.svelte";
  import type { MapSymbol } from "../types";
  import StageLines from "./stage_lines.svelte";
  import SymbolLink from "./symbol_link.svelte";

  let { target }: { target: MapSymbol } = $props();
</script>

<div class="peek" role="presentation" onclick={(event) => event.stopPropagation()}>
  <div class="peek_header">
    <SymbolLink id={target.id} />
    {#if target.pseudo.length > 0}
      <button class="peek_open" data-go={target.id} onclick={() => go(target.id)}>open ›</button>
    {/if}
  </div>
  <div class="peek_doc">{target.doc}</div>
  {#if target.pseudo.length > 0}
    <StageLines symbol={target} />
  {/if}
</div>
