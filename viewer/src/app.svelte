<script lang="ts">
  import AnnotationLayer from "./components/annotation_layer.svelte";
  import BrowseList from "./components/browse_list.svelte";
  import CanvasPage from "./components/canvas_page.svelte";
  import ChangesPage from "./components/changes_page.svelte";
  import CommentsSheet from "./components/comments_sheet.svelte";
  import DomainPage from "./components/domain_page.svelte";
  import DraftNote from "./components/draft_note.svelte";
  import NotesPane from "./components/notes_pane.svelte";
  import RealCodeModal from "./components/real_code_modal.svelte";
  import SelectionComment from "./components/selection_comment.svelte";
  import TimingLine from "./components/timing_line.svelte";
  import SymbolPage from "./components/symbol_page.svelte";
  import Tooltip from "./components/tooltip.svelte";
  import TopBar from "./components/top_bar.svelte";
  import TracePanel from "./components/trace_panel.svelte";
  import { CANVAS_PAGE, CHANGES_PAGE, catalog, domain_of_page, symbol_of } from "./map/catalog";
  import { steps_of } from "./map/steps";
  import { cancel_draft, comments, keep_comments_fresh, load_comments, save_draft, unread_count } from "./state/comments.svelte";
  import { current, shown_code, start_history } from "./state/navigation.svelte";
  import { load_notes, notes, save_note } from "./state/notes.svelte";
  import { close_overlays, overlays } from "./state/overlays.svelte";
  import { set_commenting, set_noting } from "./state/side_panes";
  import { load_timings, set_timings_on, timings } from "./state/timings.svelte";

  let { has_data }: { has_data: boolean } = $props();

  const entry = $derived(current());
  const symbol = $derived(symbol_of(entry.id));
  const domain = $derived(domain_of_page(entry.id));
  const code = $derived(shown_code(entry));
  const has_trace = $derived(symbol !== undefined && symbol.kind !== "model" && steps_of(symbol).length > 0);
  const shows_timing = $derived(timings.on && symbol?.kind === "route");
  const real_code_symbol = $derived(symbol_of(overlays.real_code_of));

  void load_comments();
  keep_comments_fresh();
  void load_notes();
  void load_timings();
  start_history();

  function close_what_was_clicked_away(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest(".tooltip, [data-symbol]") === null) {
      overlays.tooltip = undefined;
    }
    if (target.closest(".browse, .menu_button") === null) {
      overlays.menu_open = false;
    }
  }

  function key_pressed(event: KeyboardEvent) {
    const target = event.target;
    const typing = target instanceof Element && target.closest("textarea, input") !== null;
    const with_modifier = event.metaKey || event.ctrlKey || event.altKey;
    if (event.key === "Tab" && !typing && !with_modifier && !event.shiftKey && timings.available) {
      event.preventDefault();
      set_timings_on(!timings.on);
      return;
    }
    if (typing && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      if (target.closest("[data-note-input]") !== null) {
        void save_note();
      } else if (target.closest("[data-draft-input]") !== null) {
        void save_draft();
      }
    } else if (event.key === "Escape" && comments.draft !== undefined) {
      cancel_draft();
    } else if (event.key === "n" && !typing && !with_modifier && notes.available) {
      set_noting(!notes.on);
    } else if (event.key === "c" && !typing && !with_modifier && comments.available) {
      set_commenting(!comments.on);
    } else if (event.key === "Escape") {
      set_commenting(false);
      set_noting(false);
      close_overlays();
    }
  }
</script>

<svelte:document onkeydown={key_pressed} />

<div
  class="capisce"
  class:has_trace
  class:menu_open={overlays.menu_open}
  class:commenting={comments.on}
  class:noting={notes.on}
  role="presentation"
  onclickcapture={close_what_was_clicked_away}
>
  <div class="bar_host" data-panel="bar">
    <TopBar />
    {#if comments.on}<AnnotationLayer panel="bar" />{/if}
  </div>
  {#if !has_data}
    <p class="empty_page">This page has no map yet. Run <code>capisce build</code> to fill it.</p>
  {:else}
    <div class="panels">
      <div class="browse" data-panel="browse">
        <BrowseList />
        {#if comments.on}<AnnotationLayer panel="browse" />{/if}
      </div>
      {#if has_trace && symbol !== undefined}
        <section class="trace_panel" data-panel="flow">
          {#if shows_timing}<TimingLine id={symbol.id} />{/if}
          <TracePanel {symbol} {entry} />
          {#if comments.on}<AnnotationLayer panel="flow" />{/if}
        </section>
      {/if}
      <section class="code_panel" data-panel="code">
        {#if entry.id === CANVAS_PAGE}
          <CanvasPage />
        {:else if entry.id === CHANGES_PAGE && catalog.changes !== undefined}
          <ChangesPage changes={catalog.changes} />
        {:else if domain !== undefined}
          <DomainPage {domain} focus={entry.focus} />
        {:else if code !== undefined}
          {#if shows_timing && !has_trace && symbol !== undefined}<TimingLine id={symbol.id} />{/if}
          <SymbolPage symbol={code.symbol} selected_step={code.step} trace_root={code.trace_root} focus={entry.focus} />
        {/if}
        {#if comments.on}<AnnotationLayer panel="code" />{/if}
      </section>
      {#if notes.on}<NotesPane />{/if}
    </div>
  {/if}
  {#if comments.on}
    <CommentsSheet />
  {:else if comments.available && !notes.on && unread_count() > 0}
    <button class="unread_notice" data-unread-notice onclick={() => set_commenting(true)}>
      {unread_count()} new {unread_count() === 1 ? "reply" : "replies"} to your comments
    </button>
  {/if}
  {#if comments.available && !comments.on}<SelectionComment />{/if}
  {#if overlays.tooltip !== undefined}<Tooltip tooltip={overlays.tooltip} />{/if}
  {#if comments.on && comments.draft !== undefined}<DraftNote draft={comments.draft} />{/if}
  {#if real_code_symbol !== undefined}<RealCodeModal symbol={real_code_symbol} />{/if}
</div>
