import type { Point, Stage } from "./stage";

export type Scenario = {
  frame: string;
  height: number;
  /** static: set up and rest. once: play the first time it is mostly in view. loop: play over and over while in view. */
  mode: "static" | "once" | "loop";
  /** Where to look when a narrow screen shows only part of the frame and the cursor is not moving. */
  focus_x: number;
  rest?: Point;
  setup: (stage: Stage) => Promise<void>;
  play?: (stage: Stage) => Promise<void>;
};

const MAP = "/frames/oxide-lite.html";
const DIFF_MAP = "/frames/oxide-lite-diff.html";
const FLOW = "Creating an instance from the console";
const FUNCTION = "instances.create_instance";
const NOTE_ON_SELECTION = "Can we rename new to requested? Next to project_name it reads like a keyword.";
const NOTE_ON_PIN = "The console already checks the quota. Should the API say why it checks again?";

async function click_now(stage: Stage, selector: string): Promise<void> {
  const element = await stage.find(selector);
  element.dispatchEvent(new stage.win.MouseEvent("click", { bubbles: true, cancelable: true }));
}

const open_domain = (stage: Stage) => click_now(stage, '.domain_box[data-go="domain:Instances"]');

async function open_flow(stage: Stage): Promise<void> {
  await open_domain(stage);
  await click_now(stage, `.flow_card[data-go="${FLOW}"]`);
}

async function open_function(stage: Stage): Promise<void> {
  await open_domain(stage);
  await click_now(stage, `.browse_item[data-route="${FUNCTION}"]`);
  await stage.find(".code_panel .lines");
}

const trace_row = (index: number) => `.trace_row[data-trace="${index}"] .trace_hit`;
const ROW_STEPS = [2, 4, 5];

export const SCENARIOS: Record<string, Scenario> = {
  domains: {
    frame: MAP,
    height: 520,
    mode: "static",
    focus_x: 640,
    setup: async (stage) => {
      await stage.find(".canvas .domain_box");
    },
  },

  domain: {
    frame: MAP,
    height: 600,
    mode: "once",
    focus_x: 640,
    rest: { x: 980, y: 560 },
    setup: async (stage) => {
      await stage.find(".canvas .domain_box");
    },
    play: async (stage) => {
      await stage.wait(500);
      await stage.click(await stage.find('.domain_box[data-go="domain:Instances"]'));
      await stage.wait(300);
      await stage.move_to(await stage.find(`.flow_card[data-go="${FLOW}"]`), { x: 30, y: 12 });
    },
  },

  flow: {
    frame: MAP,
    height: 640,
    mode: "once",
    focus_x: 640,
    rest: { x: 700, y: 560 },
    setup: open_domain,
    play: async (stage) => {
      await stage.wait(500);
      await stage.click(await stage.find(`.flow_card[data-go="${FLOW}"]`), { x: -40, y: 0 });
      await stage.wait(500);
      await stage.move_to({ x: 330, y: 300 });
    },
  },

  steps: {
    frame: MAP,
    height: 640,
    mode: "loop",
    focus_x: 520,
    setup: async (stage) => {
      await open_flow(stage);
      await click_now(stage, trace_row(ROW_STEPS[0] ?? 0));
      stage.view.cursor = { x: 300, y: stage.center_of(await stage.find(trace_row(ROW_STEPS[0] ?? 0))).y };
      stage.view.cursor_shown = true;
    },
    play: async (stage) => {
      for (const row of [...ROW_STEPS.slice(1), ROW_STEPS[0] ?? 0]) {
        await stage.wait(2600);
        const hit = await stage.find(trace_row(row));
        await stage.click_at(hit, { x: 300, y: stage.center_of(hit).y });
      }
    },
  },

  real_code: {
    frame: MAP,
    height: 640,
    mode: "loop",
    focus_x: 900,
    setup: async (stage) => {
      await open_function(stage);
      stage.view.cursor = { x: 980, y: 300 };
      stage.view.cursor_shown = true;
    },
    play: async (stage) => {
      await stage.wait(1800);
      await stage.click(await stage.find("[data-real-toggle]"));
      await stage.wait(900);
      await stage.move_to({ x: 980, y: 300 });
      await stage.wait(3200);
      await stage.click(await stage.find("[data-real-toggle]"));
      await stage.wait(900);
      await stage.move_to({ x: 980, y: 300 });
    },
  },

  selection: {
    frame: MAP,
    height: 640,
    mode: "once",
    focus_x: 860,
    rest: { x: 1000, y: 420 },
    setup: open_function,
    play: async (stage) => {
      await stage.wait(500);
      await stage.select_word(await stage.find(".code_panel .lines .line"), "new");
      await stage.wait(500);
      await stage.click(await stage.find("[data-selection-comment]:not([hidden])"));
      await stage.wait(400);
      await stage.type(await stage.find<HTMLTextAreaElement>("[data-draft-input]"), NOTE_ON_SELECTION);
      await stage.wait(500);
      await stage.click(await stage.find("[data-draft-save]"));
      await stage.wait(300);
      await stage.move_to({ x: 760, y: 380 });
    },
  },

  comment_mode: {
    frame: MAP,
    height: 640,
    mode: "once",
    focus_x: 500,
    rest: { x: 560, y: 120 },
    setup: async (stage) => {
      await open_flow(stage);
      stage.view.cursor = { x: 620, y: 260 };
    },
    play: async (stage) => {
      await stage.wait(600);
      await stage.press_key("c");
      await stage.wait(300);
      const title = (await stage.find('.code_panel .stage_label[data-title="The API checks the request"] .stage_title')).getBoundingClientRect();
      await stage.click_at(await stage.find('[data-layer="code"]'), { x: title.right + 14, y: title.top + title.height / 2 });
      await stage.wait(400);
      await stage.type(await stage.find<HTMLTextAreaElement>("[data-draft-input]"), NOTE_ON_PIN);
      await stage.wait(500);
      const row = (await stage.find('.trace_row[data-trace="4"] .trace_note')).getBoundingClientRect();
      const center = { x: (row.left + row.right) / 2, y: row.top + row.height / 2 };
      const circle: Point[] = [];
      for (let turn = 0; turn <= 44; turn += 1) {
        const angle = -Math.PI / 2 + (turn / 40) * Math.PI * 2;
        circle.push({ x: Math.cos(angle) * (row.width / 2 + 34), y: Math.sin(angle) * 34 + 34 });
      }
      await stage.drag(await stage.find('[data-layer="flow"]'), { x: center.x, y: center.y - 34 }, circle);
      await stage.wait(400);
      await stage.click(await stage.find("[data-draft-save]"));
      await stage.wait(300);
      await stage.move_to({ x: 560, y: 120 });
    },
  },

  diff: {
    frame: DIFF_MAP,
    height: 640,
    mode: "once",
    focus_x: 520,
    rest: { x: 760, y: 200 },
    setup: async (stage) => {
      await stage.find(".change_name");
    },
    play: async (stage) => {
      await stage.wait(900);
      await stage.click(await stage.find('.chip[data-part="step:Refuse what the rack has no room for"]'));
      await stage.wait(500);
      await stage.move_to({ x: 1100, y: 200 });
    },
  },

  glossary: {
    frame: MAP,
    height: 560,
    mode: "once",
    focus_x: 860,
    setup: open_function,
    play: async (stage) => {
      await stage.wait(500);
      await stage.click(await stage.find('.code_panel .symbol[data-symbol="store_lock"]'));
    },
  },
};
