# capisce website

The one-page site for capisce. It is a Svelte 5 + Vite app that builds to a static `dist/`.

The prose is plain HTML in `index.html`. Each figure is a Svelte component (`src/figure.svelte`) that shows the real capisce page in a frame and plays a short scene on it (`src/scenarios.ts`), with a pretend cursor that clicks real elements (`src/stage.ts`).

## Build

```sh
pnpm install && pnpm build      # at the repository root, once: builds dist/viewer.html
cd website
pnpm install
pnpm build                      # writes website/dist
pnpm preview                    # serves it at http://localhost:8213
```

`pnpm build` first runs `scripts/build_pages.mjs`, which uses the capisce command line to build:

- `public/demo/<example>/index.html`: each example's page, as `capisce build` writes it. The site links to these.
- `public/frames/*.html`: the same page with `scripts/frame_shim.js` at the top. The shim stands in for the server of `capisce serve`, so the figures can show comments.
- `src/generated/side_by_side.json`: the function shown beside its Rust code at the top of the page.

The Diffs figure reads `src/data/oxide-lite-diff.json`, a real build with `--base main` of a small change to the oxide-lite example. `pnpm diff-data` makes it again, for example after the example or the map format changes.

## Deploy

The site is static assets on a Cloudflare Worker.

1. Copy `.env.example` to `.env` and fill it in.
2. Run `pnpm run deploy`.

It builds, then runs `wrangler deploy --assets dist --name $CF_WORKER_NAME --domain …` for each domain in `CF_DOMAINS`. A domain's zone must be on the same Cloudflare account.

To use Cloudflare Pages instead: `pnpm build && npx wrangler pages deploy dist --project-name <project>`.
