<script lang="ts">
  import type { Token } from "../map/pseudo_tokens";
  import SymbolLink from "./symbol_link.svelte";
  import PseudoLine from "./pseudo_line.svelte";

  let { tokens }: { tokens: Token[] } = $props();
</script>

{#each tokens as token}{#if token.kind === "symbol"}<SymbolLink id={token.id} text={token.text} />{:else if token.kind === "comment"}<span class="comment"><PseudoLine tokens={token.parts} /></span>{:else if token.kind === "text"}{token.text}{:else}<span class={token.kind}>{token.text}</span>{/if}{/each}
