# capisce website

The one-page site for capisce. It is a Svelte 5 + Vite app that builds to a static `dist/`.

The prose is plain HTML in `index.html`. Each figure is a Svelte component (`src/figure.svelte`) that shows the real capisce page in a frame and plays a short scene on it (`src/scenarios.ts`), with a pretend cursor that clicks real elements (`src/stage.ts`). On a screen narrower than 720px the frame is as wide as a phone, so the page inside stacks its panels as it does on a phone; a scenario's `narrow` says what differs there.

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
- `src/generated/oxide-lite.json`: the oxide-lite map. `vite.config.ts` renders the first code block from it at build time (`build/code_block.ts`): the Rust is highlighted by `build/rust_tokens.ts`, the pseudo-code by the capisce page's own tokenizer, and only the names the block mentions are put in the page for their tooltips (`src/code_symbols.ts`).

The Diffs figure reads `src/data/oxide-lite-diff.json`, a real build with `--base main` of a small change to the oxide-lite example. `pnpm diff-data` makes it again, for example after the example or the map format changes.

## Deploy

The site is static assets on a Cloudflare Worker.

1. Copy `.env.example` to `.env` and fill it in.
2. Run `pnpm run deploy`.

It builds, then runs `wrangler deploy --assets dist --name $CF_WORKER_NAME --domain …` for each domain in `CF_DOMAINS`. A domain's zone must be on the same Cloudflare account.

To use Cloudflare Pages instead: `pnpm build && npx wrangler pages deploy dist --project-name <project>`.
