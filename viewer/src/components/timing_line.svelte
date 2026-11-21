<script lang="ts">
  import { duration_text, no_requests_text, requests_text } from "../map/timing_text";
  import { timings } from "../state/timings.svelte";

  let { id }: { id: string } = $props();

  const row = $derived(timings.rows.get(id));
  const from = $derived(timings.source === "" ? "Timings" : `Timings from ${timings.source}`);
</script>

{#snippet numbers(typical: number, slow: number, count: number)}
  <b>{duration_text(typical)}</b> typical · <b>{duration_text(slow)}</b> slow · {requests_text(count, timings.window)}
{/snippet}

{#if row === undefined}
  <div class="timing_line" data-timing-line title={from}>{no_requests_text(timings.window)}</div>
{:else if row.link !== undefined}
  <a class="timing_line" data-timing-line title="{from}. Opens the traces." href={row.link} target="_blank" rel="noreferrer">
    {@render numbers(row.p50_ms, row.p95_ms, row.count)}
  </a>
{:else}
  <div class="timing_line" data-timing-line title={from}>{@render numbers(row.p50_ms, row.p95_ms, row.count)}</div>
{/if}
