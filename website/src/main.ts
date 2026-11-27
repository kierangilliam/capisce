import { mount } from "svelte";
import { start_code_symbols } from "./code_symbols";
import { start_quickstart } from "./quickstart";
import Figure from "./figure.svelte";
import { SCENARIOS } from "./scenarios";
import "./site.css";

for (const figure of document.querySelectorAll<HTMLElement>("[data-figure]")) {
  const scenario = SCENARIOS[figure.dataset.figure ?? ""];
  if (scenario === undefined) {
    continue;
  }
  figure.querySelector(".figure_alt")?.classList.add("hidden");
  mount(Figure, { target: figure, props: { scenario } });
}

start_code_symbols();
start_quickstart();

const first_capisce = document.querySelector("#first_capisce");
const repo_link = document.querySelector(".repo_link");
if (first_capisce !== null && repo_link !== null) {
  /** The corner link stands in for the first "Capisce" once that has scrolled off the top. */
  new IntersectionObserver(([entry]) => {
    const scrolled_past = entry !== undefined && !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
    repo_link.classList.toggle("shown", scrolled_past);
  }).observe(first_capisce);
}
