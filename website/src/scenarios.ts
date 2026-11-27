import type { Point, Stage } from "./stage";

export type Scenario = {
  frame: string;
  height: number;
  /** static: set up and rest. once: play the first time it is mostly in view. loop: play over and over while in view. */
  mode: "static" | "once" | "loop";
  rest?: Point;
  /** What differs on a narrow screen, where the frame is as wide as a phone and the page stacks its panels. */
  narrow?: { width?: number; height?: number; rest?: Point };
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
const WIDE_ROW_X = 300;
const NARROW_ROW_ROOM = { above: 110, beside: 48 };
const REAL_CODE_REST = { x: 300, y: 470 };
/** Wide enough for two columns of the canvas, and no wider: the frame's edge falls between boxes. */
const NARROW_CANVAS_WIDTH = 508;

/** Where the cursor clicks a row of the trace. In the narrow frame the row's words are scrolled into sight first. */
async function row_click_point(stage: Stage, index: number): Promise<{ hit: HTMLElement; at: Point }> {
  const hit = await stage.find(trace_row(index));
  // The row's label sits in a box above its arrow and any exits, so the cursor aims at the box, not the row's middle.
  const box = await stage.find(`.trace_row[data-trace="${index}"] .trace_note`);
  if (!stage.narrow) {
    return { hit, at: { x: WIDE_ROW_X, y: stage.center_of(box).y } };
  }
  const words = await stage.find(`.trace_row[data-trace="${index}"] .trace_label`);
  const panel = await stage.find('[data-panel="flow"]');
  const frame = panel.getBoundingClientRect();
  const words_box = words.getBoundingClientRect();
  let behavior: ScrollBehavior = "smooth";
  if (stage.instant) {
    behavior = "instant";
  }
  panel.scrollTo({
    top: Math.max(0, panel.scrollTop + words_box.top - frame.top - NARROW_ROW_ROOM.above),
    left: Math.max(0, panel.scrollLeft + words_box.left - frame.left - NARROW_ROW_ROOM.beside),
    behavior,
  });
  await stage.wait(500);
  return { hit, at: { x: words.getBoundingClientRect().left + 24, y: stage.center_of(box).y } };
}

/** In the narrow frame the code is below the trace, so the step just picked is scrolled into sight. */
async function show_picked_code(stage: Stage): Promise<void> {
  if (stage.narrow) {
    const code = await stage.find('[data-panel="code"]');
    code.scrollTop = 0;
    const picked = code.querySelector(".stage.selected");
    if (picked !== null) {
      stage.bring_into_panel(picked);
    }
  }
}

export const SCENARIOS: Record<string, Scenario> = {
  domains: {
    frame: MAP,
    height: 520,
    mode: "static",
    narrow: { width: NARROW_CANVAS_WIDTH, height: 540 },
    setup: async (stage) => {
      await stage.find(".canvas .domain_box");
    },
  },

  domain: {
    frame: MAP,
    height: 600,
    mode: "once",
    rest: { x: 980, y: 560 },
    narrow: { width: NARROW_CANVAS_WIDTH, height: 580, rest: { x: 440, y: 520 } },
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
    rest: { x: 700, y: 560 },
    narrow: { height: 660, rest: { x: 350, y: 560 } },
    setup: open_domain,
    play: async (stage) => {
      await stage.wait(500);
      await stage.click(await stage.find(`.flow_card[data-go="${FLOW}"]`), { x: -40, y: 0 });
      await stage.wait(500);
      await stage.move_to(stage.place({ x: 330, y: 300 }, { x: 330, y: 230 }));
    },
  },

  steps: {
    frame: MAP,
    height: 640,
    mode: "loop",
    narrow: { height: 680 },
    setup: async (stage) => {
      await open_flow(stage);
      await click_now(stage, trace_row(ROW_STEPS[0] ?? 0));
      await show_picked_code(stage);
      stage.view.cursor = (await row_click_point(stage, ROW_STEPS[0] ?? 0)).at;
      stage.view.cursor_shown = true;
    },
    play: async (stage) => {
      for (const row of [...ROW_STEPS.slice(1), ROW_STEPS[0] ?? 0]) {
        await stage.wait(2600);
        const { hit, at } = await row_click_point(stage, row);
        await stage.click_at(hit, at);
        await show_picked_code(stage);
      }
    },
  },

  real_code: {
    frame: MAP,
    height: 640,
    mode: "loop",
    setup: async (stage) => {
      await open_function(stage);
      stage.view.cursor = stage.place({ x: 980, y: 300 }, REAL_CODE_REST);
      stage.view.cursor_shown = true;
    },
    play: async (stage) => {
      await stage.wait(1800);
      await stage.click(await stage.find("[data-real-toggle]"));
      await stage.wait(900);
      await stage.move_to(stage.place({ x: 980, y: 300 }, REAL_CODE_REST));
      await stage.wait(3200);
      await stage.click(await stage.find("[data-real-toggle]"));
      await stage.wait(900);
      await stage.move_to(stage.place({ x: 980, y: 300 }, REAL_CODE_REST));
    },
  },

  selection: {
    frame: MAP,
    height: 640,
    mode: "once",
    rest: { x: 1000, y: 420 },
    narrow: { height: 660, rest: { x: 340, y: 560 } },
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
      await stage.move_to(stage.place({ x: 760, y: 380 }, { x: 340, y: 600 }));
    },
  },

  comment_mode: {
    frame: MAP,
    height: 640,
    mode: "once",
    rest: { x: 560, y: 120 },
    narrow: { height: 700, rest: { x: 340, y: 150 } },
    setup: async (stage) => {
      await open_flow(stage);
      stage.view.cursor = stage.place({ x: 620, y: 260 }, { x: 340, y: 150 });
    },
    play: async (stage) => {
      await stage.wait(600);
      await stage.press_key("c");
      await stage.wait(300);
      const title_element = await stage.find('.code_panel .stage_label[data-title="The API checks the request"] .stage_title');
      if (stage.narrow) {
        stage.bring_into_panel(title_element);
      }
      // The pin goes just past the end of the title's first line: the title can wrap, and its box runs to the next column.
      const words = stage.doc.createRange();
      words.selectNodeContents(title_element);
      const title = words.getClientRects()[0] ?? title_element.getBoundingClientRect();
      await stage.click_at(await stage.find('[data-layer="code"]'), { x: title.right + 14, y: title.top + title.height / 2 });
      await stage.wait(400);
      await stage.type(await stage.find<HTMLTextAreaElement>("[data-draft-input]"), NOTE_ON_PIN);
      await stage.wait(500);
      const note = await stage.find('.trace_row[data-trace="4"] .trace_note');
      if (stage.narrow) {
        stage.bring_into_panel(note);
        const flow = await stage.find('[data-panel="flow"]');
        const flow_box = flow.getBoundingClientRect();
        const note_box = note.getBoundingClientRect();
        flow.scrollLeft += note_box.left + note_box.width / 2 - (flow_box.left + flow_box.width / 2);
      }
      const row = note.getBoundingClientRect();
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
      await stage.move_to(stage.place({ x: 560, y: 120 }, { x: 340, y: 150 }));
    },
  },

  diff: {
    frame: DIFF_MAP,
    height: 640,
    mode: "once",
    rest: { x: 760, y: 200 },
    narrow: { height: 660, rest: { x: 350, y: 150 } },
    setup: async (stage) => {
      await stage.find(".change_name");
    },
    play: async (stage) => {
      await stage.wait(900);
      await stage.click(await stage.find('.chip[data-part="step:Refuse what the rack has no room for"]'));
      await stage.wait(500);
      await stage.move_to(stage.place({ x: 1100, y: 200 }, { x: 380, y: 300 }));
    },
  },

  glossary: {
    frame: MAP,
    height: 560,
    mode: "once",
    setup: open_function,
    play: async (stage) => {
      await stage.wait(500);
      await stage.click(await stage.find('.code_panel .symbol[data-symbol="store_lock"]'));
    },
  },
};
