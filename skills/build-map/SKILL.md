---
name: build-map
description: Build a capisce map for a codebase that has none: write the config, lay out the domains, and write the first pseudo-code and flows. Use when asked to set up capisce or to map a codebase for the first time.
---

# Build a map for the first time

A capisce map lets someone read a codebase at the level of business behavior: its domains and how they relate, the flows through them, and pseudo-code beside the real code. Building one is five steps. Read the maintain skill too (`capisce skill maintain`): it has the format of a block and the rules for writing one.

Run capisce as `node <capisce>/bin/capisce.mjs <command>` from the root of the project, and add scripts that wrap `build`, `check` and `stamp` so others do not need the path.

## 1. Learn the codebase's shape

Before writing anything, find out:

- Where the business logic lives, and how files are named (services, handlers, use cases).
- Where requests enter (routes, controllers, commands, jobs) and how one is defined in code.
- Where the data model is defined.
- The nouns the people who own the product use. The domains should be their words, not folder names.

## 2. Write `capisce.config.mjs`

At the root of the project:

```js
export default {
  name: "Shop",
  maps: "capisce/maps",
  domains: "capisce/domains.map",
  stamps: "capisce/stamps.json",
  sources: ["server"],
  commands: { stamp: "npm run map:stamp" },
  extract: [
    { use: "functions", files: "server/services/*_service.ts" },
    { use: "routes", files: "server/routes/*.ts" },
    { use: "./capisce/models.mjs", files: "server/models/*.ts" },
  ],
};
```

- **`sources`** are the folders a branch comparison needs from an older commit.
- **`commands.stamp`** is what the check tells people to run.
- **`extract`** says what is read from the code. Each rule finds symbols in the files it names.
  - `functions` finds exported functions. Each becomes `<file>.<name>`. Give `patterns` (regular expressions with a `name` group) for another language or style.
  - `routes` finds endpoints, and makes each one something the check requires pseudo-code for. Give `definition` (a line that starts an endpoint) and `pattern` (with `method` and `path` groups) if the framework does not write `app.get("/path", …)`.
  - A path names your own extractor: a module whose default export takes `{ rule, files, lines_of, statement_at, short_doc }` and returns `{ symbols, required, links }`. Use one for the data model, since every framework defines models differently. Give each model `kind: "model"` and write its `pseudo` from its fields; return `links` as `{ from, field, to }` for fields that point at another model. `required` lists places (`{ path, line, start, end }`) that must have pseudo-code.

Run `capisce build out.html --json out.json` and read the JSON to see what was found. Fix the rules until the symbols are the ones a reader would expect: no tests, no generated code, no helpers nobody would look up.

## 3. Lay out the domains

Write the domains file. A domain is a noun the business uses, with the code that belongs to it.

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
- **`models`** names the models it holds. **`files`** lists its files, with `*` where that helps.
- **`relations`** are drawn as arrows on the canvas, so keep them to the few that matter and to neighbours where you can. **`more`** are relations shown on the domain's page only.
- One domain may have `frame: true`: it is drawn as a frame around the rest, for the thing everything belongs to, such as an account or a workspace.
- A domain with `hidden: true` holds files that are not part of the business, such as logging.

The build fails until every file the config reads, and every model, is in a domain. Aim for about six to twelve domains. Ask the owner to look at the canvas before going on: a wrong split is cheap to fix now.

## 4. Write the map, one domain at a time

Create `shared.map` in the maps folder first, for names every domain uses (the signed-in user, the helper that reads a request body, and so on). Then, for each domain, write `<domain>.map`:

- A block for everything the check requires.
- Blocks for the functions those lean on, where the behavior is worth reading.
- Two to five flows.

Domains do not depend on each other's map files, so several agents can write them at once, one file each. Have each build with `--only <its file>` so unfinished files do not break the others. Tell each which files are its own and that ids must be unique across files.

Write only what the code does. Each author should reread a few of their blocks against the code before finishing, and report anything the code does that looks wrong: mapping a codebase turns up bugs.

## 5. Check, stamp and share

- `capisce build out.html` with every map file. Fix any id used twice and any stage that points at nothing.
- Read the domain descriptions again against what the authors found, and correct them.
- `capisce check`, then `capisce stamp`. Commit the map files, the config and the stamps.
- Add `capisce check` to the project's own checks, and tell contributors about the maintain skill.
- `capisce serve <folder>` serves a built page (copy it there as `index.html`) with comments and notes, for review.
