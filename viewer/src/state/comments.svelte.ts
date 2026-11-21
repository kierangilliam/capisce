import { tick } from "svelte";
import { symbol_of } from "../map/catalog";
import { steps_of } from "../map/steps";
import { trace_of } from "../map/trace";
import type { CommentDraft, CommentPlace, PanelName, Point, SavedComment, Stroke } from "../types";
import { api_request, upload_screenshot } from "./api";
import { current, go } from "./navigation.svelte";
import { panel_element } from "./scrolling";

const SAVE_FAILED = "The comment was not saved. Check your connection, then save it again.";
const CHANGE_FAILED = "The comment was not changed. Check your connection, then try again.";
const EMPTY_DRAFT = "Write a comment, add a picture or draw first.";
const PICTURE_FAILED = "The picture was not added. Use a PNG, JPEG, GIF or WebP under 12 MB, then add it again.";
const ANNOTATED =
  ".line, .stage_label, .trace_row, .lane_head, .code_name, .called_name, .code_doc, .peek_doc, .relation, .panel_label, .page_name, .page_doc, .model_box, .domain_box, .flow_card, .browse_item, .browse_module summary, .group_title, .crumb, .bar_button";
/** Parts of the page that look the same on every page, so a comment on them shows everywhere. */
const EVERYWHERE: PanelName[] = ["browse", "bar"];
const REFRESH_MS = 20_000;
const COVERABLE = ".line, .stage_label, .trace_row";
const MAX_COVERED = 40;
/** What a pin is on when it is on none of the parts above: a control, named by its text or its tooltip. */
const CONTROL = "button, a, summary, [title]";

export const comments = $state({
  list: [] as SavedComment[],
  draft: undefined as CommentDraft | undefined,
  focused: undefined as string | undefined,
  opened: undefined as string | undefined,
  older_shown: false,
  error: "",
  hint: "",
  available: false,
  on: false,
  note_moved_to: undefined as { left: number; top: number } | undefined,
});

const selected_step = (): number | null => current().step ?? null;

const picked_call = (): number | null => current().trace ?? null;

/** Comments saved before the picked call was kept show on the page whatever call is picked. */
export const in_view = (comment: CommentPlace): boolean =>
  comment.symbol === current().id &&
  comment.step_index === selected_step() &&
  (comment.trace_index === undefined || comment.trace_index === picked_call());

/** Whether a comment's pin or drawings belong on this part of the page right now. */
export const shown_on = (panel: PanelName, comment: SavedComment | CommentDraft): boolean =>
  EVERYWHERE.includes(panel) || in_view(comment);

export const unread_count = (): number => comments.list.filter((comment) => comment.unread).length;

export const place_label = ({ symbol, step }: CommentPlace): string => {
  if (step === "") {
    return symbol;
  }
  return `${symbol} › ${step}`;
};

export const number_of = (comment: SavedComment | CommentDraft): number => {
  const index = comments.list.findIndex((each) => "id" in comment && each.id === comment.id);
  if (index === -1) {
    return comments.list.length + 1;
  }
  return index + 1;
};

const MAX_TARGET = 200;
const WRAPPED_NAME = ".lane_head";

const one_line = (text: string): string => text.trim().replace(/\s+/g, " ").slice(0, MAX_TARGET);

/** What an element says. A drawing keeps its words in several parts, which read as one text only with spaces between. */
function text_of(element: Element): string {
  const parts = [...element.querySelectorAll("text")].map((part) => part.textContent ?? "");
  if (parts.length === 0 || element.matches(WRAPPED_NAME)) {
    return one_line(element.textContent ?? "");
  }
  return one_line(parts.join(" "));
}

function view_place(): CommentPlace {
  const entry = current();
  const symbol = symbol_of(entry.id);
  let step = steps_of(symbol)[entry.step ?? -1]?.title ?? "";
  if (entry.trace !== undefined && symbol !== undefined) {
    const called = trace_of(symbol).rows[entry.trace];
    step = `${called?.owner} › ${called?.title}`;
  }
  return { symbol: entry.id, step, step_index: selected_step(), trace_index: picked_call() };
}

function control_at(client_x: number, client_y: number): string {
  const control = document
    .elementsFromPoint(client_x, client_y)
    .map((element) => element.closest(CONTROL))
    .find((element) => element !== null);
  if (control === undefined || control === null) {
    return "";
  }
  const title = control.getAttribute("title") ?? "";
  if (title === "") {
    return text_of(control);
  }
  return one_line(`${text_of(control)} (${title})`);
}

export function start_draft(panel: PanelName, [x, y]: Point, client_x: number, client_y: number): void {
  const under = document
    .elementsFromPoint(client_x, client_y)
    .map((element) => element.closest(ANNOTATED))
    .find((element) => element !== null);
  let target = "";
  if (under !== undefined && under !== null) {
    target = text_of(under);
  } else {
    target = control_at(client_x, client_y);
  }
  draft_at(panel, [x, y], target);
}

function draft_at(panel: PanelName, [x, y]: Point, target: string): void {
  comments.draft = { ...view_place(), pin: { panel, x, y }, target, strokes: [], text: "", images: [] };
  comments.note_moved_to = undefined;
  comments.hint = "";
}

