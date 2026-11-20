import type { Domain, MapSymbol } from "../types";
import { catalog } from "./catalog";

export type BrowseGroup = { title: string; symbols: MapSymbol[] };
export type BrowseModule = { name: string; symbols: MapSymbol[] };

const has_mapped = (symbols: MapSymbol[]): number => Number(symbols.some((symbol) => symbol.pseudo.length > 0));

/** A domain's flows, then its endpoint groups (mapped ones first), then its models. */
export function browse_groups(domain: Domain): BrowseGroup[] {
  const flows: MapSymbol[] = [];
  const models: MapSymbol[] = [];
  const endpoint_groups = new Map<string, MapSymbol[]>();
  for (const symbol of catalog.data.symbols) {
    if (symbol.domain !== domain.id) {
      continue;
    }
    if (symbol.kind === "flow") {
      flows.push(symbol);
    } else if (symbol.kind === "model") {
      models.push(symbol);
    } else if (symbol.kind === "route" && symbol.group !== undefined) {
      endpoint_groups.set(symbol.group, [...(endpoint_groups.get(symbol.group) ?? []), symbol]);
    }
  }
  const endpoints = [...endpoint_groups]
    .map(([title, symbols]) => ({ title, symbols }))
    .toSorted((a, b) => has_mapped(b.symbols) - has_mapped(a.symbols));
  return [{ title: "Flows", symbols: flows }, ...endpoints, { title: "Models", symbols: models }].filter(
    (group) => group.symbols.length > 0,
  );
}

export const browse_modules = (domain: Domain): BrowseModule[] =>
  Object.entries(domain.functions).map(([name, ids]) => ({
    name,
    symbols: ids.map((id) => catalog.symbols.get(id)).filter((symbol) => symbol !== undefined),
  }));
