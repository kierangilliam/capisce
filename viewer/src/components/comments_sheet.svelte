<script lang="ts">
  import {
    add_pictures,
    comments,
    delete_comment,
    number_of,
    open_thread,
    pictures_in,
    place_label,
    send_reply,
    set_comment_status,
    set_comment_unread,
    show_comment,
  } from "../state/comments.svelte";
  import { set_commenting } from "../state/side_panes";
  import type { SavedComment } from "../types";
  import AddPicture from "./add_picture.svelte";
  import Pictures from "./pictures.svelte";

  const DAY_MS = 86_400_000;
  let reply = $state({ text: "", images: [] as string[] });

  /** Open comments, new replies, and the thread being read: reading a finished one does not make it jump away. */
  let kept: string | undefined = $state();
  const is_current = (comment: SavedComment) => comment.status === "open" || comment.unread || comment.id === kept;
  const current_list = $derived(comments.list.filter(is_current));
  const older_list = $derived(comments.list.filter((comment) => !is_current(comment)));

  /** Older comments under the day, week or month they were left in, newest first. */
  const older_groups = $derived.by(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    const groups = new Map<string, SavedComment[]>();
    for (const comment of [...older_list].reverse()) {
      const left = new Date(comment.created_at);
      const days_ago = Math.floor((today - new Date(left).setHours(0, 0, 0, 0)) / DAY_MS);
      let label = left.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (days_ago <= 0) {
        label = "Today";
      } else if (days_ago === 1) {
        label = "Yesterday";
      } else if (days_ago < 7) {
        label = "Earlier this week";
      }
      groups.set(label, [...(groups.get(label) ?? []), comment]);
    }
    return [...groups];
  });

  const author_label = (author: string) => {
    if (author === "agent") {
      return "Reply";
    }
    return "You";
  };

  function toggle(comment: SavedComment) {
    if (comments.opened === comment.id) {
      comments.opened = undefined;
      return;
    }
    reply = { text: "", images: [] };
    if (is_current(comment)) {
      kept = comment.id;
    }
    open_thread(comment);
    void show_comment(comment);
  }

  async function send(comment: SavedComment) {
    await send_reply(comment.id, reply.text, reply.images);
    if (comments.error === "") {
      reply = { text: "", images: [] };
    }
  }

  async function pasted(event: ClipboardEvent) {
    const files = pictures_in(event);
    if (files.length > 0) {
      event.preventDefault();
      reply.images.push(...(await add_pictures(files)));
    }
  }

  function reply_key(event: KeyboardEvent, comment: SavedComment) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.stopPropagation();
      void send(comment);
    }
  }
</script>

{#snippet card(comment: SavedComment)}
  {@const is_open = comments.opened === comment.id}
  <div
    class="saved_comment {comment.status}"
    class:is_focused={comments.focused === comment.id}
    class:is_opened={is_open}
    class:is_unread={comment.unread}
    data-comment={comment.id}
    role="listitem"
    onmouseenter={() => (comments.focused = comment.id)}
  >
    <button class="comment_head" data-comment-open onclick={() => toggle(comment)}>
      <span class="comment_where">
        <span class="comment_number">{number_of(comment)}</span>{place_label(comment)}
        {#if comment.unread}<span class="unread_mark" title="New reply">New reply</span>{/if}
      </span>
      <span class="comment_text" class:clipped={!is_open}>{comment.text}</span>
      {#if !is_open && comment.replies.length > 0}
        <span class="comment_note">{comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}</span>
      {/if}
    </button>
    {#if is_open}
      {#if comment.target !== ""}
        <div class="comment_target">{comment.target}</div>
      {/if}
      <Pictures names={comment.images} />
      {#each comment.replies as each (each.id)}
        <div class="thread_reply {each.author}">
          <div class="comment_note">{author_label(each.author)} · {each.created_at.slice(0, 10)}</div>
          <div class="comment_text">{each.text}</div>
          <Pictures names={each.images} />
        </div>
      {/each}
      <textarea
        class="comment_input reply_input"
        data-reply-input
        placeholder="Reply"
        bind:value={reply.text}
        onpaste={pasted}
        onkeydown={(event) => reply_key(event, comment)}
      ></textarea>
      <Pictures names={reply.images} remove={(name) => (reply.images = reply.images.filter((each) => each !== name))} />
      <div class="comment_row">
        {#if comment.status === "done"}
          <button class="text_button" data-comment-status="open" onclick={() => set_comment_status(comment.id, "open")}>Reopen</button>
        {:else}
          <button class="text_button" data-comment-status="done" onclick={() => set_comment_status(comment.id, "done")}>Mark done</button>
        {/if}
        {#if comment.replies.length > 0 && !comment.unread}
          <button class="text_button" data-comment-unread onclick={() => set_comment_unread(comment.id, true)}>Mark unread</button>
        {/if}
        <button class="text_button" data-comment-delete onclick={() => delete_comment(comment.id)}>Delete</button>
        <AddPicture added={(names) => reply.images.push(...names)} />
        <button class="bar_button" data-reply-send onclick={() => send(comment)}>Reply<span class="key">⌘↵</span></button>
      </div>
    {/if}
  </div>
{/snippet}

<aside class="comments_sheet" data-pane="comments" onmouseleave={() => (comments.focused = undefined)}>
  <div class="sheet_head">
    <span class="panel_label">Comments</span>
    <button class="text_button" title="Close" onclick={() => set_commenting(false)}>Close</button>
  </div>
  <div class="sheet_body" role="list">
    {#if comments.error !== ""}
      <div class="comment_note" role="alert">{comments.error}</div>
    {/if}
    {#if current_list.length === 0}
      <div class="comment_note">Click anywhere on the page to leave a comment. Drag to draw.</div>
    {/if}
    {#each current_list as comment (comment.id)}
      {@render card(comment)}
    {/each}
    {#if older_list.length > 0}
      <button class="text_button older_toggle" data-older onclick={() => (comments.older_shown = !comments.older_shown)}>
        {comments.older_shown ? "Hide" : "Show"} older comments ({older_list.length})
      </button>
    {/if}
    {#if comments.older_shown}
      {#each older_groups as [label, group] (label)}
        <div class="group_title older_group">{label}</div>
        {#each group as comment (comment.id)}
          {@render card(comment)}
        {/each}
      {/each}
    {/if}
  </div>
</aside>
