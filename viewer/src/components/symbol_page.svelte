<script lang="ts">
  import { select_stage, toggle_real_code, view } from "../state/navigation.svelte";
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

{#if trace_root !== undefined}
  <div class="called_name_row of_page">
    <div class="called_name" title="Called in the trace of {trace_root.id}"><SymbolLink id={symbol.id} /></div>
  </div>
{/if}
<div class="code_header">
  {#if symbol.kind === "flow"}
    <div class="page_kicker">Flow</div>
    <div class="page_name">{symbol.id}</div>
  {:else if is_own_page && symbol.kind !== "route"}
    <div class="code_name"><SymbolLink id={symbol.id} /></div>
  {/if}
  <DocText doc={symbol.doc} doc_before={symbol.diff?.doc_before} class_name="code_doc" focused={focus === "doc"} />
  {#if has_source && !has_pseudo}
    <button class="code_toggle on" disabled title="There is no pseudo-code yet, so this shows the real code" aria-label="Real code"><svg class="code_icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5 1 8l3.5 3.5M11.5 4.5 15 8l-3.5 3.5M9.5 2.5l-3 11" /></svg></button>
  {:else if has_source}
    <button
      class="code_toggle"
      class:on={view.real_code}
      data-real-toggle
      title={view.real_code ? "Show the pseudo-code" : "Show the real code"}
      aria-label="Real code"
      onclick={toggle_real_code}><svg class="code_icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5 1 8l3.5 3.5M11.5 4.5 15 8l-3.5 3.5M9.5 2.5l-3 11" /></svg></button
    >
  {/if}
</div>

{#if shows_real_code}
  <div class="source_row">
    <span class="file_chip" title="Lines {symbol.src.start}–{symbol.src.end}">{symbol.src.path}</span>
    {#if !has_pseudo}<span class="no_pseudo_note">No pseudo-code yet</span>{/if}
  </div>
  <RealCode {symbol} with_diff={has_pseudo} />
{:else}
  <StageLines {symbol} {selected_step} with_diff={is_own_page} {focus} on_select={select_stage} />
{/if}
