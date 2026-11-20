import type { Changes, Domain, MapData, MapSymbol } from "../types";

export const CANVAS_PAGE = "Domains";
export const CHANGES_PAGE = "Changes";
const DOMAIN_PREFIX = "domain:";

export const KIND_LABELS: Record<MapSymbol["kind"], string> = {
  route: "Endpoint",
  def: "Function",
  model: "Model",
  term: "Term",
  flow: "Flow",
};

type Catalog = {
  data: MapData;
  symbols: Map<string, MapSymbol>;
  domains: Map<string, Domain>;
  bare_owners: Map<string, string[]>;
  modules_with_code: Set<string>;
  changes: Changes | undefined;
};

export const catalog: Catalog = {
  data: { project: { name: "" }, symbols: [], domains: [], data_links: [] },
  symbols: new Map(),
  domains: new Map(),
  bare_owners: new Map(),
  modules_with_code: new Set(),
  changes: undefined,
};

export const bare_name = (id: string): string => id.split(".").at(-1) ?? id;

export function load_catalog(data: MapData): void {
  catalog.data = data;
  catalog.changes = data.changes;
  catalog.symbols = new Map(data.symbols.map((symbol) => [symbol.id, symbol]));
  catalog.domains = new Map(data.domains.map((domain) => [domain.id, domain]));
  for (const symbol of data.symbols) {
    if (symbol.kind === "def" || symbol.kind === "route") {
      catalog.modules_with_code.add(symbol.module);
    }
    if (symbol.kind === "def" && symbol.pseudo.length > 0) {
      const bare = bare_name(symbol.id);
      catalog.bare_owners.set(bare, [...(catalog.bare_owners.get(bare) ?? []), symbol.id]);
    }
  }
}

export const symbol_of = (id: string | undefined): MapSymbol | undefined => {
  if (id === undefined) {
    return undefined;
  }
  return catalog.symbols.get(id);
};

/** The id that `name` means when written inside `from_module`, or undefined when it names nothing in the map. */
export function resolve(name: string, from_module: string, is_called: boolean): string | undefined {
  if (catalog.symbols.has(name)) {
    return name;
  }
  if (name.includes(".") || !is_called) {
    return undefined;
  }
  if (catalog.symbols.has(`${from_module}.${name}`)) {
    return `${from_module}.${name}`;
  }
  const owners = catalog.bare_owners.get(name) ?? [];
  if (owners.length === 1) {
    return owners[0];
  }
  return undefined;
}

export const domain_page = (name: string): string => `${DOMAIN_PREFIX}${name}`;

export const domain_of_page = (id: string): Domain | undefined => {
  if (!id.startsWith(DOMAIN_PREFIX)) {
    return undefined;
  }
  return catalog.domains.get(id.slice(DOMAIN_PREFIX.length));
};

export const is_page = (id: string): boolean =>
  id === CANVAS_PAGE || (id === CHANGES_PAGE && catalog.changes !== undefined) || domain_of_page(id) !== undefined;

export function crumb_label(id: string): string {
  if (id.startsWith(DOMAIN_PREFIX)) {
    return id.slice(DOMAIN_PREFIX.length);
  }
  if (catalog.symbols.get(id)?.kind === "def") {
    return bare_name(id);
  }
  return id;
}

export const frame_domain = (): Domain | undefined => catalog.data.domains.find((domain) => domain.frame);

export const project_name = (): string => catalog.data.project.name.trim();
