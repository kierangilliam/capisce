import { mount } from "svelte";
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
