<script lang="ts">
  import { go, select_stage, toggle_real_code, view } from "../state/navigation.svelte";
  import type { MapSymbol } from "../types";
  import DocText from "./doc_text.svelte";
  import RealCode from "./real_code.svelte";
  import StageLines from "./stage_lines.svelte";
  import SymbolLink from "./symbol_link.svelte";

  type Props = { symbol: MapSymbol; selected_step: number | undefined; trace_root: MapSymbol | undefined; focus: string | undefined };
  let { symbol, selected_step, trace_root, focus }: Props = $props();

  const has_source = $derived(symbol.src.path !== "");
  const has_pseudo = $derived(symbol.pseudo.length > 0);
  const shows_real_code = $derived(has_source && (!has_pseudo || view.real_code));
  const is_own_page = $derived(trace_root === undefined);
</script>

<div class="code_header">
  {#if trace_root !== undefined}
    <div class="trace_context">
      Called in the trace of {trace_root.id}.
      <button class="peek_open" data-go={symbol.id} onclick={() => go(symbol.id)}>Open on its own ›</button>
    </div>
  {/if}
  {#if symbol.kind === "flow"}
    <div class="page_name">{symbol.id}</div>
  {:else if symbol.kind !== "route" || !is_own_page}
    <div class="code_name"><SymbolLink id={symbol.id} /></div>
  {/if}
  <DocText doc={symbol.doc} doc_before={symbol.diff?.doc_before} class_name="code_doc" focused={focus === "doc"} />
  {#if has_source && !has_pseudo}
    <button class="code_toggle on" disabled title="There is no pseudo-code yet, so this shows the real code">&lt;/&gt;</button>
  {:else if has_source}
    <button
      class="code_toggle"
      class:on={view.real_code}
      data-real-toggle
      title={view.real_code ? "Show the pseudo-code" : "Show the real code"}
      onclick={toggle_real_code}>&lt;/&gt;</button
    >
  {/if}
</div>

{#if shows_real_code && !has_pseudo}
  <div class="no_pseudo">No pseudo-code yet. This is the real code, from {symbol.src.path}.</div>
  <RealCode {symbol} with_diff={false} />
{:else if shows_real_code}
  <div class="no_pseudo">The real code, from {symbol.src.path}.</div>
  <RealCode {symbol} with_diff={true} />
{:else}
  <StageLines {symbol} {selected_step} with_diff={is_own_page} {focus} on_select={select_stage} />
{/if}
