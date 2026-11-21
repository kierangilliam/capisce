# capisce

A map of a codebase at the level of business behavior.

capisce builds one page from your code and a small set of hand-written files:

- **Domains** on a canvas, with how they relate.
- **Flows** in plain words, across endpoints.
- **Pseudo-code** beside the real code, with a trace of how calls hand off.
- **Changes**: what a branch changed, at this level.
- **Comments and notes** on the page, with replies from the agent that looks after the map.
- **Timings**: how long each endpoint takes where the project runs, from your own tracing tool.

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
node /path/to/capisce/bin/capisce.mjs timings                # fetch how long each endpoint takes
node /path/to/capisce/bin/capisce.mjs comments               # print the comments that wait on a reply
node /path/to/capisce/bin/capisce.mjs reply <id> "<text>" --done   # answer one in its thread
```

A project needs a `capisce.config.mjs` at its root. The setup skill says how to write one. `check`, `stamp`, `comments` and `reply` need no install.

## Comments

`capisce serve` shows the page with comments turned on. Press **C**, then click anywhere on the page to pin a comment, or drag to draw. A comment can hold pictures: attach one, or paste it. Comments open in a small sheet at the bottom right. It lists the open ones; older ones are a click away, grouped by when they were left.

Each comment is a thread. An agent reads the waiting threads with `capisce comments`, makes the change, and answers with `capisce reply`. The page then shows a notice for the new reply. Opening the thread marks it read, and it can be marked unread again. A new message from the reader opens a finished thread again.

Notes (**N**) are for ideas about the map as a whole.

## Timings

The page can show how long each endpoint takes where the project runs. Press **Tab**, or the **Timings** button, to turn them on. An endpoint's page then shows a line such as `42 ms typical · 310 ms slow · 1,840 requests in 7 days` above its trace, and the list on the left shows each endpoint's typical time. "Typical" is the median (p50). "Slow" is the 95th percentile (p95).

capisce does not know your tracing tool, so the project plugs in a source. Name a module in `capisce.config.mjs`:

```js
export default {
  // …
  timings: "./capisce/timings.mjs",
};
```

The module's default export (or an export named `timings`) is a function. It gets the map's endpoint ids and returns a row for each endpoint it has numbers for:

```js
export default async function timings({ ids, symbols }) {
  // Ask your tracing tool, for example Sentry or OpenTelemetry, for each endpoint's request count and durations.
  return {
    window: "7d",          // optional: the time the numbers cover, such as "24h" or "7d"
    source: "production",  // optional: where they are from
    rows: [
      { id: "GET /api/orders", count: 1840, p50_ms: 42, p95_ms: 310, link: "https://traces.example.com/…" },
    ],
  };
}
```

- **`id`** is the endpoint's id in the map, such as `GET /api/orders/:id`. A row with any other id is dropped, so turn your tool's names into the map's.
- **`count`**, **`p50_ms`** and **`p95_ms`** are numbers. Durations are in milliseconds.
- **`link`** is optional. The line on the endpoint's page then opens it in a new tab, for example the endpoint's traces.
- **`steps`** is optional and kept for later: `[{ stage: 0, p50_ms, p95_ms }]`, one for each stage of the endpoint's pseudo-code, counted from 0. The page does not show them yet.
- Returning the list of rows alone works too.

```sh
node /path/to/capisce/bin/capisce.mjs timings
```

This runs the source and writes `timings.json` to the state folder, as `{ fetched_at, window, source, rows }`. It says how many endpoints got timings and how many have none. Run it again whenever you want fresher numbers: the served page reads the file on each load, with no rebuild. The numbers are not part of the built page, and `timings.json` should not be committed. A page with no timings shows no button.

`examples/help-desk/capisce/timings.mjs` is a small source to copy from. Its numbers are made up.

## The `.capisce` folder

Everything capisce keeps for a project that is not the map itself lives in one state folder: `.capisce` at the project's root.

```text
.capisce/
  index.html                 the built page
  comments.json              the comments and their threads
  notes.json                 the notes
  timings.json               how long each endpoint takes, written by `capisce timings`
  comments/screenshots/      the pictures attached to comments
```

`--state <folder>` or the `CAPISCE_STATE` environment variable puts it somewhere else, for example to share one set of comments between several checkouts of a project.

`index.html` is built and `timings.json` is fetched, so never commit them. Whether to commit the rest is up to the project: ignore all of `.capisce/` when comments are one person's review notes (the examples do this), or ignore only `.capisce/index.html` and `.capisce/timings.json` when the team wants to share them.

`node src/server.mjs <state folder>` serves a state folder without building, on `PORT`. Use it to keep a page up as a service and rebuild `index.html` beside it.

## Skills

Three skills tell an agent how to work with a map:

- **setup**: this builds capisce's state on a new codebase. To be used once during setup.
- **update**: this updates capisce's state by writing pseudo-code and updating the glossary for new code changes.
- **address-comments**: an agent will pull your comments and address them, either replying to your comment or making a change to your codebase.

The glossary is the map's terms: the words of the business, each said once in plain words.

Each skill is one file, `skills/<name>/SKILL.md`. `node bin/capisce.mjs skill <name>` prints one, for any agent.

### Install the skills

**As a Claude Code plugin.** This repository is a plugin named `capisce`, and a marketplace that lists it. In Claude Code:

```text
/plugin marketplace add <owner>/capisce
/plugin install capisce@capisce
```

The skills then appear as `/capisce:setup`, `/capisce:update` and `/capisce:address-comments`. To try the plugin from a clone without installing it, start Claude Code with `claude --plugin-dir /path/to/capisce`.

**With the skills CLI**, for other agents:

```sh
npx skills add <owner>/capisce
```

This copies the skills into the project for the agents you pick. They keep their plain names there: `setup`, `update` and `address-comments`. If `setup` or `update` clashes with a skill you already have, install one skill at a time under another name, for example `npx skills add <owner>/capisce --skill setup --rename capisce-setup`.

Both ways install only the skills. The skills run the capisce command line, so keep a clone of this repository as well.

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
