<script lang="ts">
  let { doc, doc_before, class_name, focused = false }: { doc: string; doc_before?: string; class_name: string; focused?: boolean } =
    $props();
</script>

{#if doc_before === undefined}
  <p class={class_name} class:focused>{doc}</p>
{:else}
  {#if doc_before !== ""}
    <p class="{class_name} removed" class:focused>{doc_before}</p>
  {/if}
  <p class="{class_name} added" class:focused>{doc}</p>
{/if}
