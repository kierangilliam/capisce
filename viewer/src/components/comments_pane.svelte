<script lang="ts">
  import { comments, delete_comment, number_of, place_label, set_comment_status, show_comment } from "../state/comments.svelte";
</script>

<aside class="side_pane" data-pane="comments" onmouseleave={() => (comments.focused = undefined)}>
  <div class="panel_label">Comments</div>
  <div class="comment_note">Click anywhere on the trace or the code to leave a note. Drag to draw. Press C to finish.</div>
  {#if comments.error !== ""}
    <div class="comment_note" role="alert">{comments.error}</div>
  {/if}
  {#each comments.list as comment (comment.id)}
    <div
      class="saved_comment {comment.status}"
      class:is_focused={comments.focused === comment.id}
      data-comment={comment.id}
      role="listitem"
      onmouseenter={() => (comments.focused = comment.id)}
    >
      <button class="comment_where" data-comment-go onclick={() => show_comment(comment)}>
        <span class="comment_number">{number_of(comment)}</span>{place_label(comment)}
      </button>
      {#if comment.target !== ""}
        <div class="comment_target">{comment.target}</div>
      {/if}
      <div class="comment_text">{comment.text}</div>
      {#if comment.reply}
        <div class="comment_reply">Reply: {comment.reply}</div>
      {/if}
      <div class="comment_row">
        {#if comment.status === "done"}
          <button class="text_button" data-comment-status="open" onclick={() => set_comment_status(comment.id, "open")}>Reopen</button>
        {:else}
          <button class="text_button" data-comment-status="done" onclick={() => set_comment_status(comment.id, "done")}>Mark done</button>
        {/if}
        <button class="text_button" data-comment-delete onclick={() => delete_comment(comment.id)}>Delete</button>
        {#if comment.strokes.length > 0}
          <span class="comment_note">drawing</span>
        {/if}
      </div>
    </div>
  {/each}
</aside>
