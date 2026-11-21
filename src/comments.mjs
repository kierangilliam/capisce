// Comments and notes, kept as local files in the .capisce folder (or the state folder, when one is named):
//   comments.json, notes.json and comments/screenshots/ for the pictures attached to comments.
// The server and the command line both read and write through here, so either can run without the other.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prepare_state } from "./state.mjs";

export const AUTHORS = ["reader", "agent"];
export const STATUSES = ["open", "done"];
export const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
const IMAGE_NAME = /^[\w-]+\.(png|jpg|gif|webp)$/;

export const comments_path = (state) => join(state, "comments.json");
export const notes_path = (state) => join(state, "notes.json");
export const screenshots_folder = (state) => join(state, "comments", "screenshots");

export function read_list(path) {
  if (!existsSync(path)) {
    return [];
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export function write_list(path, list) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, `${JSON.stringify(list, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
}

export const text_of = (value) => {
  if (typeof value === "string") {
    return value;
  }
  return "";
};

export const images_of = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((name) => typeof name === "string" && IMAGE_NAME.test(name));
};

/** Comments saved before threads had one `reply` from the agent; it becomes the first message of the thread. */
function with_thread(comment) {
  const { reply, ...rest } = comment;
  const replies = rest.replies ?? [];
  if (typeof reply === "string" && reply !== "" && replies.length === 0) {
    replies.push({ id: `${comment.id}-reply`, author: "agent", text: reply, images: [], created_at: comment.created_at });
  }
  return { ...rest, images: rest.images ?? [], replies, unread: rest.unread === true };
}

export const read_comments = (state) => read_list(comments_path(state)).map(with_thread);
export function write_comments(state, comments) {
  prepare_state(state);
  write_list(comments_path(state), comments);
}

/** True when the reader spoke last, so the thread is waiting on an answer. */
export function awaits_reply(comment) {
  const last = comment.replies.at(-1);
  return comment.status === "open" && (last === undefined || last.author === "reader");
}

/**
 * Adds a message to a comment's thread and returns the comment, or undefined when there is no such comment.
 * A message from the agent marks the thread unread, so the reader is told about it.
 * A message from the reader opens the thread again, so it waits on an answer.
 */
export function add_reply(state, id, { author, text, images, status }) {
  const comments = read_comments(state);
  const found = comments.find((comment) => comment.id === id || comment.id.startsWith(id));
  if (found === undefined) {
    return undefined;
  }
  found.replies.push({
    id: randomUUID(),
    author,
    text: text_of(text).trim(),
    images: images_of(images),
    created_at: new Date().toISOString(),
  });
  found.unread = author === "agent";
  if (STATUSES.includes(status)) {
    found.status = status;
  } else if (author === "reader") {
    found.status = "open";
  }
  write_comments(state, comments);
  return found;
}

/** A comment as plain text, for an agent to read. */
export function comment_text(state, comment) {
  const lines = [`${comment.id}  [${comment.status}]  ${comment.created_at.slice(0, 16).replace("T", " ")}`];
  let page = comment.symbol;
  if (comment.step !== "") {
    page = `${page} › ${comment.step}`;
  }
  lines.push(`  page:     ${page}`);
  lines.push(`  part:     ${comment.pin.panel}`);
  if (comment.target !== "") {
    lines.push(`  pinned to: ${comment.target}`);
  }
  for (const covered of comment.covers ?? []) {
    lines.push(`  drawn over: ${covered}`);
  }
  const messages = [{ author: "reader", text: comment.text, images: comment.images }, ...comment.replies];
  for (const message of messages) {
    lines.push(`  ${message.author}: ${message.text.replace(/\n/g, "\n    ")}`);
    for (const image of message.images ?? []) {
      lines.push(`    picture: ${join(screenshots_folder(state), image)}`);
    }
  }
  return lines.join("\n");
}
