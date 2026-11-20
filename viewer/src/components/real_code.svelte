<script lang="ts">
  import { real_code_rows } from "../map/real_code_tokens";
  import type { MapSymbol } from "../types";

  let { symbol, with_diff }: { symbol: MapSymbol; with_diff: boolean } = $props();

  const rows = $derived(real_code_rows(symbol, with_diff));
</script>

<div class="real_code">
  {#each rows as row}
    <span class="line_number">{row.gutter}</span>
    <span class="real_line {row.mark}">{#each row.tokens as token}{#if token.kind === "text"}{token.text}{:else}<span class={token.kind}>{token.text}</span>{/if}{/each}</span>
  {/each}
</div>
