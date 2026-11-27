<script lang="ts">
  import { crumb_label } from "../map/catalog";
  import { change_groups } from "../map/changes";
  import { open_change } from "../state/navigation.svelte";
  import type { Changes } from "../types";

  let { changes }: { changes: Changes } = $props();

  const groups = change_groups();
</script>

<div class="page">
  <div class="page_title">
    <div class="page_kicker">{changes.head} → {changes.base}</div>
    <div class="page_name">Changes</div>
    <p class="page_doc">What {changes.head} changes, compared with {changes.base}. Click a part to see it.</p>
    {#if changes.needs_review}
      <p class="page_doc">Some pseudo-code has not been reviewed since its code changed. Run <code>capisce check</code> for the list.</p>
    {/if}
    {#if changes.ids.length === 0}
      <p class="page_doc">Nothing in the map changed.</p>
    {/if}
  </div>
  {#each groups as group (group.name)}
    <div>
      <div class="change_group">{group.name}</div>
      {#each group.things as thing (thing.id)}
        <div class="change">
          <div class="change_head">
            <button class="change_name" data-change={thing.id} onclick={() => open_change(thing.id, undefined)}>{crumb_label(thing.id)}</button>
            <span class="change_status">{thing.status_line}</span>
          </div>
          <div class="change_parts">
            {#each thing.chips as chip}
              <button class="chip {chip.tone}" data-change={thing.id} data-part={chip.part} onclick={() => open_change(thing.id, chip.part || undefined)}>
                {chip.label}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/each}
</div>
