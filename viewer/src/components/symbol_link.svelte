<script lang="ts">
  import { symbol_of } from "../map/catalog";
  import { symbol_clicked } from "../state/symbol_clicks";

  let { id, text = id }: { id: string; text?: string } = $props();

  const symbol = $derived(symbol_of(id));
  const module_cut = $derived(symbol?.kind === "def" ? text.lastIndexOf(".") : -1);
</script>

<span class="symbol {symbol?.kind}" data-symbol={id} role="link" tabindex="-1" onclick={(event) => symbol_clicked(event, id)}>{#if module_cut > 0}<span class="module">{text.slice(0, module_cut)}</span>{text.slice(module_cut)}{:else}{text}{/if}</span>
