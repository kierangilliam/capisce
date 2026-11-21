// Builds what the site serves beside its own page, from the capisce command line and the two examples:
//   public/demo/<example>/index.html   each example's page, exactly as `capisce build` writes it
//   public/frames/<name>.html          the same page with a stand-in for the comments server, for the figures
//   src/generated/oxide-lite.json      the oxide-lite map, which vite.config.ts renders the first code block from
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const website = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(website, "..");
const viewer_page = join(repo, "dist", "viewer.html");
const cli = join(repo, "bin", "capisce.mjs");
const public_folder = join(website, "public");
const generated = join(website, "src", "generated");
const DATA_SLOT = "/*__CAPISCE_DATA__*/null";
const EXAMPLES = ["oxide-lite", "help-desk"];
const FRAMED = ["oxide-lite"];
const CODE_BLOCK_MAP = "oxide-lite";

if (!existsSync(viewer_page)) {
  console.error(`The capisce page has not been built yet, so the site cannot be built.\n\n  Run "pnpm install && pnpm build" in ${repo}, then run this again.`);
  process.exit(1);
}

rmSync(join(public_folder, "demo"), { recursive: true, force: true });
rmSync(join(public_folder, "frames"), { recursive: true, force: true });
mkdirSync(join(public_folder, "frames"), { recursive: true });
mkdirSync(generated, { recursive: true });

const shim = readFileSync(join(website, "scripts", "frame_shim.js"), "utf8");
const with_shim = (page) => page.replace("<head>", () => `<head>\n<script>${shim}</script>`);
const with_data = (data) =>
  readFileSync(viewer_page, "utf8").replace(DATA_SLOT, () => JSON.stringify(data).replace(/</g, "\\u003c"));

for (const example of EXAMPLES) {
  const root = join(repo, "examples", example);
  const page = join(public_folder, "demo", example, "index.html");
  const args = ["build", page, "--root", root];
  if (example === CODE_BLOCK_MAP) {
    args.push("--json", join(generated, `${example}.json`));
  }
  execFileSync(process.execPath, [cli, ...args], { stdio: "inherit" });
  if (FRAMED.includes(example)) {
    writeFileSync(join(public_folder, "frames", `${example}.html`), with_shim(readFileSync(page, "utf8")));
  }
}

const diff_data = JSON.parse(readFileSync(join(website, "src", "data", "oxide-lite-diff.json"), "utf8"));
writeFileSync(join(public_folder, "frames", "oxide-lite-diff.html"), with_shim(with_data(diff_data)));

console.log("Built the demo pages, the figure frames and the map for the first code block.");
