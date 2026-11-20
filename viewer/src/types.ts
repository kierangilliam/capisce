export type SymbolKind = "route" | "def" | "model" | "flow" | "term";
export type DiffStatus = "added" | "removed" | "changed";
export type LineOp = " " | "+" | "-";
export type StepOp = LineOp | "~";

export type SourceSpan = { path: string; start: number; end: number; code: string };

export type SymbolDiff = {
  status: DiffStatus;
  parts: string[];
  doc_before?: string;
  pseudo?: [LineOp, string][];
  steps?: [StepOp, string][];
  code?: [LineOp, string][];
};

export type MapSymbol = {
  id: string;
  kind: SymbolKind;
  doc: string;
  module: string;
  domain: string;
  group?: string;
  authored: boolean;
  pseudo: string[];
  src: SourceSpan;
  diff?: SymbolDiff;
};

export type Relation = { to: string; label: string };

export type DomainDiff = {
  status: DiffStatus;
  parts: string[];
  doc_before?: string;
  relations?: [LineOp, string][];
};

export type Domain = {
  id: string;
  tag: string;
  doc: string;
  frame: boolean;
  at: [number, number] | [];
  models: string[];
  relations: Relation[];
  more: Relation[];
  functions: Record<string, string[]>;
  diff?: DomainDiff;
};

export type DataLink = { from: string; field: string; to: string };

export type Changes = { base: string; head: string; ids: string[]; needs_review: boolean };

export type MapData = {
  project: { name: string };
  symbols: MapSymbol[];
  domains: Domain[];
  data_links: DataLink[];
  changes?: Changes;
};

export type Step = { title: string; target: string | undefined; exits: string[]; line: number };

export type PanelName = "flow" | "code" | "browse" | "bar";
export type Point = [number, number];
export type Stroke = { panel: PanelName; points: Point[] };
export type CommentPlace = { symbol: string; step: string; step_index: number | null };
export type CommentDraft = CommentPlace & {
  pin: { panel: PanelName; x: number; y: number };
  target: string;
  strokes: Stroke[];
  text: string;
  images: string[];
};
export type CommentReply = { id: string; author: "reader" | "agent"; text: string; images: string[]; created_at: string };
export type SavedComment = CommentDraft & {
  id: string;
  covers: string[];
  status: "open" | "done";
  replies: CommentReply[];
  unread: boolean;
  created_at: string;
};
export type SavedNote = { id: string; text: string; status: "open" | "done"; created_at: string };

declare global {
  interface Window {
    CAPISCE_DATA: MapData | null;
  }
}
