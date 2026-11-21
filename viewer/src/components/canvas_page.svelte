<script lang="ts">
  import { BOX, canvas_layout } from "../map/canvas_layout";
  import { catalog, domain_page, frame_domain, project_name } from "../map/catalog";
  import { changed_count_in } from "../map/changes";
  import { go } from "../state/navigation.svelte";

  const layout = canvas_layout(catalog.data.domains);
  const frame = frame_domain();
  const subject = project_name() || "this codebase";
</script>

<div class="page canvas_page">
  <div>
    <div class="panel_label">{project_name()}</div>
    <div class="page_name">Domains</div>
    <p class="page_doc">What {subject} is made of, and how the parts relate. Click a domain to see its flows, models, endpoints and functions.</p>
  </div>
  <div class="canvas" style:width="{layout.width}px" style:height="{layout.height}px">
    {#if frame !== undefined}
      <div
        class="canvas_frame"
        style:left="{layout.frame.left}px"
        style:top="{layout.frame.top}px"
        style:width="{layout.frame.width}px"
        style:height="{layout.frame.height}px"
      ></div>
      <button
        class="frame_label"
        data-go={domain_page(frame.id)}
        style:left="{layout.frame.left + 16}px"
        style:top="{layout.frame.top - 10}px"
        onclick={() => go(domain_page(frame.id))}
      >
        <span class="frame_name">{frame.id}</span><span class="frame_tag">{frame.tag}</span>
      </button>
    {/if}
    <svg>
      {#each layout.edges as edge}
        <path class="edge_line" d="M{edge.from.x} {edge.from.y} L{edge.to.x} {edge.to.y}" />
        <polygon class="edge_head" points={edge.head} />
        <text class="edge_label" x={edge.middle.x} y={edge.middle.y}>{edge.label}</text>
      {/each}
    </svg>
    {#each layout.boxes as box (box.domain.id)}
      {@const changed_count = changed_count_in(box.domain)}
      <button
        class="domain_box"
        class:with_count={changed_count > 0}
        data-go={domain_page(box.domain.id)}
        style:left="{box.x}px"
        style:top="{box.y}px"
        style:width="{BOX.width}px"
        style:height="{BOX.height}px"
        onclick={() => go(domain_page(box.domain.id))}
      >
        {#if changed_count > 0}<span class="domain_count">{changed_count}</span>{/if}
        <span class="domain_name">{box.domain.id}</span>
        <span class="domain_tag">{box.domain.tag}</span>
      </button>
    {/each}
  </div>
</div>
