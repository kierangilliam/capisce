/** The things the quickstart's variable cycles through until the reader picks their own. */
const EXAMPLES = ["codebase", "permissions microservice", "billing service", "monorepo", "Rails app", "data pipeline"];
const CYCLE_MS = 4000;
const FADE_MS = 400;

export function start_quickstart(): void {
  const prompt = document.querySelector<HTMLElement>(".quickstart_prompt");
  const variable = document.querySelector<HTMLElement>(".quickstart_variable");
  const copy_label = document.querySelector<HTMLElement>(".quickstart_copy");
  if (prompt === null || variable === null || copy_label === null) {
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

  let reset: number | undefined;
  const copy = async () => {
    const text = (prompt.querySelector("code")?.textContent ?? "").replace(/\s+/g, " ").trim();
    try {
      await navigator.clipboard.writeText(text);
      copy_label.textContent = "Copied";
    } catch {
      copy_label.textContent = "Couldn’t copy";
    }
    prompt.classList.add("copied");
    window.clearTimeout(reset);
    reset = window.setTimeout(() => {
      copy_label.textContent = "Copy";
      prompt.classList.remove("copied");
    }, 1600);
  };
  prompt.addEventListener("click", () => void copy());
  prompt.addEventListener("keydown", (event) => {
    if (event.target === prompt && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      void copy();
    }
  });
}