/** Starts a comment on text the reader selected: pinned where the selection begins, and about its words. */
export function start_draft_on_selection(panel: PanelName, point: Point, selected_text: string): void {
  draft_at(panel, point, one_line(selected_text));
}

/** What the reader pressed and released on a panel: a click drops a pin, a drag adds a drawing. */
export function finish_press(panel: PanelName, points: Point[], drew: boolean, client_x: number, client_y: number): void {
  const draft = comments.draft;
  const first = points[0];
  if (first === undefined) {
    return;
  }
  const untouched =
    draft !== undefined && !drew && draft.strokes.length === 0 && draft.text === "" && draft.images.length === 0;
  if (draft === undefined || untouched) {
    start_draft(panel, first, client_x, client_y);
  }
  if (drew) {
    comments.draft?.strokes.push({ panel, points });
  }
  comments.hint = "";
}

/** The text of every line, stage and trace row that the drawings pass over. */
function covered_by(strokes: Stroke[]): string[] {
  const covered: string[] = [];
  for (const stroke of strokes) {
    const host = panel_element(stroke.panel);
    const origin = host?.querySelector(".annotation_layer")?.getBoundingClientRect();
    if (host === null || origin === undefined) {
      continue;
    }
    const xs = stroke.points.map(([x]) => x + origin.left);
    const ys = stroke.points.map(([, y]) => y + origin.top);
    for (const element of host.querySelectorAll(COVERABLE)) {
      const box = element.getBoundingClientRect();
      const apart =
        box.right < Math.min(...xs) || box.left > Math.max(...xs) || box.bottom < Math.min(...ys) || box.top > Math.max(...ys);
      const text = text_of(element);
      if (!apart && text !== "" && !covered.includes(text)) {
        covered.push(text);
      }
    }
  }
  return covered.slice(0, MAX_COVERED);
}

async function change_comments(failed_message: string, change: () => Promise<unknown>): Promise<void> {
  comments.error = "";
  try {
    await change();
    comments.list = await api_request<SavedComment[]>("comments", "GET");
  } catch (error) {
    console.warn(error);
    comments.error = failed_message;
  }
}

export function save_draft(): Promise<void> {
  const draft = comments.draft;
  if (draft === undefined) {
    return Promise.resolve();
  }
  draft.text = draft.text.trim();
  if (draft.text === "" && draft.strokes.length === 0 && draft.images.length === 0) {
    comments.hint = EMPTY_DRAFT;
    return Promise.resolve();
  }
  return change_comments(SAVE_FAILED, async () => {
    await api_request("comments", "POST", undefined, { ...draft, covers: covered_by(draft.strokes) });
    comments.draft = undefined;
  });
}

export function cancel_draft(): void {
  comments.draft = undefined;
}

export const set_comment_status = (id: string, status: SavedComment["status"]): Promise<void> =>
  change_comments(CHANGE_FAILED, () => api_request("comments", "PATCH", id, { status }));

export const delete_comment = (id: string): Promise<void> =>
  change_comments(CHANGE_FAILED, () => api_request("comments", "DELETE", id));

export const set_comment_unread = (id: string, unread: boolean): Promise<void> =>
  change_comments(CHANGE_FAILED, () => api_request("comments", "PATCH", id, { unread }));

/** Opens a comment's thread in the sheet. Seeing the thread is what marks it read. */
export function open_thread(comment: SavedComment): void {
  comments.opened = comment.id;
  if (comment.unread) {
    void set_comment_unread(comment.id, false);
  }
}

export function send_reply(id: string, text: string, images: string[]): Promise<void> {
  if (text.trim() === "" && images.length === 0) {
    return Promise.resolve();
  }
  return change_comments(SAVE_FAILED, () => api_request("comments", "POST", id, { text, images }, "replies"));
}

/** Saves the pictures and returns their names. Sets the error and returns what did save when one fails. */
export async function add_pictures(files: Iterable<File>): Promise<string[]> {
  const names: string[] = [];
  comments.error = "";
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      continue;
    }
    try {
      names.push(await upload_screenshot(file));
    } catch (error) {
      console.warn(error);
      comments.error = PICTURE_FAILED;
    }
  }
  return names;
}

export const pictures_in = (event: ClipboardEvent): File[] =>
  [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));

export async function show_comment(comment: SavedComment): Promise<void> {
  if (EVERYWHERE.includes(comment.pin.panel)) {
    return;
  }
  if (!in_view(comment)) {
    await go(comment.symbol, { step: comment.step_index ?? undefined, trace: comment.trace_index ?? undefined });
    await tick();
  }
  panel_element(comment.pin.panel)?.scrollTo(Math.max(0, comment.pin.x - 200), Math.max(0, comment.pin.y - 120));
}

export async function load_comments(): Promise<void> {
  try {
    comments.list = await api_request<SavedComment[]>("comments", "GET");
    comments.available = true;
  } catch {
    comments.available = false;
  }
}

/** Replies are written from outside the page, so the list is read again now and then, and when the reader returns. */
export function keep_comments_fresh(): void {
  const refresh = () => {
    if (comments.available && document.visibilityState === "visible") {
      void load_comments();
    }
  };
  setInterval(refresh, REFRESH_MS);
  document.addEventListener("visibilitychange", refresh);
}
