<script lang="ts">
  import { browse_groups, browse_modules } from "../map/browse";
  import { CANVAS_PAGE, catalog, domain_page } from "../map/catalog";
  import { context_domain, current, open_from_browse } from "../state/navigation.svelte";
  import { overlays } from "../state/overlays.svelte";
  import BrowseItem from "./browse_item.svelte";

  const domain = $derived(context_domain());
  const current_id = $derived(current().id);

  function open(id: string) {
    overlays.menu_open = false;
    void open_from_browse(id);
  }
</script>

<aside class="browse">
  {#if domain === undefined}
    <div class="group_title">Domains</div>
    {#each catalog.data.domains as each}
      <button class="browse_item" data-route={domain_page(each.id)} onclick={() => open(domain_page(each.id))}>
        <span class="browse_name">{each.id}</span>
      </button>
    {/each}
  {:else}
    <button class="browse_home" data-route={CANVAS_PAGE} onclick={() => open(CANVAS_PAGE)}>‹ Domains</button>
    <button class="browse_title" data-route={domain_page(domain.id)} onclick={() => open(domain_page(domain.id))}>{domain.id}</button>
    {#each browse_groups(domain) as group}
      <div class="group_title">{group.title}</div>
      {#each group.symbols as symbol (symbol.id)}
        <BrowseItem {symbol} {current_id} />
      {/each}
    {/each}
    {#if browse_modules(domain).length > 0}
      <div class="group_title">Functions</div>
    {/if}
    {#each browse_modules(domain) as module (module.name)}
      <details class="browse_module" open={module.symbols.some((symbol) => symbol.id === current_id)}>
        <summary>{module.name} <span class="counts">{module.symbols.length}</span></summary>
        {#each module.symbols as symbol (symbol.id)}
          <BrowseItem {symbol} {current_id} />
        {/each}
      </details>
    {/each}
  {/if}
</aside>
