// Serves a built map, the comments left on it, and the notes kept about it.
// It reads and writes the local files of the folder given as the first argument (.capisce unless told otherwise):
// index.html, comments.json, notes.json, timings.json and comments/screenshots/. It serves nothing else from it.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import {
  AUTHORS,
  IMAGE_TYPES,
  STATUSES,
  add_reply,
  images_of,
  notes_path as notes_path_in,
  read_comments as read_comments_in,
  read_list,
  screenshots_folder,
  text_of,
  write_comments as write_comments_in,
  write_list,
} from "./comments.mjs";
import { prepare_state } from "./state.mjs";
import { read_timings } from "./timings.mjs";

const root = resolve(process.argv[2] ?? ".capisce");
const notes_path = notes_path_in(root);
prepare_state(root);
const port = Number(process.env.PORT ?? 8094);
const MAX_BODY_CHARS = 2_000_000;
const MAX_IMAGE_BYTES = 12_000_000;
const PANELS = ["flow", "code", "browse", "bar"];

const read_comments = () => read_comments_in(root);
const write_comments = (comments) => write_comments_in(root, comments);

function send(response, status, body, type = "application/json") {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    response.end(body);
  } else {
    response.end(JSON.stringify(body));
  }
}

async function read_body(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > MAX_BODY_CHARS) {
      throw new Error("body too large");
    }
  }
  return JSON.parse(text);
}

const is_point = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

const is_stroke = (value) =>
  PANELS.includes(value?.panel) && Array.isArray(value.points) && value.points.every(is_point);

/** Returns the comment to store, or undefined when the body is not one. */
function comment_of(body) {
  const pin = body.pin;
  if (!PANELS.includes(pin?.panel) || !is_point([pin.x, pin.y])) {
    return undefined;
  }
  if (!Array.isArray(body.strokes) || !body.strokes.every(is_stroke)) {
    return undefined;
  }
  const comment = {
    id: randomUUID(),
    symbol: text_of(body.symbol),
    step: text_of(body.step),
    step_index: Number.isInteger(body.step_index) ? body.step_index : null,
    trace_index: Number.isInteger(body.trace_index) ? body.trace_index : null,
    target: text_of(body.target),
    covers: Array.isArray(body.covers) ? body.covers.map(text_of) : [],
    text: text_of(body.text).trim(),
    images: images_of(body.images),
    pin: { panel: pin.panel, x: pin.x, y: pin.y },
    strokes: body.strokes.map(({ panel, points }) => ({ panel, points })),
    status: "open",
    replies: [],
    unread: false,
    created_at: new Date().toISOString(),
  };
  const is_empty = comment.text === "" && comment.strokes.length === 0 && comment.images.length === 0;
  if (comment.symbol === "" || is_empty) {
    return undefined;
  }
  return comment;
}

async function handle_reply(request, response, id) {
  const body = await read_body(request);
  let author = "reader";
  if (AUTHORS.includes(body.author)) {
    author = body.author;
  }
  if (text_of(body.text).trim() === "" && images_of(body.images).length === 0) {
    return send(response, 400, { error: "Write a reply first, then send it again." });
  }
  const comment = add_reply(root, id, { author, text: body.text, images: body.images, status: body.status });
  if (comment === undefined) {
    return send(response, 404, { error: "This comment is gone. Refresh the page." });
  }
  console.log(JSON.stringify({ event: "comment.replied", id: comment.id, author }));
  return send(response, 201, comment);
}

async function handle_screenshot(request, response, name) {
  const folder = screenshots_folder(root);
  if (request.method === "GET" && name !== undefined) {
    const path = join(folder, name);
    const type = Object.keys(IMAGE_TYPES).find((each) => name.endsWith(`.${IMAGE_TYPES[each]}`));
    if (images_of([name]).length === 0 || type === undefined || !existsSync(path)) {
      return send(response, 404, "Not found", "text/plain");
    }
    response.writeHead(200, { "content-type": type, "cache-control": "private, max-age=86400" });
    return response.end(readFileSync(path));
  }
  const extension = IMAGE_TYPES[request.headers["content-type"]];
  if (request.method !== "POST" || name !== undefined || extension === undefined) {
    return send(response, 400, { error: "Add a PNG, JPEG, GIF or WebP picture." });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES) {
      return send(response, 400, { error: "This picture is too large. Add one under 12 MB." });
    }
    chunks.push(chunk);
  }
  const saved_name = `${randomUUID()}.${extension}`;
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, saved_name), Buffer.concat(chunks));
  console.log(JSON.stringify({ event: "screenshot.saved", name: saved_name, size }));
  return send(response, 201, { name: saved_name });
}

