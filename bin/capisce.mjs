#!/usr/bin/env node
// capisce build [out.html] [--base <git ref>] [--only <name>] [--json <out.json>]   build the page
//   with --json and no out.html, only the data is written
// capisce check                                                                    fail when the map needs a review
// capisce stamp                                                                    record that the map was reviewed
// capisce serve [--port <n>] [--base <git ref>]                                    build the page, then serve it with comments
// capisce comments [--all]                                                         print the comments waiting on a reply
// capisce reply <comment id> <text> [--done]                                       answer a comment in its thread
// capisce timings                                                                  fetch how long each endpoint takes, from the project's source
// capisce changes [--base <git ref>] [--json]                                      list the symbols whose map changed since a commit
// capisce show <symbol id>... [--base <git ref>] [--format html|svg|diff] [--out <file or folder>]
//                                                                                  write one symbol's pseudo-code, or its diff, as a small file
// capisce show --changed [--base <git ref>] [--format html|svg|diff] --out <folder> [--json]
//                                                                                  the same for every symbol that changed
//   without --base, changes and show --changed compare with where the branch left the default branch
//   --theme light|dark picks the colours of an svg
// capisce skill <name>                                                             print a skill: setup, update, address-comments, show-me or visual-pr
// Every command reads capisce.config.mjs from --root <folder>, or from the current folder.
// The map (program files, domains, stamps) is committed in .capisce in the root, unless the config names other paths.
// The built page, comments, notes and timings are local files in that same folder, which capisce tells git to
// ignore. --state <folder> or CAPISCE_STATE keeps the local files somewhere else.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { add_reply, awaits_reply, comment_text, read_comments } from "../src/comments.mjs";
import {
  CONFIG_FILE,
  FORMER_PROGRAM_EXTENSION,
  PROGRAM_EXTENSION,
  build_map,
  load_config,
  program_files,
  program_paths,
} from "../src/engine.mjs";
import { name_index } from "../src/pseudo.mjs";
import { changes_text, mark_changes, review_needed, stamped, symbol_changes } from "../src/review.mjs";
import { FORMATS, THEMES, file_names, render_section, unknown_id_message } from "../src/show.mjs";
import { prepare_state } from "../src/state.mjs";
import { fetch_timings, timings_path, write_timings } from "../src/timings.mjs";

const home = join(dirname(fileURLToPath(import.meta.url)), "..");
const VIEWER = join(home, "dist", "viewer.html");
const DATA_SLOT = "/*__CAPISCE_DATA__*/null";
const FORMER_SKILL_NAMES = { "build-map": "setup", maintain: "update" };

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
const port = option("--port");
const format = option("--format") ?? "html";
const out = option("--out");
const theme = option("--theme") ?? "light";
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
const changed = flag("--changed");
// --json names a file for build. For changes and show it is a switch that asks for JSON on stdout.
const prints_json = ["changes", "show"].includes(args.find((arg) => arg !== "--json")) && flag("--json");
const json_path = option("--json");
const [command, target, ...rest] = args;

const PATH_NAMES = { program: "program files", domains: "domains" };
const DEFAULT_BRANCHES = ["origin/HEAD", "main", "master"];

