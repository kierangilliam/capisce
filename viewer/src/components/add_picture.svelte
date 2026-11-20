<script lang="ts">
  import { add_pictures } from "../state/comments.svelte";

  let { added }: { added: (names: string[]) => void } = $props();

  async function chosen(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    added(await add_pictures(input.files ?? []));
    input.value = "";
  }
</script>

<label class="text_button add_picture">
  Add picture<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onchange={chosen} />
</label>
