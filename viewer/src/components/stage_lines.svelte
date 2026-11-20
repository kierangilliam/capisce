<script lang="ts">
  import { symbol_of } from "../map/catalog";
  import { prose_tokens, pseudo_tokens } from "../map/pseudo_tokens";
  import { last_block_of, stage_blocks, type StageBlock } from "../map/stage_blocks";
  import { steps_of } from "../map/steps";
  import type { MapSymbol } from "../types";
  import Peek from "./peek.svelte";
  import PseudoLine from "./pseudo_line.svelte";

  type Props = {
    symbol: MapSymbol;
    selected_step?: number;
    with_diff?: boolean;
    focus?: string;
    on_select?: (step: number) => void;
  };
  let { symbol, selected_step, with_diff = false, focus, on_select }: Props = $props();

  const prose = $derived(symbol.kind === "flow");
  const blocks = $derived(stage_blocks(symbol, with_diff));
  const has_stages = $derived(blocks.some((block) => block.has_label));
  const peek_after = $derived(last_block_of(blocks, selected_step));
  const peek_target = $derived(symbol_of(steps_of(symbol)[selected_step ?? -1]?.target));

  const is_selectable = (block: StageBlock) => on_select !== undefined && block.step !== undefined;
  const is_focused_label = (block: StageBlock) => block.has_label && focus === `step:${block.title}`;
  const tokens_of = (text: string) => {
    if (prose) {
      return prose_tokens(text.trim());
    }
    return pseudo_tokens(text, symbol);
  };

  function stage_clicked(block: StageBlock) {
    const has_selected_text = window.getSelection()?.isCollapsed === false;
    if (is_selectable(block) && block.step !== undefined && !has_selected_text) {
      on_select?.(block.step);
    }
  }
</script>

<div class="lines" class:prose class:no_stages={!has_stages}>
  {#each blocks as block, index}
    <div
      class="stage"
      class:in_step={is_selectable(block)}
      class:selected={is_selectable(block) && block.step === selected_step}
      data-step={is_selectable(block) ? block.step : undefined}
      role="presentation"
      onclick={() => stage_clicked(block)}
    >
      <div class="stage_label {block.has_label ? block.mark : ''}" class:focused={is_focused_label(block)} data-title={block.has_label ? block.title : undefined}>
        {#if block.has_label}<span class="stage_title">{block.title}</span>{#if block.mark !== ""}<span class="stage_change">{block.mark}</span>{/if}{/if}
      </div>
      <div class="stage_body">
        {#each block.lines as line}
          <div class="line {line.mark}" class:focused={focus === "pseudo" && line.mark !== ""}><PseudoLine tokens={tokens_of(line.text)} /></div>
        {/each}
      </div>
    </div>
    {#if index === peek_after && peek_target !== undefined}
      <div class="stage peek_row">
        <div class="stage_label"></div>
        <Peek target={peek_target} />
      </div>
    {/if}
  {/each}
</div>
