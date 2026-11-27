<script lang="ts">
  import { symbol_of } from "../map/catalog";
  import { row_of_step, trace_of, type TraceRow } from "../map/trace";
  import { TRACE, trace_drawing, type ArrowHead } from "../map/trace_layout";
  import { trace_fonts } from "../state/fonts";
  import { go, select_trace_row, type Entry } from "../state/navigation.svelte";
  import type { MapSymbol } from "../types";

  let { symbol, entry }: { symbol: MapSymbol; entry: Entry } = $props();

  const HEAD_LENGTH = 7;
  const HEAD_HALF_WIDTH = 3.5;
  const fonts = trace_fonts();

  const trace = $derived(trace_of(symbol));
  const drawing = $derived(trace_drawing(trace, fonts));
  const selected_row = $derived(entry.trace ?? row_of_step(trace, 0, entry.step));
  const changed_steps = $derived(new Map(symbol.diff?.steps?.map(([op, title]) => [title, op])));

  const head_points = ({ x, y, direction }: ArrowHead) =>
    `${x},${y} ${x - HEAD_LENGTH * direction},${y - HEAD_HALF_WIDTH} ${x - HEAD_LENGTH * direction},${y + HEAD_HALF_WIDTH}`;
  const is_own_step = (row: TraceRow) => row.instance === 0;
  const change_of = (row: TraceRow) => {
    if (!is_own_step(row)) {
      return " ";
    }
    return changed_steps.get(row.title) ?? " ";
  };
  const drill_target = (row: TraceRow) => {
    const target = symbol_of(row.target);
    if (target === undefined || target.kind === "term") {
      return undefined;
    }
    return target.id;
  };
  function drill(row: TraceRow) {
    const target = drill_target(row);
    if (target !== undefined) {
      void go(target);
    }
  }
</script>

<!-- The module names again, pinned to the top of the panel as it scrolls; the SVG's own heads sit under them. -->
<div class="trace_heads" style:width="{drawing.width}px" style:height="{drawing.head_height}px" style:margin-bottom="-{drawing.head_height}px" aria-hidden="true">
  {#each drawing.lanes as lane}
    <div class="trace_heads_cell" style:left="{lane.x - TRACE.lane_gap / 2}px" style:width="{TRACE.lane_gap}px">
      {#each lane.lines as line}<span>{line}</span>{/each}
    </div>
  {/each}
</div>
<svg class="trace" width={drawing.width} height={drawing.height} viewBox="0 0 {drawing.width} {drawing.height}">
  <!-- Swimlanes: a column per module, every other one banded, divided by hairlines. -->
  {#each drawing.lanes as lane, lane_index}
    <rect
      class="lane_band"
      class:odd={lane_index % 2 === 1}
      x={lane.x - TRACE.lane_gap / 2}
      y="0"
      width={TRACE.lane_gap}
      height={drawing.height}
    />
    <line class="lane_divider" x1={lane.x + TRACE.lane_gap / 2} y1="0" x2={lane.x + TRACE.lane_gap / 2} y2={drawing.height} />
    <line class="lane_line" x1={lane.x} y1={drawing.head_height} x2={lane.x} y2={drawing.height} />
  {/each}
  {#each drawing.lanes as lane}
    <g class="lane_head">
      <rect x={lane.x - TRACE.lane_gap / 2} y="0" width={TRACE.lane_gap} height={drawing.head_height} />
      {#each lane.lines as line, line_index}
        <text x={lane.x} y={lane.first_line_y + line_index * TRACE.head_line_height}>{line}</text>
      {/each}
    </g>
  {/each}
  <line class="lane_head_rule" x1="0" y1={drawing.head_height} x2={drawing.width} y2={drawing.head_height} />
  {#each drawing.bars as bar}
    <rect class="trace_bar" x={bar.x} y={bar.y} width={TRACE.bar_width} height={bar.height} rx={TRACE.bar_width / 2} />
  {/each}
  {#each drawing.rows as drawn (drawn.index)}
    {#if drawn.row.kind === "return"}
      <g>
        <path class="trace_return" d={drawn.arrow_path} />
        {#if drawn.arrow_head !== undefined}<polygon class="trace_return_head" points={head_points(drawn.arrow_head)} />{/if}
      </g>
    {:else}
      <g
        class="trace_row"
        class:selected={drawn.index === selected_row}
        class:added={change_of(drawn.row) === "+"}
        class:changed={change_of(drawn.row) === "~"}
        data-trace={drawn.index}
        data-step={is_own_step(drawn.row) ? drawn.row.step : undefined}
        data-title={drawn.row.title}
        data-drill={drill_target(drawn.row)}
        role="button"
        tabindex="-1"
        onclick={() => select_trace_row(drawn.index)}
        ondblclick={() => drill(drawn.row)}
      >
        <rect class="trace_hit" x="0" y={drawn.top} width={drawing.width} height={drawn.height} />
        <rect class="trace_mark" x="0" y={drawn.top} width="2" height={drawn.height} />
        {#if drawn.branch}
          <path class="trace_branch" d={drawn.arrow_path} />
        {:else if drawn.arrow_head !== undefined}
          <path class="trace_arrow" d={drawn.arrow_path} />
          <polygon class="trace_head" points={head_points(drawn.arrow_head)} />
        {/if}
        {#if drawn.stop !== undefined}
          <circle class="trace_stop" cx={drawn.stop.x} cy={drawn.stop.y} r="3.5" />
        {/if}
        {#if drawn.note !== undefined}
          <rect class="trace_note" x={drawn.note.x} y={drawn.note.y} width={drawn.note.width} height={drawn.note.height} rx="3" />
        {/if}
        {#if drawn.label_box !== undefined}
          <rect
            class="trace_note trace_call_box"
            x={drawn.label_box.x}
            y={drawn.label_box.y}
            width={drawn.label_box.width}
            height={drawn.label_box.height}
            rx="3"
          />
        {/if}
        {#each drawn.text.lines as line, line_index}
          <text class="trace_label" x={drawn.text.x} y={drawn.text.y + line_index * TRACE.line_height}>{line}</text>
        {/each}
        {#each drawn.exits as exit}
          <g class="trace_exit">
            <rect x={exit.x} y={exit.y} width={exit.width} height={TRACE.exit_height} rx="3" />
            <text x={exit.x + 5} y={exit.y + 11.5}>{exit.text}</text>
          </g>
        {/each}
      </g>
    {/if}
  {/each}
</svg>
