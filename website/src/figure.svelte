<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Scenario } from "./scenarios";
  import { Stage, Stopped, type StageView } from "./stage";

  let { scenario }: { scenario: Scenario } = $props();

  const WIDE_FRAME_WIDTH = 1200;
  /** Three lanes of a trace fit across this, with the frame's edge in the gap after the third. */
  const NARROW_FRAME_WIDTH = 408;
  const NARROW_BELOW = 720;
  const LOAD_AHEAD = "900px 0px";
  const MOSTLY_IN_VIEW = 0.6;
  /** On a narrow screen the frame is as wide as a phone, so the page inside lays itself out as it does on one. */
  const narrow = window.matchMedia(`(max-width: ${NARROW_BELOW - 1}px)`).matches;
  const reduced_motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let host: HTMLDivElement | undefined = $state();
  let width = $state(0);
  let frame_url: string | undefined = $state();
  let frame: HTMLIFrameElement | undefined = $state();
  let ready = $state(false);
  const view: StageView = $state({ cursor: { x: 0, y: 0 }, cursor_shown: false, ripple: undefined, key: undefined });
  let stage: Stage | undefined;

  const frame_size = $derived.by(() => {
    if (narrow) {
      return { width: scenario.narrow?.width ?? NARROW_FRAME_WIDTH, height: scenario.narrow?.height ?? scenario.height };
    }
    return { width: WIDE_FRAME_WIDTH, height: scenario.height };
  });
  const rest = $derived.by(() => {
    if (narrow) {
      return scenario.narrow?.rest;
    }
    return scenario.rest;
  });
  const scale = $derived(width / frame_size.width);

  const observers: IntersectionObserver[] = [];
  onDestroy(() => {
    observers.forEach((observer) => observer.disconnect());
    if (stage !== undefined) {
      stage.stopped = true;
    }
  });

  function observe(threshold: number | number[], seen: (entry: IntersectionObserverEntry) => void, rootMargin = "0px"): IntersectionObserver {
    const observer = new IntersectionObserver((entries) => entries.forEach(seen), { threshold, rootMargin });
    if (host !== undefined) {
      observer.observe(host);
    }
    observers.push(observer);
    return observer;
  }

  $effect(() => {
    if (host === undefined) {
      return;
    }
    const loader = observe(0, async (entry) => {
      if (entry.isIntersecting) {
        loader.disconnect();
        frame_url = await shared_frame_url(scenario.frame);
      }
    }, LOAD_AHEAD);
  });

  async function until_page_drawn(target: HTMLIFrameElement): Promise<void> {
    while ((target.contentDocument?.querySelector(".capisce .bar") ?? null) === null) {
      await new Promise((done) => requestAnimationFrame(done));
    }
  }

  async function started() {
    if (frame === undefined) {
      return;
    }
    stage = new Stage(frame, view, narrow);
    const running = stage;
    try {
      await until_page_drawn(frame);
      running.instant = true;
      await scenario.setup(running);
      if (reduced_motion || scenario.mode === "static") {
        if (scenario.mode === "once") {
          await scenario.play?.(running);
        }
        view.cursor_shown = false;
        ready = true;
        return;
      }
      if (scenario.mode === "once" && rest !== undefined) {
        view.cursor = { ...rest };
        view.cursor_shown = true;
      }
      ready = true;
      if (scenario.mode === "once") {
        const trigger = observe(MOSTLY_IN_VIEW, async (entry) => {
          if (entry.intersectionRatio >= MOSTLY_IN_VIEW) {
            trigger.disconnect();
            running.instant = false;
            await scenario.play?.(running);
          }
        });
        return;
      }
      running.set_visible(false);
      observe([0, 0.3], (entry) => running.set_visible(entry.intersectionRatio >= 0.3));
      running.instant = false;
      while (!running.stopped) {
        await scenario.play?.(running);
      }
    } catch (error) {
      if (!(error instanceof Stopped)) {
        console.warn(error);
      }
      ready = true;
    }
  }
</script>

<script lang="ts" module>
  const frame_urls = new Map<string, Promise<string>>();

  /** One copy of each page for every figure that shows it: fetched once and kept in memory. */
  function shared_frame_url(path: string): Promise<string> {
    let url = frame_urls.get(path);
    if (url === undefined) {
      url = fetch(path)
        .then((response) => response.text())
        .then((page) => URL.createObjectURL(new Blob([page], { type: "text/html" })));
      frame_urls.set(path, url);
    }
    return url;
  }
</script>

<div class="stage" class:ready class:narrow bind:this={host} bind:clientWidth={width} style:height="{frame_size.height * scale}px">
  <div class="stage_inner" style:width="{frame_size.width}px" style:height="{frame_size.height}px" style:transform="scale({scale})">
    {#if frame_url !== undefined}
      <iframe bind:this={frame} src={frame_url} title="" tabindex="-1" aria-hidden="true" onload={started}></iframe>
    {/if}
    {#if view.cursor_shown}
      <svg class="cursor" style:transform="translate({view.cursor.x}px, {view.cursor.y}px)" width="20" height="24" viewBox="0 0 20 24" aria-hidden="true">
        <path d="M2 2 L2 19 L6.6 14.8 L9.6 21.6 L12.6 20.3 L9.7 13.6 L16 13.6 Z" />
      </svg>
    {/if}
    {#if view.ripple !== undefined}
      {#key view.ripple.key}
        <span class="ripple" style:left="{view.ripple.at.x}px" style:top="{view.ripple.at.y}px"></span>
      {/key}
    {/if}
    {#if view.key !== undefined}
      {#key view.key.key}
        <kbd class="pressed">{view.key.label}</kbd>
      {/key}
    {/if}
  </div>
</div>

<style>
  .stage {
    position: relative;
    overflow: hidden;
    border: 1px solid #d4d4d4;
    border-radius: 4px;
    background: #ffffff;
  }
  .stage_inner {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .stage.ready .stage_inner { opacity: 1; }
  .stage.narrow { max-width: 480px; margin: 0 auto; }
  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    pointer-events: none;
  }
  .cursor {
    position: absolute;
    top: 0;
    left: 0;
    margin: -2px 0 0 -2px;
    pointer-events: none;
    filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.25));
  }
  .cursor path { fill: #111111; stroke: #ffffff; stroke-width: 1.4; stroke-linejoin: round; }
  .ripple {
    position: absolute;
    width: 34px;
    height: 34px;
    margin: -17px 0 0 -17px;
    border: 2px solid rgb(17 17 17 / 0.5);
    border-radius: 50%;
    pointer-events: none;
    animation: ripple 0.55s ease-out forwards;
  }
  @keyframes ripple {
    from { transform: scale(0.3); opacity: 1; }
    to { transform: scale(1.2); opacity: 0; }
  }
  .pressed {
    position: absolute;
    left: 50%;
    bottom: 28px;
    margin-left: -24px;
    min-width: 48px;
    padding: 4px 12px;
    border: 1px solid #b9b9b4;
    border-bottom-width: 4px;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
    font: 26px/1.3 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    text-align: center;
    pointer-events: none;
    animation: pressed 0.7s ease forwards;
  }
  @keyframes pressed {
    0% { transform: translateY(6px); opacity: 0; }
    20% { transform: translateY(0); opacity: 1; }
    35% { transform: translateY(2px); border-bottom-width: 2px; }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
