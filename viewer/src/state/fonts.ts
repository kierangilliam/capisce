import { text_width } from "../map/text_width";
import type { TraceFonts } from "../map/trace_layout";

const DEFAULT_SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const DEFAULT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const LABEL_FONT_SIZE = 12;
const MONO_FONT_SIZE = 10.5;
const SELECTED_WEIGHT = 600;

const host_font = (variable: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;

/** Measures the trace's two fonts. A label is measured bold, as it is when selected, so it never outgrows its box. */
export function trace_fonts(): TraceFonts {
  const sans = host_font("--font-sans", DEFAULT_SANS);
  const mono = host_font("--font-mono", DEFAULT_MONO);
  return {
    label: (text) => text_width(text, `${SELECTED_WEIGHT} ${LABEL_FONT_SIZE}px ${sans}`),
    mono: (text) => text_width(text, `${MONO_FONT_SIZE}px ${mono}`),
  };
}
