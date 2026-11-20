import { mount } from "svelte";
import App from "./app.svelte";
import { load_catalog, project_name } from "./map/catalog";
import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/code.css";
import "./styles/trace.css";
import "./styles/pages.css";
import "./styles/overlays.css";
import "./styles/comments.css";
import type { MapData } from "./types";

async function map_data(): Promise<MapData | null> {
  if (window.CAPISCE_DATA !== null || !import.meta.env.DEV) {
    return window.CAPISCE_DATA;
  }
  try {
    const response = await fetch("/dev-data.json");
    return (await response.json()) as MapData;
  } catch {
    return null;
  }
}

/** A page that brings no theme of its own fills the window; inside a host page it keeps the host's size. */
function fill_window_when_alone(): void {
  const host_sets_theme = getComputedStyle(document.documentElement).getPropertyValue("--background").trim() !== "";
  if (host_sets_theme) {
    return;
  }
  document.documentElement.classList.add("own_page");
  const fit = () => document.documentElement.style.setProperty("--cp_height", `${window.innerHeight - 16}px`);
  window.addEventListener("resize", fit);
  fit();
}

async function start(): Promise<void> {
  const target = document.getElementById("capisce");
  if (target === null) {
    return;
  }
  const data = await map_data();
  if (data !== null) {
    load_catalog(data);
  }
  document.title = project_name() || "capisce";
  fill_window_when_alone();
  mount(App, { target, props: { has_data: data !== null } });
}

void start();
