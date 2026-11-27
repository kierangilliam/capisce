// Reads the page's own style sheets, so a file written by `capisce show` has the page's colours and type
// without a second copy of them. theme.css holds the tokens and the token colours, code.css the code panel,
// and pages.css the name of a flow.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STYLES = join(dirname(fileURLToPath(import.meta.url)), "..", "viewer", "src", "styles");
const DARK_ROOT = ':root[data-theme="dark"]';
const TOKEN_PREFIX = "--cp_";
const TOKEN_NAMES = [
  "background", "foreground", "muted", "border", "soft", "module", "added", "removed", "mono", "sans", "radius",
];

/** The rules of a style sheet that sit outside any `@media` or `@container` block, as `{ selector, declarations }`. */
function top_level_rules(css) {
  const rules = [];
  let depth = 0;
  let start = 0;
  let selector = "";
  for (let at = 0; at < css.length; at += 1) {
    if (css[at] === "{") {
      if (depth === 0) {
        selector = css.slice(start, at).trim().replace(/\s+/g, " ");
      }
      depth += 1;
      if (depth === 1) {
        start = at + 1;
      }
    } else if (css[at] === "}") {
      depth -= 1;
      if (depth === 0 && !selector.startsWith("@")) {
        rules.push({ selector, declarations: declarations_of(css.slice(start, at)) });
      }
      if (depth === 0) {
        start = at + 1;
      }
    }
  }
  return rules;
}

