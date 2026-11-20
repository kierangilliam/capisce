import type { LineOp, MapSymbol, StepOp } from "../types";
import { is_step_header, step_title, steps_of } from "./steps";

export type ChangeMark = "added" | "removed" | "changed" | "";
export type StageLine = { text: string; mark: ChangeMark };
export type StageBlock = {
  step: number | undefined;
  title: string;
  has_label: boolean;
  mark: ChangeMark;
  lines: StageLine[];
};

const STEP_MARKS: Record<StepOp, ChangeMark> = { "+": "added", "~": "changed", "-": "removed", " ": "" };
const LINE_MARKS: Record<LineOp, ChangeMark> = { "+": "added", "-": "removed", " ": "" };

/** The pseudo-code lines to show, in order, with the lines the branch removed put back where they were. */
function marked_lines(symbol: MapSymbol, with_diff: boolean): StageLine[] {
  const diff = symbol.diff;
  if (with_diff && diff?.status === "removed") {
    return symbol.pseudo.map((text) => ({ text, mark: "removed" }));
  }
  if (!with_diff || diff?.pseudo === undefined) {
    return symbol.pseudo.map((text) => ({ text, mark: "" }));
  }
  return diff.pseudo.map(([op, text]) => ({ text, mark: LINE_MARKS[op] }));
}

function changed_step_marks(symbol: MapSymbol, with_diff: boolean): Map<string, ChangeMark> {
  const marks = new Map<string, ChangeMark>();
  if (!with_diff) {
    return marks;
  }
  for (const [op, title] of symbol.diff?.steps ?? []) {
    if (op === "+" || op === "~") {
      marks.set(title, STEP_MARKS[op]);
    }
  }
  return marks;
}

/**
 * The pseudo-code grouped into stages: each `#>` line becomes the label of the lines under it.
 * Lines before the first stage form a block without a label. A removed stage keeps its label and is not a step.
 */
export function stage_blocks(symbol: MapSymbol, with_diff: boolean): StageBlock[] {
  const steps = steps_of(symbol);
  const step_marks = changed_step_marks(symbol, with_diff);
  const blocks: StageBlock[] = [];
  let block: StageBlock = { step: undefined, title: "", has_label: false, mark: "", lines: [] };
  let live_step = -1;
  const start = (next: StageBlock) => {
    if (block.has_label || block.lines.length > 0) {
      blocks.push(block);
    }
    block = next;
  };
  const continue_live_step = () => {
    let step: number | undefined;
    if (live_step >= 0) {
      step = live_step;
    }
    start({ step, title: steps[live_step]?.title ?? "", has_label: false, mark: "", lines: [] });
  };

  for (const line of marked_lines(symbol, with_diff)) {
    const is_header = is_step_header(line.text);
    const was_removed = line.mark === "removed" && symbol.diff?.status !== "removed";
    if (is_header && was_removed) {
      start({ step: undefined, title: step_title(line.text), has_label: true, mark: "removed", lines: [] });
    } else if (is_header) {
      live_step += 1;
      const title = steps[live_step]?.title ?? step_title(line.text);
      start({ step: live_step, title, has_label: true, mark: step_marks.get(title) ?? line.mark, lines: [] });
    } else {
      if (!was_removed && block.mark === "removed" && block.has_label && symbol.diff?.status !== "removed") {
        continue_live_step();
      }
      block.lines.push(line);
    }
  }
  start(block);
  return blocks;
}

/** The index of the last block of `step`, where the function it calls opens. */
export const last_block_of = (blocks: StageBlock[], step: number | undefined): number => {
  if (step === undefined) {
    return -1;
  }
  return blocks.findLastIndex((block) => block.step === step);
};