async function handle_comments(request, response, id) {
  const comments = read_comments();
  if (request.method === "GET" && id === undefined) {
    return send(response, 200, comments);
  }
  if (request.method === "POST" && id === undefined) {
    const comment = comment_of(await read_body(request));
    if (comment === undefined) {
      return send(response, 400, { error: "Write a comment or draw first, then save it again." });
    }
    write_comments([...comments, comment]);
    console.log(JSON.stringify({ event: "comment.created", id: comment.id, symbol: comment.symbol }));
    return send(response, 201, comment);
  }

  const found = comments.find((comment) => comment.id === id);
  if (found === undefined) {
    return send(response, 404, { error: "This comment is gone. Refresh the page." });
  }
  if (request.method === "PATCH") {
    const body = await read_body(request);
    if (!STATUSES.includes(body.status) && typeof body.unread !== "boolean") {
      return send(response, 400, { error: "Set the status to open or done, or unread to true or false." });
    }
    if (STATUSES.includes(body.status)) {
      found.status = body.status;
    }
    if (typeof body.unread === "boolean") {
      found.unread = body.unread;
    }
    write_comments(comments);
    console.log(JSON.stringify({ event: "comment.status_set", id, status: found.status }));
    return send(response, 200, found);
  }
  if (request.method === "DELETE") {
    write_comments(comments.filter((comment) => comment.id !== id));
    console.log(JSON.stringify({ event: "comment.deleted", id }));
    return send(response, 200, { deleted: id });
  }
  return send(response, 405, { error: "Use GET, POST, PATCH or DELETE." });
}

/** Notes are about the code map as a whole: ideas and things to do later. */
async function handle_notes(request, response, id) {
  const notes = read_list(notes_path);
  if (request.method === "GET" && id === undefined) {
    return send(response, 200, notes);
  }
  if (request.method === "POST" && id === undefined) {
    const text = text_of((await read_body(request)).text).trim();
    if (text === "") {
      return send(response, 400, { error: "Write a note first, then save it again." });
    }
    const note = { id: randomUUID(), text, status: "open", created_at: new Date().toISOString() };
    write_list(notes_path, [...notes, note]);
    console.log(JSON.stringify({ event: "note.created", id: note.id }));
    return send(response, 201, note);
  }

  const found = notes.find((note) => note.id === id);
  if (found === undefined) {
    return send(response, 404, { error: "This note is gone. Refresh the page." });
  }
  if (request.method === "PATCH") {
    const body = await read_body(request);
    if (!STATUSES.includes(body.status)) {
      return send(response, 400, { error: "Set the status to open or done." });
    }
    found.status = body.status;
    write_list(notes_path, notes);
    console.log(JSON.stringify({ event: "note.status_set", id, status: found.status }));
    return send(response, 200, found);
  }
  if (request.method === "DELETE") {
    write_list(notes_path, notes.filter((note) => note.id !== id));
    console.log(JSON.stringify({ event: "note.deleted", id }));
    return send(response, 200, { deleted: id });
  }
  return send(response, 405, { error: "Use GET, POST, PATCH or DELETE." });
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  try {
    const reply_match = /^\/api\/comments\/([\w-]+)\/replies$/.exec(path);
    if (reply_match !== null && request.method === "POST") {
      return await handle_reply(request, response, reply_match[1]);
    }
    const screenshot_match = /^\/api\/screenshots(?:\/([\w.-]+))?$/.exec(path);
    if (screenshot_match !== null) {
      return await handle_screenshot(request, response, screenshot_match[1]);
    }
    const comments_match = /^\/api\/comments(?:\/([\w-]+))?$/.exec(path);
    if (comments_match !== null) {
      return await handle_comments(request, response, comments_match[1]);
    }
    const notes_match = /^\/api\/notes(?:\/([\w-]+))?$/.exec(path);
    if (notes_match !== null) {
      return await handle_notes(request, response, notes_match[1]);
    }
    if (request.method === "GET" && path === "/api/timings") {
      return send(response, 200, read_timings(root));
    }
    if (request.method === "GET" && path === "/") {
      return send(response, 200, readFileSync(join(root, "index.html")), "text/html; charset=utf-8");
    }
    return send(response, 404, "Not found", "text/plain");
  } catch (error) {
    console.error(JSON.stringify({ event: "request.failed", path, error: String(error) }));
    return send(response, 400, { error: "This could not be saved. Try saving it again." });
  }
});

server.listen(port, "127.0.0.1", () => console.log(JSON.stringify({ event: "boot", port, root })));
