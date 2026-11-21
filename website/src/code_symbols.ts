// The names in the first code block describe themselves the way they do on the capisce page: hover, focus or tap
// one for its definition, and open it in the demo from there. Without this script each name is still a plain link.

type CodeSymbol = { kind: string; name: string; doc: string; where: string; href?: string };

const SHOW_AFTER_MS = 120;
const HIDE_AFTER_MS = 180;
const EDGE_GAP = 8;
const ANCHOR_GAP = 6;

function read_symbols(): Record<string, CodeSymbol> {
  try {
    return JSON.parse(document.querySelector("#code_symbols")?.textContent ?? "{}") as Record<string, CodeSymbol>;
  } catch {
    return {};
  }
}

function part(tag: string, class_name: string, text: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = class_name;
  element.textContent = text;
  return element;
}

export function start_code_symbols(): void {
  const symbols = read_symbols();
  const tooltip = document.createElement("div");
  tooltip.className = "code_tooltip";
  tooltip.id = "code_tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);

  let shown_for: HTMLElement | undefined;
  let pinned = false;
  let timer: number | undefined;

  function place(anchor: HTMLElement): void {
    const box = anchor.getBoundingClientRect();
    const page_width = document.documentElement.clientWidth;
    const left = Math.max(EDGE_GAP, Math.min(box.left, page_width - tooltip.offsetWidth - EDGE_GAP));
    let top = box.bottom + ANCHOR_GAP;
    const fits_above = box.top > tooltip.offsetHeight + ANCHOR_GAP + EDGE_GAP;
    if (top + tooltip.offsetHeight > window.innerHeight - EDGE_GAP && fits_above) {
      top = box.top - tooltip.offsetHeight - ANCHOR_GAP;
    }
    tooltip.style.left = `${left + window.scrollX}px`;
    tooltip.style.top = `${top + window.scrollY}px`;
  }

  function show(anchor: HTMLElement): void {
    const symbol = symbols[anchor.dataset.symbol ?? ""];
    if (symbol === undefined) {
      return;
    }
    const parts = [part("div", "tooltip_kind", symbol.kind), part("div", "tooltip_name", symbol.name)];
    if (symbol.doc !== "") {
      parts.push(part("div", "tooltip_doc", symbol.doc));
    }
    if (symbol.where !== "") {
      parts.push(part("div", "tooltip_path", symbol.where));
    }
    if (symbol.href !== undefined) {
      const open = part("a", "tooltip_open", "Open in the demo") as HTMLAnchorElement;
      open.href = symbol.href;
      open.target = "_blank";
      open.rel = "noopener";
      open.append(part("span", "tooltip_key", "⌘ click"));
      parts.push(open);
    }
    tooltip.replaceChildren(...parts);
    tooltip.hidden = false;
    shown_for?.removeAttribute("aria-describedby");
    shown_for = anchor;
    anchor.setAttribute("aria-describedby", tooltip.id);
    place(anchor);
  }

  function hide(): void {
    window.clearTimeout(timer);
    tooltip.hidden = true;
    shown_for?.removeAttribute("aria-describedby");
    shown_for = undefined;
    pinned = false;
  }

  const later = (act: () => void, after: number) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(act, after);
  };
  const hide_unless_pinned = () => {
    if (!pinned) {
      hide();
    }
  };

  for (const anchor of document.querySelectorAll<HTMLElement>(".side_by_side [data-symbol]")) {
    anchor.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse" && !pinned) {
        later(() => show(anchor), SHOW_AFTER_MS);
      }
    });
    anchor.addEventListener("pointerleave", () => later(hide_unless_pinned, HIDE_AFTER_MS));
    anchor.addEventListener("focus", () => {
      if (!pinned && anchor.matches(":focus-visible")) {
        show(anchor);
      }
    });
    anchor.addEventListener("blur", () => later(hide_unless_pinned, HIDE_AFTER_MS));
    anchor.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      event.preventDefault();
      window.clearTimeout(timer);
      if (pinned && shown_for === anchor) {
        hide();
        return;
      }
      show(anchor);
      pinned = true;
    });
    anchor.addEventListener("keydown", (event) => {
      const is_link = anchor.tagName === "A";
      if (!is_link && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        anchor.click();
      }
      const open = tooltip.querySelector<HTMLElement>(".tooltip_open");
      if (event.key === "Tab" && !event.shiftKey && shown_for === anchor && open !== null) {
        event.preventDefault();
        pinned = true;
        open.focus();
      }
    });
  }
  /** The tooltip is at the end of the page, so Tab from its link goes back to the name it describes. */
  tooltip.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && shown_for !== undefined) {
      event.preventDefault();
      const anchor = shown_for;
      hide();
      anchor.focus();
    }
  });
  tooltip.addEventListener("pointerenter", () => window.clearTimeout(timer));
  tooltip.addEventListener("pointerleave", () => later(hide_unless_pinned, HIDE_AFTER_MS));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shown_for !== undefined) {
      hide();
    }
  });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(".code_tooltip, .side_by_side [data-symbol]") === null) {
      hide();
    }
  });
  document.querySelectorAll(".side_by_side pre").forEach((scroller) => scroller.addEventListener("scroll", hide, { passive: true }));
  window.addEventListener("resize", hide);
}
