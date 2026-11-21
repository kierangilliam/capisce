// Reads a codebase and its hand-written map into one description: symbols, domains and the links between them.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DOC_CHARS = 320;
const CONFIG_FILE = "capisce.config.mjs";
const DEFAULTS = {
  name: "",
  maps: "capisce/maps",
  domains: "capisce/domains.map",
  stamps: "capisce/stamps.json",
  sources: [],
  extract: [],
  commands: { stamp: "capisce stamp" },
  balanced_extensions: [".go"],
};

export async function load_config(root) {
  const path = join(root, CONFIG_FILE);
  if (!existsSync(path)) {
    throw new Error(`No ${CONFIG_FILE} in ${root}. The setup skill says how to write one.`);
  }
  const config = (await import(pathToFileURL(path).href)).default;
  return { ...DEFAULTS, ...config, commands: { ...DEFAULTS.commands, ...config.commands } };
}

function parse_blocks(text) {
  return text
    .split(/^=== /m)
    .slice(1)
    .map((block) => {
      const [head, ...body] = block.split(/^---\n/m);
      const [id, ...header_lines] = head.trimEnd().split("\n");
      return { id: id.trim(), header_lines, body: body.join("---\n").trimEnd() };
    });
}

function parse_symbols(text) {
  return parse_blocks(text).map(({ id, header_lines, body }) => {
    const symbol = { id, pseudo: [] };
    if (body !== "") {
      symbol.pseudo = body.split("\n");
    }
    for (const line of header_lines) {
      const [key, ...rest] = line.split(": ");
      symbol[key] = rest.join(": ").trim();
    }
    return symbol;
  });
}

const names_of = (text) => (text ?? "").split(",").flatMap((name) => (name.trim() === "" ? [] : [name.trim()]));

function parse_domains(text) {
  return parse_blocks(text).map(({ id, header_lines }) => {
    const domain = { id, relations: [], more: [] };
    let list;
    for (const line of header_lines) {
      if (line.startsWith("  ")) {
        const [to, ...label] = line.trim().split(": ");
        domain[list].push({ to, label: label.join(": ") });
        continue;
      }
      const [key, ...rest] = line.split(": ");
      list = key.replace(":", "");
      domain[key.replace(":", "")] ??= rest.join(": ").trim();
    }
    return {
      id,
      tag: domain.tag ?? "",
      doc: domain.doc ?? "",
      frame: domain.frame === "true",
      hidden: domain.hidden === "true",
      at: names_of(domain.at).map(Number),
      models: names_of(domain.models),
      files: names_of(domain.files),
      relations: domain.relations,
      more: domain.more,
    };
  });
}

// Brackets inside strings and comments do not count.
function bracket_depth_change(line) {
  const code = line
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "")
    .replace(/\/\/.*$/, "");
  let change = 0;
  for (const char of code) {
    if ("({[".includes(char)) {
      change += 1;
    }
    if (")}]".includes(char)) {
      change -= 1;
    }
  }
  return change;
}

