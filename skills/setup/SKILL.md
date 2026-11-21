---
name: setup
description: This builds capisce's state on a new codebase. To be used once during setup. Use when asked to set up capisce or to map a codebase for the first time. It writes the config, lays out the domains, and writes the first pseudo-code, flows and glossary.
---

# Set up capisce on a codebase

A capisce map lets someone read a codebase at the level of business behavior: its domains and how they relate, the flows through them, and pseudo-code beside the real code. Building one is five steps. Read the update skill too (`capisce skill update`): it has the format of a block and the rules for writing one.

To run capisce, clone its repository and build the page once (`pnpm install && pnpm build` in that folder). Then run `node <capisce>/bin/capisce.mjs <command>` from the root of the project. `capisce skill <name>` prints any of the skills named here. Add commands that wrap `build`, `check` and `stamp` so others do not need the path: package scripts, a Makefile, or whatever the project already uses.

## 1. Learn the codebase's shape

Before writing anything, find out:

- Where the business logic lives, and how files are named (services, handlers, use cases).
- Where requests enter (routes, controllers, commands, jobs) and how one is defined in code.
- Where the data model is defined.
- The nouns the people who own the product use. The domains should be their words, not folder names.
- Whether file names are unique and say what they hold. Ids and the lanes of a trace come from the file's name (or its folder's), so two `mod.rs` or `index.ts` files clash until the config names them apart.

## 2. Write `capisce.config.mjs`

At the root of the project:

```js
export default {
  name: "Shop",
  sources: ["server"],
  commands: { stamp: "npm run map:stamp" },
  extract: [
    { use: "functions", files: "server/services/*_service.ts" },
    { use: "routes", files: "server/routes/*.ts" },
    { use: "./.capisce/models.mjs", files: "server/models/*.ts" },
  ],
};
```

- The map lives in `.capisce` at the project's root: `.capisce/maps/` for the map files, `.capisce/domains.map` and `.capisce/stamps.json`. They are committed. Leave `maps`, `domains` and `stamps` out of the config unless the project must keep them elsewhere. Put your own extractors in `.capisce` too.
- **`sources`** are the folders a branch comparison needs from an older commit.
- **`commands.stamp`** is what the check tells people to run.
- **`extract`** says what is read from the code. Each rule finds symbols in the files it names. `files` is one glob or a list (`*` stays in one folder, `**` crosses folders). `exclude` is a list of globs to leave out; tests are left out by default (`*.test.*`, `*.spec.*`, `*_test.*`, `test_*`), and giving `exclude` replaces that list, so repeat the test globs you still need.
  - `functions` finds exported functions. Each becomes `<file>.<name>`. Give `patterns` (regular expressions with a `name` group) for another language or style. Where people name things by folder and type, not by file, set `module: "folder"` and add a `receiver` group: the id becomes `<folder>.<receiver>.<name>`, such as `orders.Service.Refund`. Narrow the `name` group to what a reader would look up: `[A-Z]\w*` reads only what Go exports, for example. Two functions must never get the same id: the build fails if they do.
  - `routes` finds endpoints (it takes `module: "folder"` too), and makes each one something the check requires pseudo-code for. Give `definition` (a line that starts an endpoint) and `pattern` (with `method` and `path` groups) if the framework does not write `app.get("/path", …)`. Give `span` when the method and path sit more than two lines into the definition.
  - A path names your own extractor: a module whose default export takes `{ rule, files, lines_of, statement_at, short_doc }` and returns `{ symbols, required, links }`. `files(globs, exclude)` lists matching paths; `lines_of(path)` gives a file's lines; `statement_at(path, line_index)` gives `{ src, comment }` for the statement starting on that line, where `src` is `{ path, start, end, code }`; `short_doc(comment)` trims a comment to a description. A symbol is `{ id, kind, doc, src }`, with `pseudo` (a list of lines) if you generate it; in a model's pseudo-code, `# -> [[Other]]` after a field links it to that model. The examples folder has extractors to copy from. Use one for the data model, since every framework defines models differently. Give each model `kind: "model"` and write its `pseudo` from its fields; return `links` as `{ from, field, to }` for fields that point at another model. `required` lists places (`{ path, line, start, end }`) that must have pseudo-code.

Patterns for other languages, as a start:

