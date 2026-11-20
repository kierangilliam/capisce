#!/usr/bin/env node
// capisce build [out.html] [--base <git ref>] [--only <map>] [--json <out.json>]   build the page
// capisce check                                                                    fail when the map needs a review
// capisce stamp                                                                    record that the map was reviewed
// capisce serve <folder> [--port <n>]                                              serve a built page with comments
// capisce skill <name>                                                             print a skill
// Every command reads capisce.config.mjs from --root <folder>, or from the current folder.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build_map, load_config } from "../src/engine.mjs";
import { mark_changes, review_needed, stamped } from "../src/review.mjs";

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
const [command, target] = args;

/** The map as it was at `ref`, read with today's config. */
async function map_at(ref, config) {
  const folder = mkdtempSync(join(tmpdir(), "capisce_base_"));
  try {
    const paths = [...config.sources, config.maps, config.domains].filter((path) => {
      try {
        execFileSync("git", ["cat-file", "-e", `${ref}:${path}`], { cwd: root, stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    });
    const archive = execFileSync("git", ["archive", ref, ...paths], { cwd: root, maxBuffer: 1 << 30 });
    execFileSync("tar", ["-x", "-C", folder], { input: archive });
    return await build_map(folder, config, { config_root: root });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

async function run() {
  if (command === "skill") {
    const path = join(home, "skills", target ?? "", "SKILL.md");
    if (!existsSync(path)) {
      throw new Error(`No skill named "${target}". The skills are: build-map, maintain.`);
    }
    console.log(readFileSync(path, "utf8"));
    return;
  }
  if (command === "serve") {
    const server = spawn(process.execPath, [join(home, "src", "server.mjs"), resolve(target ?? ".")], {
      stdio: "inherit",
      env: { ...process.env, PORT: port ?? process.env.PORT ?? "8094" },
    });
    server.on("exit", (code) => process.exit(code ?? 0));
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
  if (command !== "build") {
    throw new Error("Use: capisce build | check | stamp | serve | skill. See the top of bin/capisce.mjs.");
  }

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
  const out_path = resolve(target ?? join(root, "capisce.html"));
  mkdirSync(dirname(out_path), { recursive: true });
  writeFileSync(out_path, readFileSync(VIEWER, "utf8").replace(DATA_SLOT, () => data.replace(/</g, "\\u003c")));
  console.log(`${head.symbols.length} symbols, ${head.domains.length} domains -> ${out_path}`);
}

run().catch((error) => {
  console.error(`capisce could not finish.\n\n  ${error.message}`);
  process.exit(1);
});
