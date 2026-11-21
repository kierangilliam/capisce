#!/usr/bin/env node
// capisce build [out.html] [--base <git ref>] [--only <map>] [--json <out.json>]   build the page
//   with --json and no out.html, only the data is written
// capisce check                                                                    fail when the map needs a review
// capisce stamp                                                                    record that the map was reviewed
// capisce serve [--port <n>] [--base <git ref>]                                    build the page, then serve it with comments
// capisce comments [--all]                                                         print the comments waiting on a reply
// capisce reply <comment id> <text> [--done]                                       answer a comment in its thread
// capisce timings                                                                  fetch how long each endpoint takes, from the project's source
// capisce skill <name>                                                             print a skill
// Every command reads capisce.config.mjs from --root <folder>, or from the current folder.
// The built page, comments, notes and timings live in the state folder: .capisce in the root, or --state <folder>,
// or CAPISCE_STATE.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { add_reply, awaits_reply, comment_text, read_comments } from "../src/comments.mjs";
import { build_map, load_config } from "../src/engine.mjs";
import { mark_changes, review_needed, stamped } from "../src/review.mjs";
import { fetch_timings, timings_path, write_timings } from "../src/timings.mjs";

const home = join(dirname(fileURLToPath(import.meta.url)), "..");
const VIEWER = join(home, "dist", "viewer.html");
const DATA_SLOT = "/*__CAPISCE_DATA__*/null";

const args = process.argv.slice(2);
function option(name) {
  const at = args.indexOf(name);
  if (at === -1) {
    return undefined;
  }
  return args.splice(at, 2)[1];
}

const root = resolve(option("--root") ?? ".");
const base_ref = option("--base");
const only = option("--only");
const json_path = option("--json");
const port = option("--port");
const state = resolve(option("--state") ?? process.env.CAPISCE_STATE ?? join(root, ".capisce"));
function flag(name) {
  const at = args.indexOf(name);
  if (at !== -1) {
    args.splice(at, 1);
  }
  return at !== -1;
}
const all = flag("--all");
const done = flag("--done");
const [command, target, ...rest] = args;

/** The map as it was at `ref`, read with today's config. */
async function map_at(ref, config) {
  const folder = mkdtempSync(join(tmpdir(), "capisce_base_"));
  try {
    const git = (...git_args) => execFileSync("git", git_args, { cwd: root, encoding: "utf8" }).trim();
    // The project may sit in a folder of a larger repository: read that folder of the older commit.
    const folder_in_repo = git("rev-parse", "--show-prefix").replace(/\/$/, "");
    let tree = ref;
    let within = "";
    if (folder_in_repo !== "") {
      tree = `${ref}:${folder_in_repo}`;
      within = `${folder_in_repo}/`;
    }
    const paths = [...config.sources, config.maps, config.domains].filter((path) => {
      try {
        execFileSync("git", ["cat-file", "-e", `${ref}:${within}${path}`], { cwd: root, stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    });
    const archive = execFileSync("git", ["archive", tree, ...paths], { cwd: root, maxBuffer: 1 << 30 });
    execFileSync("tar", ["-x", "-C", folder], { input: archive });
    return await build_map(folder, config, { config_root: root, strict: false });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function run() {
  if (command === "skill") {
    const path = join(home, "skills", target ?? "", "SKILL.md");
    if (!existsSync(path)) {
      throw new Error(`No skill named "${target}". The skills are: build-map, maintain, address-comments.`);
    }
    console.log(readFileSync(path, "utf8"));
    return;
  }
  if (command === "comments") {
    const comments = read_comments(state).filter((comment) => all || awaits_reply(comment));
    if (comments.length === 0) {
      console.log("No comments are waiting on a reply.");
      return;
    }
    console.log(comments.map((comment) => comment_text(state, comment)).join("\n\n"));
    return;
  }
  if (command === "reply") {
    const text = rest.join(" ").trim();
    if (target === undefined || text === "") {
      throw new Error('Use: capisce reply <comment id> "<text>" [--done]');
    }
    let status;
    if (done) {
      status = "done";
    }
    const comment = add_reply(state, target, { author: "agent", text, status });
    if (comment === undefined) {
      throw new Error(`No comment has the id "${target}". Run "capisce comments --all" to list them.`);
    }
    console.log(`Replied to ${comment.id} (${comment.status}).`);
    return;
  }

  const config = await load_config(root);
  const head = await build_map(root, config, { only });
  if (command === "stamp") {
    writeFileSync(join(root, config.stamps), `${JSON.stringify(stamped(head), null, 2)}\n`);
    console.log(`Stamped ${Object.keys(stamped(head)).length} symbols in ${config.stamps}`);
    return;
  }
  if (command === "check") {
    const lines = review_needed(head, root, config);
    if (lines.length > 0) {
      console.error(`The map needs a review.\n\n${lines.join("\n")}`);
      process.exit(1);
    }
    console.log("The map is up to date.");
    return;
  }
  if (command === "timings") {
    const { timings, dropped, missing } = await fetch_timings(root, config, head);
    write_timings(state, timings);
    console.log(`${timings.rows.length} endpoints have timings -> ${timings_path(state)}`);
    console.log(`${missing.length} endpoints of the map have none.`);
    if (dropped > 0) {
      console.log(`${dropped} rows were dropped: they name no endpoint of the map, or lack a number.`);
    }
    return;
  }
  if (command !== "build" && command !== "serve") {
    throw new Error(
      "Use: capisce build | check | stamp | serve | timings | comments | reply | skill. See the top of bin/capisce.mjs.",
    );
  }
  const serving = command === "serve";

  let changes;
  if (base_ref !== undefined) {
    const needs_review = review_needed(head, root, config).length > 0;
    const ids = mark_changes(await map_at(base_ref, config), head);
    if (ids.length > 0) {
      changes = {
        base: base_ref,
        head: execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
        ids,
        needs_review,
      };
    }
  }
  const data = JSON.stringify({ ...head, required: undefined, changes });
  if (json_path !== undefined) {
    writeFileSync(resolve(json_path), data);
  }
  if (target === undefined && json_path !== undefined) {
    return;
  }
  if (!existsSync(VIEWER)) {
    throw new Error(`The page has not been built yet. Run "pnpm install && pnpm build" in ${home}, then try again.`);
  }
  let out_path = resolve(target ?? join(state, "index.html"));
  if (serving) {
    out_path = join(state, "index.html");
  }
  mkdirSync(dirname(out_path), { recursive: true });
  writeFileSync(out_path, readFileSync(VIEWER, "utf8").replace(DATA_SLOT, () => data.replace(/</g, "\\u003c")));
  console.log(`${head.symbols.length} symbols, ${head.domains.length} domains -> ${out_path}`);
  if (serving) {
    const server = spawn(process.execPath, [join(home, "src", "server.mjs"), state], {
      stdio: "inherit",
      env: { ...process.env, PORT: port ?? process.env.PORT ?? "8094" },
    });
    server.on("exit", (code) => process.exit(code ?? 0));
  }
}

run().catch((error) => {
  console.error(`capisce could not finish.\n\n  ${error.message}`);
  process.exit(1);
});
