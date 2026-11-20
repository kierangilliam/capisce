// Keeps the map honest: stamps what was reviewed, says what needs a review, and compares two maps.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const stamped = (map) =>
  Object.fromEntries(
    map.symbols
      .filter((symbol) => symbol.authored && symbol.src.path !== "")
      .map((symbol) => [symbol.id, symbol.hash])
      .sort(([a], [b]) => a.localeCompare(b)),
  );

/** Why the pseudo-code needs a review, as lines to print. Empty when it does not. */
export function review_needed(map, root, config) {
  const stamps = stamped(map);
  const stamps_path = join(root, config.stamps);
  let lock = {};
  if (existsSync(stamps_path)) {
    lock = JSON.parse(readFileSync(stamps_path, "utf8"));
  }
  const by_id = new Map(map.symbols.map((symbol) => [symbol.id, symbol]));
  const where = (id) => {
    const { src, also } = by_id.get(id);
    let also_note = "";
    if (also !== undefined) {
      also_note = `    or the code on its also: line (${also.split(" :: ")[0]})`;
    }
    return `  ${id}    ${src.path}:${src.start}${also_note}`;
  };
  const changed = Object.keys(stamps).filter((id) => lock[id] !== undefined && lock[id] !== stamps[id]);
  const unstamped = Object.keys(stamps).filter((id) => lock[id] === undefined);
  const gone = Object.keys(lock).filter((id) => stamps[id] === undefined);
  const mapped = map.symbols.filter((symbol) => symbol.authored && symbol.src.path !== "");
  const unmapped = map.required
    .filter(
      (definition) =>
        !mapped.some(
          ({ src }) => src.path === definition.path && src.start <= definition.end && src.end >= definition.start,
        ),
    )
    .map((definition) => `  ${definition.path}:${definition.line}`);

  const lines = [];
  if (changed.length > 0) {
    lines.push("The code changed. Its pseudo-code has not been reviewed since:", ...changed.map(where), "");
  }
  if (unmapped.length > 0) {
    lines.push("Code that must have pseudo-code and has none:", ...unmapped, "");
  }
  if (unstamped.length > 0) {
    lines.push("Pseudo-code that was never stamped:", ...unstamped.map(where), "");
  }
  if (gone.length > 0) {
    lines.push("Stamps for pseudo-code that is gone:", ...gone.map((id) => `  ${id}`), "");
  }
  if (lines.length > 0) {
    lines.push(
      `For each one, read the code and update its block in ${config.maps}/ so it says what the code now does.`,
      `Add a block for new code, and update any flow whose steps changed. The maintain skill has the format.`,
      `Then run: ${config.commands.stamp}`,
    );
  }
  return lines;
}

/** The lines of `after` against `before`: kept " ", added "+", removed "-". */
function line_diff(before, after) {
  const rows = before.length + 1;
  const columns = after.length + 1;
  const common = Array.from({ length: rows }, () => new Uint16Array(columns));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      if (before[i] === after[j]) {
        common[i][j] = common[i + 1][j + 1] + 1;
      } else {
        common[i][j] = Math.max(common[i + 1][j], common[i][j + 1]);
      }
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      ops.push([" ", after[j]]);
      i += 1;
      j += 1;
    } else if (j < after.length && (i === before.length || common[i][j + 1] >= common[i + 1][j])) {
      ops.push(["+", after[j]]);
      j += 1;
    } else {
      ops.push(["-", before[i]]);
      i += 1;
    }
  }
  return ops;
}

/** The steps of a symbol's pseudo-code: each `#>` line with the lines under it. */
function steps_of(pseudo) {
  const steps = [];
  for (const line of pseudo) {
    const header = /^\s*#> (.*)$/.exec(line)?.[1];
    if (header !== undefined) {
      steps.push({ title: header.split(" | ")[0].split(" -> ")[0].trim(), body: [line] });
    } else if (steps.length > 0) {
      steps.at(-1).body.push(line);
    }
  }
  return steps;
}

/** The steps of `after` against `before`, in order: kept " ", changed "~", added "+", removed "-". */
function step_diff(before, after) {
  const was = steps_of(before);
  const now = steps_of(after);
  const was_body = new Map(was.map((step) => [step.title, step.body.join("\n")]));
  return line_diff(
    was.map((step) => step.title),
    now.map((step) => step.title),
  ).map(([op, title]) => {
    const body = now.find((step) => step.title === title)?.body.join("\n");
    if (op === " " && was_body.get(title) !== body) {
      return ["~", title];
    }
    return [op, title];
  });
}

/** What changed from the `base` map to the `head` map, written onto the head's symbols and domains. */
export function mark_changes(base, head) {
  const was = new Map(base.symbols.map((symbol) => [symbol.id, symbol]));
  const now = new Map(head.symbols.map((symbol) => [symbol.id, symbol]));
  const changes = [];

  for (const symbol of head.symbols) {
    const before = was.get(symbol.id);
    if (before === undefined) {
      symbol.diff = { status: "added", parts: [] };
      if (symbol.pseudo.length > 0) {
        symbol.diff.pseudo = symbol.pseudo.map((line) => ["+", line]);
        symbol.diff.steps = step_diff([], symbol.pseudo);
      }
      changes.push(symbol.id);
      continue;
    }
    const parts = [];
    const diff = { status: "changed", parts };
    if (before.doc !== symbol.doc && symbol.authored) {
      parts.push("doc");
      diff.doc_before = before.doc;
    }
    if (before.pseudo.join("\n") !== symbol.pseudo.join("\n")) {
      parts.push("pseudo");
      diff.pseudo = line_diff(before.pseudo, symbol.pseudo);
      diff.steps = step_diff(before.pseudo, symbol.pseudo);
      if (diff.steps.some(([op]) => op !== " ")) {
        parts.push("flow");
      }
    }
    if (before.hash !== symbol.hash) {
      parts.push("code");
      diff.code = line_diff(before.src.code.split("\n"), symbol.src.code.split("\n"));
      diff.code_start = before.src.start;
    }
    if (parts.length > 0) {
      symbol.diff = diff;
      changes.push(symbol.id);
    }
  }
  for (const symbol of base.symbols) {
    if (!now.has(symbol.id)) {
      head.symbols.push({
        ...symbol,
        diff: {
          status: "removed",
          parts: [],
          pseudo: symbol.pseudo.map((line) => ["-", line]),
          steps: step_diff(symbol.pseudo, []),
        },
      });
      changes.push(symbol.id);
    }
  }

  const was_domains = new Map(base.domains.map((domain) => [domain.id, domain]));
  const relation_names = (domain) =>
    [...domain.relations, ...domain.more].map((relation) => `${relation.label} ${relation.to}`);
  for (const domain of head.domains) {
    const before = was_domains.get(domain.id);
    if (before === undefined) {
      domain.diff = { status: "added", parts: [] };
      changes.push(`domain:${domain.id}`);
      continue;
    }
    const parts = [];
    const diff = { status: "changed", parts };
    if (before.doc !== domain.doc) {
      parts.push("doc");
      diff.doc_before = before.doc;
    }
    const relations = line_diff(relation_names(before), relation_names(domain)).filter(([op]) => op !== " ");
    if (relations.length > 0) {
      parts.push("relations");
      diff.relations = relations;
    }
    if (parts.length > 0) {
      domain.diff = diff;
      changes.push(`domain:${domain.id}`);
    }
  }
  return changes;
}