/** `a: b; c: d` as an object. A `;` inside brackets or quotes does not end a declaration. */
function declarations_of(body) {
  const declarations = {};
  for (const part of body.match(/(?:[^;("']|\([^)]*\)|"[^"]*"|'[^']*')+/g) ?? []) {
    const colon = part.indexOf(":");
    if (colon > 0) {
      declarations[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
    }
  }
  return declarations;
}

const rules = ["theme.css", "code.css", "pages.css"].flatMap((file) => top_level_rules(readFileSync(join(STYLES, file), "utf8")));

/** The declarations of the first rule written with exactly this selector, or an empty object. */
export const style_of = (selector) => rules.find((rule) => rule.selector === selector)?.declarations ?? {};

/** The text of `text` cut at the commas that are not inside brackets. */
function split_arguments(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] === "(") {
      depth += 1;
    } else if (text[at] === ")") {
      depth -= 1;
    } else if (text[at] === "," && depth === 0) {
      parts.push(text.slice(start, at).trim());
      start = at + 1;
    }
  }
  return [...parts, text.slice(start).trim()];
}

/** A value with every `var(--name, fallback)` replaced by what it stands for. A host's own variable is never set here. */
function without_variables(value, variables) {
  let text = value;
  for (let pass = 0; pass < 8 && text.includes("var("); pass += 1) {
    const open = text.lastIndexOf("var(");
    const close = text.indexOf(")", open);
    const [name, ...fallback] = split_arguments(text.slice(open + 4, close));
    text = text.slice(0, open) + (variables[name] ?? fallback.join(", ")) + text.slice(close + 1);
  }
  return text;
}

/**
 * The page's tokens for `theme` ("light" or "dark") with their plain values: colours as hex, fonts as a stack.
 * The keys have no prefix: `background`, `foreground`, `muted`, `border`, `soft`, `module`, `added`, `removed`,
 * `mono`, `sans`, `radius`.
 */
export function theme_tokens(theme = "light") {
  const variables = { ...style_of(":root") };
  if (theme === "dark") {
    Object.assign(variables, style_of(DARK_ROOT));
  }
  return Object.fromEntries(
    TOKEN_NAMES.map((name) => [name, without_variables(variables[`${TOKEN_PREFIX}${name}`] ?? "", variables)]),
  );
}

/** Whether the theme file has a dark variant. */
export const has_dark_theme = () => Object.keys(style_of(DARK_ROOT)).length > 0;

const hex_channels = (hex) => {
  let digits = hex.slice(1);
  if (digits.length === 3) {
    digits = [...digits].map((digit) => digit + digit).join("");
  }
  return [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16));
};

/**
 * A colour value of the style sheets as hex, for where CSS cannot work it out: an SVG read as an image.
 * It knows hex, the tokens, and `color-mix(in srgb, a N%, b)`. `transparent` counts as the background,
 * which is what shows through it. Anything else is the foreground.
 */
export function plain_colour(value, tokens) {
  const text = without_variables(value ?? "", Object.fromEntries(TOKEN_NAMES.map((name) => [`${TOKEN_PREFIX}${name}`, tokens[name]]))).trim();
  if (text === "transparent") {
    return tokens.background;
  }
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(text)) {
    return text;
  }
  const mix = /^color-mix\(in srgb,(.*)\)$/.exec(text);
  if (mix === null) {
    return tokens.foreground;
  }
  const [first, second] = split_arguments(mix[1]);
  const share = Number(/\s(\d+(?:\.\d+)?)%$/.exec(first)?.[1] ?? 50) / 100;
  const from = hex_channels(plain_colour(first.replace(/\s\d+(?:\.\d+)?%$/, ""), tokens));
  const to = hex_channels(plain_colour(second, tokens));
  const mixed = from.map((channel, at) => Math.round(channel * share + to[at] * (1 - share)));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** CSS that sets the tokens on `selector`, light first and dark where the reader's system asks for it. */
export function token_css(selector) {
  const block = (tokens) =>
    `${selector} { ${TOKEN_NAMES.map((name) => `${TOKEN_PREFIX}${name}: ${tokens[name]};`).join(" ")} }`;
  if (!has_dark_theme()) {
    return block(theme_tokens("light"));
  }
  return `${block(theme_tokens("light"))}\n@media (prefers-color-scheme: dark) { ${block(theme_tokens("dark"))} }`;
}

/** The rules of the style sheets whose selectors all match `pattern`, as CSS, each selector put under `scope`. */
export function scoped_rules(scope, pattern) {
  return rules
    .filter((rule) => rule.selector.split(",").every((selector) => pattern.test(selector.trim())))
    .map(({ selector, declarations }) => {
      const selectors = selector.split(",").map((one) => `${scope} ${one.trim()}`);
      const body = Object.entries(declarations).map(([name, value]) => `${name}: ${value};`);
      return `${selectors.join(", ")} { ${body.join(" ")} }`;
    })
    .join("\n");
}

/** `12px` as the number 12, or undefined for anything that is not a length in pixels. */
export function pixels_of(value) {
  const pixels = /^(-?\d+(?:\.\d+)?)px$/.exec(value ?? "")?.[1];
  if (pixels === undefined) {
    return undefined;
  }
  return Number(pixels);
}

const FONT = /^(?:(\d+)\s+)?(\d+(?:\.\d+)?)px(?:\/(\d+(?:\.\d+)?(?:px)?))?\s+var\(--cp_(mono|sans)\)$/;
const BODY_FONT = { family: "sans", size: 13, weight: undefined, ratio: 1.45, line: 13 * 1.45 };

/**
 * The font that the rule written with `selector` sets, on top of `base`: `family` ("mono" or "sans"), `size` and
 * `line` (the line height) in pixels, and `weight`. It reads the `font` shorthand as the page writes it, and
 * `font-size`, `font-weight` and `line-height`.
 */
export function font_of(selector, base = BODY_FONT) {
  const declarations = style_of(selector);
  const font = { ...base };
  let line = declarations["line-height"];
  const [, weight, size, short_line, family] = FONT.exec(declarations.font ?? "") ?? [];
  if (size !== undefined) {
    Object.assign(font, { family, size: Number(size), weight, ratio: BODY_FONT.ratio });
    line = short_line ?? line;
  }
  font.size = pixels_of(declarations["font-size"]) ?? font.size;
  font.weight = declarations["font-weight"] ?? font.weight;
  if (line !== undefined && pixels_of(line) === undefined) {
    font.ratio = Number(line);
  }
  font.line = pixels_of(line) ?? font.size * font.ratio;
  return font;
}
