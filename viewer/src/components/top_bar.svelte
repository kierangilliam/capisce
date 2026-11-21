<script lang="ts">
  import { catalog, crumb_label } from "../map/catalog";
  import { comments, unread_count } from "../state/comments.svelte";
  import { go_to_entry, nav, open_changes } from "../state/navigation.svelte";
  import { notes } from "../state/notes.svelte";
  import { overlays } from "../state/overlays.svelte";
  import { set_commenting, set_noting } from "../state/side_panes";
  import { set_timings_on, timings } from "../state/timings.svelte";

  const open_count = (list: { status: string }[]) => list.filter((each) => each.status === "open").length;
  const count_label = (count: number) => {
    if (count === 0) {
      return "";
    }
    return ` (${count})`;
  };
</script>

<header class="bar">
  <button class="bar_button menu_button" class:on={overlays.menu_open} onclick={() => (overlays.menu_open = !overlays.menu_open)}>Browse</button>
  <button class="bar_button" title="Back" disabled={nav.at <= 0} onclick={() => go_to_entry(nav.at - 1)}>←</button>
  <button class="bar_button" title="Forward" disabled={nav.at >= nav.entries.length - 1} onclick={() => go_to_entry(nav.at + 1)}>→</button>
  <nav class="crumbs">
    {#each nav.entries.slice(0, nav.at + 1) as crumb, index}
      <button class="crumb" data-crumb={index} onclick={() => go_to_entry(index)}>{crumb_label(crumb.id)}</button>
    {/each}
  </nav>
  {#if catalog.changes !== undefined}
    <button class="bar_button" data-changes onclick={open_changes}>Changes ({catalog.changes.ids.length})</button>
  {/if}
  {#if timings.available}
    <button class="bar_button pane_button" class:on={timings.on} data-timings aria-pressed={timings.on} onclick={() => set_timings_on(!timings.on)}>
      Timings<span class="key">Tab</span>
    </button>
  {/if}
  {#if notes.available}
    <button class="bar_button pane_button" class:on={notes.on} data-notes onclick={() => set_noting(!notes.on)}>
      Notes{count_label(open_count(notes.list))}<span class="key">N</span>
    </button>
  {/if}
  {#if comments.available}
    <button class="bar_button pane_button" class:on={comments.on} data-comments onclick={() => set_commenting(!comments.on)}>
      Comments{count_label(open_count(comments.list))}{#if unread_count() > 0}<span class="unread_dot" title="New replies"></span>{/if}<span class="key">C</span>
    </button>
  {/if}
</header>