/** A glob as a pattern: `*` stays inside one folder, `**` crosses folders. */
function glob_pattern(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0000")
    .replace(/\*\*/g, "\u0001")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, "(?:.*/)?")
    .replace(/\u0001/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/** How one checkout's files are read. Every path is relative to `root`. */
function source_reader(root, config) {
  const file_lines = new Map();
  const lines_of = (path) => {
    if (!file_lines.has(path)) {
      file_lines.set(path, readFileSync(join(root, path), "utf8").split("\n"));
    }
    return file_lines.get(path);
  };

  /** The statement that starts on line `index`, with the comment above it. */
  const statement_at = (path, index) => {
    const lines = lines_of(path);
    let start = index;
    let end = index;
    let depth = 0;
    // A language without semicolons ends a statement as soon as its brackets close.
    const balanced = config.balanced_extensions.includes(extname(path));
    for (; end < lines.length; end += 1) {
      depth += bracket_depth_change(lines[end]);
      if (depth <= 0 && (balanced || /[;}]$/.test(lines[end].trim()))) {
        break;
      }
    }
    // Comments, and one-line attributes or decorators, sit above a definition and belong to it.
    while (start > 0 && /^\s*(\/\/|\/\*\*|\*|#\[.*\]$|@\w)/.test(lines[start - 1])) {
      start -= 1;
    }
    const comment = lines
      .slice(start, index)
      .filter((line) => !/^\s*(#\[|@\w)/.test(line))
      .map((line) => line.replace(/^\s*(\/\*\*|\*\/|\*|\/\/+!?)\s?/, "").replace(/\s*\*\/$/, ""))
      .join(" ")
      .trim();
    return {
      src: { path, start: start + 1, end: end + 1, code: lines.slice(start, end + 1).join("\n") },
      comment,
    };
  };

  const walk = (folder) => {
    if (!existsSync(join(root, folder))) {
      return [];
    }
    return readdirSync(join(root, folder)).flatMap((name) => {
      const path = folder === "" ? name : `${folder}/${name}`;
      if (name === "node_modules" || name === ".git") {
        return [];
      }
      if (statSync(join(root, path)).isDirectory()) {
        return walk(path);
      }
      return [path];
    });
  };

  /** The files that match any of `globs` and none of `exclude`, in order. */
  const files = (globs, exclude = []) => {
    const skip = exclude.map(glob_pattern);
    return [globs].flat().flatMap((glob) => {
      const fixed = glob.split("/").slice(0, glob.split("/").findIndex((part) => part.includes("*")));
      const pattern = glob_pattern(glob);
      return walk(fixed.join("/"))
        .filter((path) => pattern.test(path) && !skip.some((each) => each.test(path)))
        .sort();
    });
  };

  return { lines_of, statement_at, files };
}

const short_doc = (comment) => {
  if (comment.length <= DOC_CHARS) {
    return comment;
  }
  return `${comment.slice(0, DOC_CHARS).replace(/\s+\S*$/, "")}…`;
};

const module_of = (path) => basename(path, extname(path));
const folder_of = (path) => basename(join(path, ".."));

const FUNCTION_PATTERNS = [
  /^export (?:async )?function (?<name>\w+)/,
  /^export const (?<name>[a-z]\w*) = (?:async )?[(<]/,
];
const ROUTE_DEFINITION = /^\s*app\.(get|post|put|patch|delete|all|on)\(/;
const ROUTE_ID = /^\s*\w+\.(?<method>get|post|put|patch|delete)\(\s*"(?<path>[^"]+)"/;
const TEST_FILES = ["**/*.test.*", "**/*.spec.*", "**/*_test.*", "**/test_*"];

/**
 * Finds the functions a file exports. Each becomes `<module>.<name>`, or `<module>.<receiver>.<name>` when the pattern
 * that matched has a `receiver` group. The module is the file's name, or its folder's with `module: "folder"`, for
 * languages where a folder is the unit people name.
 */
function extract_functions({ rule, files, lines_of, statement_at }) {
  const symbols = [];
  for (const path of files(rule.files, rule.exclude ?? TEST_FILES)) {
    let module = module_of(path);
    if (rule.module === "folder") {
      module = folder_of(path);
    }
    lines_of(path).forEach((line, index) => {
      const found = (rule.patterns ?? FUNCTION_PATTERNS).map((pattern) => pattern.exec(line)?.groups).find(Boolean);
      if (found === undefined) {
        return;
      }
      const { src, comment } = statement_at(path, index);
      const name = [found.receiver, found.name].filter(Boolean).join(".");
      symbols.push({ id: `${module}.${name}`, kind: "def", doc: short_doc(comment), module, src });
    });
  }
  return { symbols };
}

/**
 * Finds the endpoints a file defines. Each one must have pseudo-code, whether or not its path could be read.
 * `span` is how many lines from the start of a definition hold its method and path.
 */
function extract_routes({ rule, files, lines_of, statement_at }) {
  const symbols = [];
  const required = [];
  for (const path of files(rule.files, rule.exclude ?? TEST_FILES)) {
    const lines = lines_of(path);
    let module = module_of(path);
    if (rule.module === "folder") {
      module = folder_of(path);
    }
    lines.forEach((line, index) => {
      if (!(rule.definition ?? ROUTE_DEFINITION).test(line)) {
        return;
      }
      const { src, comment } = statement_at(path, index);
      const opening = lines.slice(index, index + (rule.span ?? 2)).join("");
      const found = (rule.pattern ?? ROUTE_ID).exec(opening)?.groups;
      let label = "";
      if (found !== undefined) {
        label = `${found.method.toUpperCase()} ${found.path}`;
      }
      required.push({ path, line: index + 1, start: src.start, end: src.end, label });
      if (found !== undefined) {
        symbols.push({
          id: `${found.method.toUpperCase()} ${found.path}`,
          kind: "route",
          group: module_of(path),
          doc: short_doc(comment),
          module,
          src,
        });
      }
    });
  }
  return { symbols, required };
}

const EXTRACTORS = { functions: extract_functions, routes: extract_routes };

async function extractor_of(rule, config_root) {
  if (EXTRACTORS[rule.use] !== undefined) {
    return EXTRACTORS[rule.use];
  }
  return (await import(pathToFileURL(resolve(config_root, rule.use)).href)).default;
}

/** A flow is a story told in plain words, so it has no source of its own. */
const NO_SOURCE = { path: "", start: 0, end: 0, code: "" };

/**
 * Reads the map of the checkout at `root`. `config_root` is where the config and its own extractors live: the same
 * place, unless `root` is an older commit unpacked elsewhere. `only` reads one map file with the shared one. An older
 * commit is read with `strict` off, since its domains may not hold every file today's config reads.
 */
export async function build_map(root, config, { config_root = root, only, strict = true } = {}) {
  const source = source_reader(root, config);
  const maps_folder = join(root, config.maps);
  let map_names = [];
  if (existsSync(maps_folder)) {
    map_names = readdirSync(maps_folder).flatMap((name) => (name.endsWith(".map") ? [basename(name, ".map")] : []));
  }
  if (only !== undefined) {
    map_names = map_names.filter((name) => name === only || name === "shared");
  }
  const written = map_names.flatMap((name) =>
    parse_symbols(readFileSync(join(maps_folder, `${name}.map`), "utf8")).map((symbol) => ({ ...symbol, map: name })),
  );
  const owners = new Map();
  for (const symbol of written) {
    if (owners.has(symbol.id)) {
      throw new Error(
        `${symbol.id} is in both ${config.maps}/${owners.get(symbol.id)}.map and ${config.maps}/${symbol.map}.map. Keep one.`,
      );
    }
    owners.set(symbol.id, symbol.map);
  }

  const authored_source = (symbol, place) => {
    const [path, prefix] = place.split(" :: ");
    if (!existsSync(join(root, path))) {
      throw new Error(
        `${symbol.id}: ${path} is gone. Fix its src: line in ${config.maps}/${symbol.map}.map, or delete the block.`,
      );
    }
    const matches = source.lines_of(path).flatMap((line, index) => (line.trim().startsWith(prefix) ? [index] : []));
    if (matches.length !== 1) {
      throw new Error(
        `${symbol.id}: "${prefix}" matches ${matches.length} lines in ${path}. Fix its src: line in ${config.maps}/${symbol.map}.map, or delete the block if the code is gone.`,
      );
    }
    return source.statement_at(path, matches[0]).src;
  };
  const authored = written.map((symbol) => {
    if (symbol.kind === "flow") {
      return { ...symbol, module: "", src: NO_SOURCE };
    }
    if (symbol.src === undefined) {
      return { ...symbol, module: "", src: undefined };
    }
    let also_code = "";
    if (symbol.also !== undefined) {
      also_code = symbol.also
        .split(" ; ")
        .map((place) => authored_source(symbol, place).code)
        .join("\n");
    }
    return {
      ...symbol,
      module: module_of(symbol.src.split(" :: ")[0]),
      src: authored_source(symbol, symbol.src),
      also_code,
    };
  });

  const symbols = new Map(authored.map((symbol) => [symbol.id, symbol]));
  const authored_at = new Set(
    authored.flatMap((symbol) => (symbol.src === undefined || symbol.kind === "flow" ? [] : [`${symbol.src.path}:${symbol.src.start}`])),
  );
  const found = [];
  const required = [];
  const data_links = [];
  for (const rule of config.extract) {
    const extract = await extractor_of(rule, config_root);
    const result = await extract({ rule, ...source, short_doc });
    required.push(...(result.required ?? []));
    data_links.push(...(result.links ?? []));
    for (const symbol of result.symbols ?? []) {
      const whole = { pseudo: [], doc: "", module: module_of(symbol.src.path), ...symbol };
      const twin = found.find((other) => other.id === whole.id && other.src.start !== whole.src.start);
      if (twin !== undefined) {
        throw new Error(
          `Two things in the code are named ${whole.id}: ${twin.src.path}:${twin.src.start} and ${whole.src.path}:${whole.src.start}. Change the rule in the config so each gets its own name, or leave one out.`,
        );
      }
      found.push(whole);
      if (!symbols.has(whole.id) && !authored_at.has(`${whole.src.path}:${whole.src.start}`)) {
        symbols.set(whole.id, whole);
      }
    }
  }

  for (const symbol of found) {
    const written_one = symbols.get(symbol.id);
    if (written_one !== undefined && written_one !== symbol) {
      written_one.module = symbol.module;
      // A block may leave out its src: line when its id is one the code gives: it describes that code.
      written_one.src ??= symbol.src;
    }
  }
  for (const symbol of authored) {
    if (symbol.src === undefined) {
      throw new Error(
        `${symbol.id} in ${config.maps}/${symbol.map}.map has no src: line, and nothing read from the code has that id. Add a src: line, or fix the id.`,
      );
    }
  }

  const domains_path = join(root, config.domains);
  let domains = [];
  if (existsSync(domains_path)) {
    domains = parse_domains(readFileSync(domains_path, "utf8"));
  }
  const listed = new Map();
  const file_domains = new Map();
  for (const domain of domains) {
    for (const name of domain.models) {
      if (!found.some((symbol) => symbol.id === name)) {
        throw new Error(`${domain.id}: ${name} is listed under models, and is not in the code.`);
      }
      if (listed.has(name)) {
        throw new Error(`${name} is listed under models in both ${listed.get(name)} and ${domain.id}. Keep one.`);
      }
      listed.set(name, domain.id);
    }
    for (const path of source.files(domain.files)) {
      if (file_domains.has(path) && file_domains.get(path) !== domain.id) {
        throw new Error(`${path} is in both ${file_domains.get(path)} and ${domain.id} in ${config.domains}. Keep one.`);
      }
      file_domains.set(path, domain.id);
    }
  }
  for (const symbol of symbols.values()) {
    symbol.domain ??= listed.get(symbol.id) ?? file_domains.get(symbol.src.path) ?? "";
  }
  if (domains.length > 0 && strict) {
    const homeless = found.filter(
      (symbol) => !listed.has(symbol.id) && !file_domains.has(symbol.src.path),
    );
    const unplaced_models = homeless.filter((symbol) => symbol.kind === "model").map((symbol) => symbol.id);
    const unplaced_files = [...new Set(homeless.filter((symbol) => symbol.kind !== "model").map((symbol) => symbol.src.path))];
    if (unplaced_models.length > 0) {
      throw new Error(`Add these to a domain's models: line in ${config.domains}: ${unplaced_models.join(", ")}`);
    }
    if (unplaced_files.length > 0) {
      throw new Error(`Add these files to a domain's files: line in ${config.domains}: ${unplaced_files.join(", ")}`);
    }
  }
  for (const domain of domains) {
    domain.functions = {};
    for (const symbol of found) {
      const kept = symbols.get(symbol.id);
      if (symbol.kind === "def" && kept !== undefined && kept.domain === domain.id) {
        (domain.functions[kept.module] ??= []).push(symbol.id);
      }
    }
  }

  const ids = new Set(symbols.keys());
  const domain_ids = new Set(domains.map((domain) => domain.id));
  const bare_owners = new Map();
  for (const symbol of authored) {
    const bare = symbol.id.split(".").at(-1);
    bare_owners.set(bare, [...(bare_owners.get(bare) ?? []), symbol.id]);
  }
  for (const symbol of authored) {
    for (const line of symbol.pseudo) {
      const target = /^\s*#> (.*)$/.exec(line)?.[1].split(" | ")[0].split(" -> ")[1]?.trim();
      if (target === undefined) {
        continue;
      }
      const known = ids.has(target) || ids.has(`${symbol.module}.${target}`) || bare_owners.get(target)?.length === 1;
      if (!known) {
        throw new Error(
          `${symbol.id}: its step points at "${target}", which is not in the code or the map. Point the step at what replaced it, or drop the "-> ${target}" part.`,
        );
      }
    }
    if (symbol.kind === "flow" && !domain_ids.has(symbol.domain)) {
      throw new Error(`${symbol.id}: its domain: line names "${symbol.domain}", which is not in ${config.domains}.`);
    }
  }
  for (const domain of domains) {
    for (const relation of [...domain.relations, ...domain.more]) {
      if (!domain_ids.has(relation.to)) {
        throw new Error(`${domain.id}: relation to "${relation.to}", which is not a domain`);
      }
    }
  }

  const authored_ids = new Set(authored.map((symbol) => symbol.id));
  for (const symbol of symbols.values()) {
    symbol.authored = authored_ids.has(symbol.id);
    symbol.hash = code_hash(symbol.src.code + (symbol.also_code ?? ""));
    delete symbol.also_code;
  }
  return {
    project: { name: config.name },
    symbols: [...symbols.values()],
    domains: domains.filter((domain) => !domain.hidden),
    data_links,
    required,
  };
}

/** The same for code that differs only in spacing or comments, so a reformat is not a change. */
function code_hash(code) {
  const bare = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, "");
  return createHash("sha256").update(bare).digest("hex").slice(0, 16);
}
