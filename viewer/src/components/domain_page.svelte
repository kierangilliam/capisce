<script lang="ts">
  import { catalog, domain_page } from "../map/catalog";
  import { go } from "../state/navigation.svelte";
  import type { Domain } from "../types";
  import DocText from "./doc_text.svelte";
  import SymbolLink from "./symbol_link.svelte";

  let { domain, focus }: { domain: Domain; focus: string | undefined } = $props();

  const flows = $derived(catalog.data.symbols.filter((symbol) => symbol.domain === domain.id && symbol.kind === "flow"));
  const data_links = $derived.by(() => {
    const own_models = new Set(domain.models);
    return catalog.data.data_links.filter((link) => own_models.has(link.from) !== own_models.has(link.to));
  });
  const changed_relations = $derived(domain.diff?.relations ?? []);
  const removed_relations = $derived(changed_relations.filter(([op]) => op === "-").map(([, name]) => name));
  const outgoing = $derived([...domain.relations, ...domain.more]);
  const incoming = $derived(
    catalog.data.domains.flatMap((other) =>
      [...other.relations, ...other.more].filter((relation) => relation.to === domain.id).map((relation) => ({ from: other.id, label: relation.label })),
    ),
  );
  const is_new = (label: string, to: string) => changed_relations.some(([op, name]) => op === "+" && name === `${label} ${to}`);
  const focus_relations = $derived(focus === "relations");
</script>

<div class="page">
  <div class="page_title">
    <div class="page_name">{domain.id}</div>
    <DocText doc={domain.doc} doc_before={domain.diff?.doc_before} class_name="page_doc" focused={focus === "doc"} />
  </div>

  {#if flows.length > 0}
    <div>
      <div class="panel_label">Flows</div>
      <div class="flow_cards">
        {#each flows as flow (flow.id)}
          <button class="flow_card" data-go={flow.id} onclick={() => go(flow.id)}>
            <span class="domain_name">{flow.id}</span>
            <span class="domain_tag">{flow.doc}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div>
    <div class="panel_label">Relations</div>
    {#if domain.frame}
      <div class="relation"><span class="relation_label">Every other domain sits inside {domain.id}.</span></div>
    {:else}
      {#each removed_relations as name}
        <div class="relation removed" class:focused={focus_relations}><span class="relation_label">{name}</span></div>
      {/each}
      {#each outgoing as relation}
        {@const added = is_new(relation.label, relation.to)}
        <div class="relation" class:added class:focused={focus_relations && added}>
          <span class="relation_label">{relation.label}</span>
          <button class="relation_domain" data-go={domain_page(relation.to)} onclick={() => go(domain_page(relation.to))}>{relation.to}</button>
        </div>
      {/each}
      {#each incoming as relation}
        <div class="relation">
          <button class="relation_domain" data-go={domain_page(relation.from)} onclick={() => go(domain_page(relation.from))}>{relation.from}</button>
          <span class="relation_label">{relation.label}</span>
        </div>
      {/each}
    {/if}
    {#if data_links.length > 0}
      <details class="data_links">
        <summary>{data_links.length} columns link its models to other domains</summary>
        {#each data_links as link}
          <div><SymbolLink id={link.from} />.{link.field} → <SymbolLink id={link.to} /></div>
        {/each}
      </details>
    {/if}
  </div>

  <div>
    <div class="panel_label">Models</div>
    <div class="boxes">
      {#each domain.models as name}
        <button class="model_box" data-go={name} onclick={() => go(name)}>{name}</button>
      {/each}
    </div>
  </div>
</div>