const git = (...git_args) =>
  execFileSync("git", git_args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

/** The config of the commit at `ref`, or an empty one when it cannot be read. */
async function config_at(show, folder) {
  try {
    const path = join(folder, CONFIG_FILE);
    writeFileSync(path, show(CONFIG_FILE));
    return (await import(pathToFileURL(path).href)).default;
  } catch {
    return {};
  }
}

/** Says on a build that the program files still have their former names. `check` stays quiet. */
function former_names_hint(config) {
  const former_files = program_files(join(root, config.program)).filter(({ file }) =>
    file.endsWith(FORMER_PROGRAM_EXTENSION),
  );
  if (former_files.length > 0 || config.domains.endsWith(FORMER_PROGRAM_EXTENSION)) {
    console.log(
      `Program files are now named <domain>${PROGRAM_EXTENSION}, with domains${PROGRAM_EXTENSION} beside their folder. Yours still work under their former names. "Moving an existing map" in the reference says how to rename them.`,
    );
  }
}

/**
 * The map as it was at `ref`, read with today's config. A commit from before the map moved keeps it somewhere else,
 * so the program folder and the domains file are each looked for in three places: where today's config says, where
 * that commit's own config says, and where capisce kept them by default before. Nothing is returned when that commit
 * has no map at all: every block would count as new, which says nothing about the branch.
 */
async function map_at(ref, config, say = console.log) {
  const folder = mkdtempSync(join(tmpdir(), "capisce_base_"));
  try {
    // The project may sit in a folder of a larger repository. git archive, run in that folder, reads only it.
    const within = git("rev-parse", "--show-prefix");
    const is_at_ref = (path) => {
      try {
        execFileSync("git", ["cat-file", "-e", `${ref}:${within}${path}`], { cwd: root, stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    };
    const base_config = { ...config };
    if (!is_at_ref(config.program) || !is_at_ref(config.domains)) {
      const then = program_paths(await config_at((path) => git("show", `${ref}:${within}${path}`), folder), is_at_ref);
      for (const key of ["program", "domains"]) {
        const places = [config[key], then[key]];
        base_config[key] = places.find((path) => typeof path === "string" && is_at_ref(path)) ?? config[key];
        if (base_config[key] !== config[key]) {
          say(`At ${ref} the ${PATH_NAMES[key]} are in ${base_config[key]}: comparing with those.`);
        }
      }
    }
    if (!is_at_ref(base_config.program)) {
      say(`At ${ref} there is no map, so nothing counts as changed.`);
      return undefined;
    }
    const paths = [...config.sources, base_config.program, base_config.domains].filter(is_at_ref);
    const archive = execFileSync("git", ["archive", ref, ...paths], { cwd: root, maxBuffer: 1 << 30 });
    execFileSync("tar", ["-x", "-C", folder], { input: archive });
    return await build_map(folder, base_config, { config_root: root, strict: false });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** Fails when `ref` names no commit here, so a mistyped or unfetched base is not read as "nothing changed". */
function check_ref(ref) {
  try {
    git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
  } catch {
    throw new Error(`No commit is named "${ref}" in this repository. Fetch it, or pass --base with a branch, tag or commit that exists here.`);
  }
}

/** The ids that changed since `ref`, with each change written onto the `head` map. `say` gets what a reader should know. */
async function changes_since(ref, config, head, say) {
  const base = await map_at(ref, config, say);
  if (base === undefined) {
    return [];
  }
  return mark_changes(base, head);
}

/** The commit the branch started from: where HEAD and the repository's default branch last met. */
function default_base() {
  for (const branch of DEFAULT_BRANCHES) {
    try {
      return git("rev-parse", "--short", git("merge-base", "HEAD", branch));
    } catch {
      continue;
    }
  }
  throw new Error("The default branch of this repository could not be found. Pass --base <git ref> to say what to compare with.");
}

/** Lists the symbols whose map changed since the base. */
async function print_changes(config, head) {
  const base = base_ref ?? default_base();
  check_ref(base);
  await changes_since(base, config, head, console.error);
  const changes = symbol_changes(head);
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (prints_json) {
    console.log(JSON.stringify({ base, head: branch, changes }, null, 2));
    return;
  }
  console.log(changes_text(base, branch, changes));
}

/** Writes the section of each named symbol, or of each changed one, to stdout or to files. */
async function show_sections(config, head, ids) {
  if (FORMATS[format] === undefined) {
    throw new Error(`"${format}" is not a format. Pass --format html, svg or diff.`);
  }
  if (!THEMES.includes(theme)) {
    throw new Error(`"${theme}" is not a theme. Pass --theme light or dark.`);
  }
  if (changed === ids.length > 0) {
    throw new Error("Use: capisce show <symbol id>... or capisce show --changed. See the top of bin/capisce.mjs.");
  }
  let base = base_ref;
  if (changed) {
    base ??= default_base();
  }
  const with_diff = base !== undefined;
  if (with_diff) {
    check_ref(base);
    await changes_since(base, config, head, console.error);
  }
  if (changed) {
    ids = symbol_changes(head).map((change) => change.id);
  }
  const index = name_index(head.symbols);
  const unknown = ids.find((id) => !index.symbols.has(id));
  if (unknown !== undefined) {
    let hint = "";
    if (!with_diff) {
      hint = "\n\n  A symbol that was removed is shown only with --base <git ref>.";
    }
    throw new Error(`${unknown_id_message(unknown, [...index.symbols.keys()])}${hint}`);
  }
  const document_of = (id) => render_section(index.symbols.get(id), index, { format, with_diff, theme });
  const to_folder = changed || ids.length > 1 || (out !== undefined && existsSync(out) && statSync(out).isDirectory());
  if (to_folder && out === undefined) {
    throw new Error("Several symbols are written as one file each, so they need a folder. Pass --out <folder>.");
  }
  if (out === undefined) {
    process.stdout.write(document_of(ids[0]));
    return;
  }
  let paths = [resolve(out)];
  if (to_folder) {
    paths = file_names(ids, FORMATS[format]).map((name) => resolve(out, name));
  }
  const written = ids.map((id, at) => {
    mkdirSync(dirname(paths[at]), { recursive: true });
    writeFileSync(paths[at], document_of(id));
    return { id, path: paths[at] };
  });
  if (prints_json) {
    console.log(JSON.stringify(written, null, 2));
  } else if (written.length === 0) {
    console.log(`The map has no changed symbols since ${base}.`);
  } else {
    console.log(written.map(({ id, path }) => `${id} -> ${path}`).join("\n"));
  }
}

async function run() {
  if (command === "skill") {
    const path = join(home, "skills", FORMER_SKILL_NAMES[target] ?? target ?? "", "SKILL.md");
    if (!existsSync(path)) {
      throw new Error(`No skill named "${target}". The skills are: setup, update, address-comments, show-me, visual-pr.`);
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
  if (command === "changes") {
    await print_changes(config, head);
    return;
  }
  if (command === "show") {
    await show_sections(config, head, [target, ...rest].filter((id) => id !== undefined));
    return;
  }
  if (command !== "build" && command !== "serve") {
    throw new Error(
      "Use: capisce build | check | stamp | serve | timings | changes | show | comments | reply | skill. See the top of bin/capisce.mjs.",
    );
  }
  const serving = command === "serve";
  former_names_hint(config);

  let changes;
  if (base_ref !== undefined) {
    const needs_review = review_needed(head, root, config).length > 0;
    const ids = await changes_since(base_ref, config, head, console.log);
    if (ids.length > 0) {
      changes = {
        base: base_ref,
        head: git("rev-parse", "--abbrev-ref", "HEAD"),
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
  if (dirname(out_path) === state) {
    prepare_state(state);
  }
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
