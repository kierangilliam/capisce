<script lang="ts">
  import { screenshot_url } from "../state/api";

  let { names, remove }: { names: string[]; remove?: (name: string) => void } = $props();
</script>

{#if names.length > 0}
  <div class="pictures">
    {#each names as name (name)}
      <span class="picture">
        <a href={screenshot_url(name)} target="_blank" rel="noreferrer"><img src={screenshot_url(name)} alt="Attached to the comment" /></a>
        {#if remove !== undefined}
          <button class="picture_remove" title="Remove this picture" onclick={() => remove(name)}>×</button>
        {/if}
      </span>
    {/each}
  </div>
{/if}
