/** The things the quickstart's variable cycles through until the reader picks their own. */
const EXAMPLES = ["codebase", "permissions microservice", "billing service", "monorepo", "Rails app", "data pipeline"];
const CYCLE_MS = 4000;
const FADE_MS = 400;

export function start_quickstart(): void {
  const prompt = document.querySelector<HTMLElement>(".quickstart_prompt");
  const variable = document.querySelector<HTMLElement>(".quickstart_variable");
  if (prompt === null || variable === null) {
    return;
  }

  const reduced_motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;
  let chosen = false;
  let timer: number | undefined;

  const cycle = () => {
    if (chosen || document.activeElement === variable) {
      return;
    }
    variable.classList.add("fading");
    window.setTimeout(() => {
      if (chosen || document.activeElement === variable) {
        variable.classList.remove("fading");
        return;
      }
      index = (index + 1) % EXAMPLES.length;
      variable.textContent = EXAMPLES[index] ?? "codebase";
      variable.classList.remove("fading");
    }, FADE_MS);
  };
  if (!reduced_motion) {
    timer = window.setInterval(cycle, CYCLE_MS);
  }

  const stop_cycling = () => {
    chosen = true;
    window.clearInterval(timer);
    variable.classList.remove("fading");
  };

  variable.addEventListener("focus", () => {
    variable.classList.remove("fading");
    /** Select the whole word so typing replaces it. */
    const range = document.createRange();
    range.selectNodeContents(variable);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  variable.addEventListener("input", stop_cycling);
  variable.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      variable.blur();
    }
  });
  variable.addEventListener("blur", () => {
    const text = (variable.textContent ?? "").replace(/\s+/g, " ").trim();
    variable.textContent = text === "" ? "codebase" : text;
  });
  /** Clicking the variable edits it rather than copying. */
  variable.addEventListener("click", (event) => event.stopPropagation());
}

/** Every copy block (the quickstart prompt, the install command) copies its code, whitespace collapsed, on a click
 * or on Enter or Space, and says so in its corner label for a moment. */
export function start_copy_blocks(): void {
  for (const block of document.querySelectorAll<HTMLElement>(".copy_block")) {
    const label = block.querySelector<HTMLElement>(".copy_label");
    if (label === null) {
      continue;
    }
    let reset: number | undefined;
    const copy = async () => {
      const text = (block.querySelector("code")?.textContent ?? "").replace(/\s+/g, " ").trim();
      try {
        await navigator.clipboard.writeText(text);
        label.textContent = "Copied";
      } catch {
        label.textContent = "Couldn’t copy";
      }
      block.classList.add("copied");
      window.clearTimeout(reset);
      reset = window.setTimeout(() => {
        label.textContent = "Copy";
        block.classList.remove("copied");
      }, 1600);
    };
    block.addEventListener("click", () => void copy());
    block.addEventListener("keydown", (event) => {
      if (event.target === block && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        void copy();
      }
    });
  }
}
