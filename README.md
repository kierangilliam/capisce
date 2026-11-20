# capisce

A map of a codebase at the level of business behavior.

capisce builds one page from your code and a small set of hand-written files:

- **Domains** on a canvas, with how they relate.
- **Flows** in plain words, across endpoints.
- **Pseudo-code** beside the real code, with a trace of how calls hand off.
- **Changes**: what a branch changed, at this level.
- **Comments and notes** on the page, with replies from the agent that looks after the map.

Models, endpoints and functions are read from the code. Pseudo-code and flows are written by people or agents, and stamped against the code they describe. When that code changes, `capisce check` fails until the map is reviewed.

## Use

```sh
pnpm install && pnpm build          # once, to build the page
cd /path/to/project                 # or pass --root /path/to/project to any command
node /path/to/capisce/bin/capisce.mjs build                  # write the page to .capisce/index.html
node /path/to/capisce/bin/capisce.mjs build out.html         # or to a file of your choice
node /path/to/capisce/bin/capisce.mjs check                  # fail when the map needs a review
node /path/to/capisce/bin/capisce.mjs stamp                  # record that the map was reviewed
node /path/to/capisce/bin/capisce.mjs serve --port 8094      # build, then serve the page with comments and notes
node /path/to/capisce/bin/capisce.mjs comments               # print the comments that wait on a reply
node /path/to/capisce/bin/capisce.mjs reply <id> "<text>" --done   # answer one in its thread
```

A project needs a `capisce.config.mjs` at its root. `check`, `stamp`, `comments` and `reply` need no install.

## Comments

`capisce serve` shows the page with comments turned on. Press **C**, then click anywhere on the page to pin a comment, or drag to draw. A comment can hold pictures: attach one, or paste it. Comments open in a small sheet at the bottom right. It lists the open ones; older ones are a click away, grouped by when they were left.

Each comment is a thread. An agent reads the waiting threads with `capisce comments`, makes the change, and answers with `capisce reply`. The page then shows a notice for the new reply. Opening the thread marks it read, and it can be marked unread again. A new message from the reader opens a finished thread again.

Notes (**N**) are for ideas about the map as a whole.

## The `.capisce` folder

Everything capisce keeps for a project that is not the map itself lives in one state folder: `.capisce` at the project's root.

```text
.capisce/
  index.html                 the built page
  comments.json              the comments and their threads
  notes.json                 the notes
  comments/screenshots/      the pictures attached to comments
```

`--state <folder>` or the `CAPISCE_STATE` environment variable puts it somewhere else, for example to share one set of comments between several checkouts of a project.

`index.html` is built, so never commit it. Whether to commit the rest is up to the project: ignore all of `.capisce/` when comments are one person's review notes (the examples do this), or ignore only `.capisce/index.html` when the team wants to share them.

`node src/server.mjs <state folder>` serves a state folder without building, on `PORT`. Use it to keep a page up as a service and rebuild `index.html` beside it.

## Skills

- `skills/build-map`: build a map for a codebase that has none.
- `skills/maintain`: keep a map in step with the code.
- `skills/address-comments`: answer the comments a reader left on the page.

`node bin/capisce.mjs skill <name>` prints one.

## Examples

- `examples/help-desk`: a Go web application and its map.
- `examples/cloud-console`: a Rust API service and the TypeScript console that calls it, with a map that traces from a click in the console into the service.

To look at one, build the page once (`pnpm install && pnpm build` here), then run `make serve` (cloud-console) or `make map-serve` (help-desk) in the example's folder and open http://127.0.0.1:8094.

## Develop the page

The page is a Svelte app in `viewer/`, built into one file at `dist/viewer.html`.

```sh
node bin/capisce.mjs build --json viewer/dev-data.json --root /path/to/project
pnpm dev        # then open http://localhost:5173/viewer.html
pnpm check
```
