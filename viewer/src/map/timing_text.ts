const UNITS: Record<string, string> = { m: "minute", h: "hour", d: "day", w: "week" };

/** A duration as a reader says it: `<1 ms`, `42 ms`, `1.2 s`, `12 s`. */
export function duration_text(ms: number): string {
  if (ms < 1) {
    return "<1 ms";
  }
  if (Math.round(ms) < 1000) {
    return `${Math.round(ms)} ms`;
  }
  if (ms < 9950) {
    return `${(ms / 1000).toFixed(1)} s`;
  }
  return `${Math.round(ms / 1000).toLocaleString("en-US")} s`;
}

/** A window such as `7d` in words: `7 days`. Anything else is shown as it was given. */
export function window_text(window: string): string {
  const match = /^(\d+)([mhdw])$/.exec(window);
  if (match === null) {
    return window;
  }
  const unit = UNITS[match[2] ?? ""] ?? "";
  if (match[1] === "1") {
    return `1 ${unit}`;
  }
  return `${match[1]} ${unit}s`;
}

export function requests_text(count: number, window: string): string {
  let text = `${Math.round(count).toLocaleString("en-US")} requests`;
  if (Math.round(count) === 1) {
    text = "1 request";
  }
  if (window === "") {
    return text;
  }
  return `${text} in ${window_text(window)}`;
}

export function no_requests_text(window: string): string {
  if (window === "") {
    return "No requests were seen";
  }
  return `No requests in the last ${window_text(window)}`;
}
