<script lang="ts">
  import { overlays } from "../state/overlays.svelte";
  import type { MapSymbol } from "../types";
  import RealCode from "./real_code.svelte";

  let { symbol }: { symbol: MapSymbol } = $props();

  const close = () => (overlays.real_code_of = undefined);
  function backdrop_clicked(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }
</script>

<div class="modal_backdrop" role="presentation" onclick={backdrop_clicked}>
  <div class="modal">
    <div class="modal_header">
      <div class="modal_title">{symbol.src.path}:{symbol.src.start}-{symbol.src.end}</div>
      <button class="bar_button" data-close onclick={close}>Close<span class="key">esc</span></button>
    </div>
    <div class="modal_code"><RealCode {symbol} with_diff={true} /></div>
  </div>
</div>