```js
// Go: functions and methods, named by package and type
{ use: "functions", files: "internal/**/*.go", module: "folder",
  patterns: [/^func (?:\(\w+ \*?(?<receiver>\w+)\) )?(?<name>\w+)[\[(]/] },
// Go: mux.HandleFunc("POST /orders/{id}/refund", h.refund)
{ use: "routes", files: "web/routes.go", span: 1,
  definition: /^\s*mux\.HandleFunc\(/,
  pattern: /HandleFunc\("(?<method>[A-Z]+) (?<path>[^"]+)"/ },
// Rust: pub fn and pub async fn, at any indent
{ use: "functions", files: "src/app/*.rs",
  patterns: [/^\s*pub(?:\(crate\))? (?:async )?fn (?<name>\w+)/] },
```

A statement is read from its first line to the line where its brackets close and it ends in `;` or `}`. Brackets inside a string that runs over several lines are still counted, so check the extracted code of anything near one. For a language without semicolons, list its file extension in `balanced_extensions` (`.go` is there already), so a statement ends as soon as its brackets close.

Run `capisce build out.html --json out.json` and read the JSON to see what was found. Fix the rules until the symbols are the ones a reader would expect: no tests, no generated code, no helpers nobody would look up.

## 3. Lay out the domains

Write the domains file, `.capisce/domains.map`. A domain is a noun the business uses, with the code that belongs to it.

```text
=== Orders
at: 1,0
tag: What customers buy
doc: An order is what a customer bought, at the prices of that moment. It is paid, packed, shipped, and sometimes refunded.
models: Order, OrderLine
files: server/services/order_service.ts, server/services/refund_service.ts, server/routes/orders.ts
relations:
  Payments: are paid through
  Customers: belong to
more:
  Stock: reserve
```

- **`at`** is the column and row on the canvas. Put domains that relate next to each other.
- **`tag`** is a few words under the name. **`doc`** is what the domain is, in plain words, with the rules that matter.
- **`models`** names the models it holds. **`files`** lists its files, with `*` where that helps. When one file holds things from several domains (a single routes file, say), give those blocks a `domain:` line in the map instead.
- **`relations`** are drawn as arrows on the canvas, so keep them to the few that matter and to neighbours where you can. A label between neighbours has room for two or three short words. **`more`** are relations shown on the domain's page only.
- One domain may have `frame: true`: it is drawn as a frame around the rest, for the thing everything belongs to, such as an account or a workspace.
- A domain with `hidden: true` holds files that are not part of the business, such as logging.

The build fails until every file the config reads, and every model, is in a domain. Aim for about six to twelve domains. Ask the owner to look at the canvas before going on: a wrong split is cheap to fix now.

## 4. Write the map, one domain at a time

Create `shared.map` in the maps folder (`.capisce/maps/`) first, for names every domain uses (the signed-in user, the helper that reads a request body, and so on). The first glossary goes there too: a `kind: term` block for each word of the business a new reader would have to ask about, such as "workspace" or "seat". The update skill has the format. Then, for each domain, write `<domain>.map`:

- A block for everything the check requires.
- Blocks for the functions those lean on, where the behavior is worth reading.
- Two to five flows.

Domains do not depend on each other's map files, so several agents can write them at once, one file each. Have each build with `--only <its file>` so unfinished files do not break the others. Tell each which files are its own and that ids must be unique across files.

Write a list of fields that does not fit on one line as `update Order:` with one field to a line under it, indented once, each with a comma after it. Do not carry the list on under its first field.

Write only what the code does. Each author should reread a few of their blocks against the code before finishing, and report anything the code does that looks wrong: mapping a codebase turns up bugs.

## 5. Check, stamp and share

- `capisce build out.html` with every map file. Fix any id used twice and any stage that points at nothing.
- Read the domain descriptions again against what the authors found, and correct them.
- `capisce stamp`, then `capisce check` to confirm it passes. Commit the config and the `.capisce` folder: the map files, the domains, the stamps, your extractors and `.capisce/.gitignore`.
- Add `capisce check` to the project's own checks, and tell contributors about the update skill (`capisce skill update`).
- `capisce serve` builds the page and serves it with comments and notes, for review. The page, the timings, the comments and the notes are local files in the same `.capisce` folder. capisce writes `.capisce/.gitignore` so git leaves them out: commit that file, and do not add `.capisce/` to the project's own ignore file, or the map will not be committed. To share comments and notes through git, delete their three lines from `.capisce/.gitignore`.
- A branch comparison (`capisce build --base <git ref>`) reads the committed map of the older commit, so it only shows changes once the map is in git.
- Tell contributors about the address-comments skill (`capisce skill address-comments`): it is how an agent answers what a reader left on the page.
