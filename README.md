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
