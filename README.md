# capisce

A map of a codebase at the level of business behavior.

capisce builds one page from your code and a small set of hand-written files:

- **Domains** on a canvas, with how they relate.
- **Flows** in plain words, across endpoints.
- **Pseudo-code** beside the real code, with a trace of how calls hand off.
- **Changes**: what a branch changed, at this level.
- **Comments and notes** on the page.

Models, endpoints and functions are read from the code. Pseudo-code and flows are written by people or agents, and stamped against the code they describe. When that code changes, `capisce check` fails until the map is reviewed.

## Use

```sh
pnpm install && pnpm build          # once, to build the page
node bin/capisce.mjs build out.html --root /path/to/project
node bin/capisce.mjs check --root /path/to/project
node bin/capisce.mjs stamp --root /path/to/project
node bin/capisce.mjs serve /path/to/folder --port 8094
```

A project needs a `capisce.config.mjs` at its root. `check` and `stamp` need no install.

## Skills

- `skills/build-map`: build a map for a codebase that has none.
- `skills/maintain`: keep a map in step with the code.

`node bin/capisce.mjs skill <name>` prints one.

## Examples

- `examples/help-desk`: a Go web application and its map.
- `examples/cloud-console`: a Rust API service and the TypeScript console that calls it, with a map that traces from a click in the console into the service.

## Develop the page

The page is a Svelte app in `viewer/`, built into one file at `dist/viewer.html`.

```sh
node bin/capisce.mjs build --json viewer/dev-data.json --root /path/to/project
pnpm dev        # then open http://localhost:5173/viewer.html
pnpm check
```
