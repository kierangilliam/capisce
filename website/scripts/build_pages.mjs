// Builds what the site serves beside its own page, from the capisce command line and the two examples:
//   public/demo/<example>/index.html   each example's page, exactly as `capisce build` writes it
//   public/frames/<name>.html          the same page with a stand-in for the comments server, for the figures
//   src/generated/side_by_side.json    one function's pseudo-code and its real code, for the first code block
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
const EXAMPLES = ["cloud-console", "help-desk"];
const FRAMED = ["cloud-console"];
const SIDE_BY_SIDE = "POST /v1/instances";

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

const maps = {};
for (const example of EXAMPLES) {
  const root = join(repo, "examples", example);
  const page = join(public_folder, "demo", example, "index.html");
  const data = join(generated, `${example}.json`);
  execFileSync(process.execPath, [cli, "build", page, "--json", data, "--root", root], { stdio: "inherit" });
  maps[example] = JSON.parse(readFileSync(data, "utf8"));
  rmSync(data);
  if (FRAMED.includes(example)) {
    writeFileSync(join(public_folder, "frames", `${example}.html`), with_shim(readFileSync(page, "utf8")));
  }
}

const diff_data = JSON.parse(readFileSync(join(website, "src", "data", "cloud-console-diff.json"), "utf8"));
writeFileSync(join(public_folder, "frames", "cloud-console-diff.html"), with_shim(with_data(diff_data)));

const symbol = maps["cloud-console"].symbols.find((each) => each.id === SIDE_BY_SIDE);
if (symbol === undefined) {
  console.error(`The cloud-console map has no "${SIDE_BY_SIDE}" any more. Pick another function in scripts/build_pages.mjs.`);
  process.exit(1);
}
const side_by_side = { id: symbol.id, pseudo: symbol.pseudo.join("\n"), code: symbol.src.code, path: symbol.src.path };
writeFileSync(join(generated, "side_by_side.json"), `${JSON.stringify(side_by_side, null, 2)}\n`);
console.log("Built the demo pages, the figure frames and the side-by-side code.");
