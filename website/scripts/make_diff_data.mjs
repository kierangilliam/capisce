// Writes src/data/oxide-lite-diff.json: the oxide-lite map built on a feature branch with --base main.
// It copies the example as last committed into a scratch git repository, commits it as main, makes a small change on a branch
// (the code, its pseudo-code and a new step), stamps the map as an agent would, and builds with --base main.
// Run it again after the example or the map format changes: `pnpm diff-data`.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const website = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(website, "..");
const cli = join(repo, "bin", "capisce.mjs");
const out = join(website, "src", "data", "oxide-lite-diff.json");
const BRANCH = "rack-capacity-check";
const INSTANCES_MAP = "maps/instances.map";

const EDITS = [
  {
    file: "api/src/app/instances.rs",
    from: "    check_quota(&db, &project, new.ncpus, new.memory_gib, new.boot_disk_size_gib)?;\n",
    to:
      "    check_quota(&db, &project, new.ncpus, new.memory_gib, new.boot_disk_size_gib)?;\n" +
      "    let (free_cpus, free_memory_gib) = db.rack_free_capacity();\n" +
      "    if new.ncpus > free_cpus || new.memory_gib > free_memory_gib {\n" +
      "        return Err(ApiError::RackFull);\n" +
      "    }\n",
  },
  {
    file: INSTANCES_MAP,
    from: '        # the boot disk is named "<instance name>-boot"\n',
    to: '        boot_disk_name = new.name + "-boot"\n',
  },
  {
    file: INSTANCES_MAP,
    from: "            new.memory_gib, new.boot_disk_size_gib)\n",
    to:
      "            new.memory_gib, new.boot_disk_size_gib)\n" +
      "        #> Refuse what the rack has no room for -> rack_store.rack_free_capacity | RackFull\n" +
      "        free_cpus, free_memory_gib = rack_store.rack_free_capacity()\n" +
      "        if new.ncpus > free_cpus or new.memory_gib > free_memory_gib:\n" +
      "            raise ApiError.RackFull                # 503\n",
  },
  {
    file: INSTANCES_MAP,
    from: "    # 503 AddressPoolExhausted\n",
    to: "    # 503 AddressPoolExhausted or RackFull\n",
  },
];

const folder = mkdtempSync(join(tmpdir(), "capisce_diff_"));
try {
  const archive = execFileSync("git", ["archive", "HEAD:examples/oxide-lite"], { cwd: repo, maxBuffer: 1 << 30 });
  execFileSync("tar", ["-x", "-C", folder], { input: archive });
  const map_folder = [".capisce", "capisce"].find((name) => existsSync(join(folder, name, INSTANCES_MAP)));
  const git = (...args) => execFileSync("git", args, { cwd: folder, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("add", ".");
  git("-c", "user.name=capisce", "-c", "user.email=capisce@example.com", "commit", "-q", "-m", "main");
  git("checkout", "-q", "-b", BRANCH);
  for (const { file, from, to } of EDITS) {
    const path = file === INSTANCES_MAP ? join(folder, map_folder ?? ".capisce", file) : join(folder, file);
    const text = readFileSync(path, "utf8");
    if (!text.includes(from)) {
      throw new Error(`${file} no longer has the line this script changes:\n${from}Update EDITS in scripts/make_diff_data.mjs.`);
    }
    writeFileSync(path, text.replace(from, to));
  }
  execFileSync(process.execPath, [cli, "stamp", "--root", folder], { stdio: "inherit" });
  git("add", ".");
  git("-c", "user.name=capisce", "-c", "user.email=capisce@example.com", "commit", "-q", "-m", "Refuse what the rack has no room for");
  execFileSync(process.execPath, [cli, "build", "--json", out, "--base", "main", "--root", folder], { stdio: "inherit" });
  const changes = JSON.parse(readFileSync(out, "utf8")).changes;
  console.log(`Wrote ${out}: ${changes?.ids.join(", ")}`);
} finally {
  rmSync(folder, { recursive: true, force: true });
}
