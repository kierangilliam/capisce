// Deploys dist/ as static assets on Cloudflare Workers, with wrangler.
// It reads the account's values from the environment (pnpm run deploy loads them from .env). See .env.example.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WRANGLER = "wrangler@4.166.0";
const COMPATIBILITY_DATE = "2026-11-01";
const website = join(dirname(fileURLToPath(import.meta.url)), "..");

const name = process.env.CF_WORKER_NAME;
if (name === undefined || name === "") {
  console.error("Set CF_WORKER_NAME in website/.env (see .env.example), then run this again.");
  process.exit(1);
}
if (!existsSync(join(website, "dist", "index.html"))) {
  console.error("There is no build to deploy. Run pnpm build first.");
  process.exit(1);
}
const domains = (process.env.CF_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim())
  .filter((domain) => domain !== "")
  .flatMap((domain) => ["--domain", domain]);

execFileSync(
  "pnpm",
  ["dlx", WRANGLER, "deploy", "--assets", "dist", "--name", name, "--compatibility-date", COMPATIBILITY_DATE, ...domains],
  { cwd: website, stdio: "inherit" },
);
