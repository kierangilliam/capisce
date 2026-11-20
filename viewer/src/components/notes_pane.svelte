<script lang="ts">
  import { delete_note, notes, save_note, set_note_status } from "../state/notes.svelte";
</script>

<aside class="side_pane" data-pane="notes">
  <div class="panel_label">Notes</div>
  <div class="comment_note">Ideas and things to do later, about the map as a whole.</div>
  <textarea class="comment_input" data-note-input placeholder="Add a note" bind:value={notes.draft}></textarea>
  {#if notes.error !== ""}
    <div class="comment_note" role="alert">{notes.error}</div>
  {/if}
  <div class="comment_row">
    <button class="bar_button" data-note-save onclick={save_note}>Save<span class="key">⌘↵</span></button>
  </div>
  {#each notes.list as note (note.id)}
    <div class="saved_comment {note.status}" data-note={note.id}>
      <div class="comment_text">{note.text}</div>
      <div class="comment_row">
        {#if note.status === "done"}
          <button class="text_button" data-note-status="open" onclick={() => set_note_status(note.id, "open")}>Reopen</button>
        {:else}
          <button class="text_button" data-note-status="done" onclick={() => set_note_status(note.id, "done")}>Mark done</button>
        {/if}
        <button class="text_button" data-note-delete onclick={() => delete_note(note.id)}>Delete</button>
        <span class="comment_note">{note.created_at.slice(0, 10)}</span>
      </div>
    </div>
  {/each}
</aside>
