// Drives a real capisce page inside a figure's frame: a pretend cursor moves to real elements, and real events
// make the page change, so what the reader sees is the page itself.

export type Point = { x: number; y: number };

export type StageView = {
  cursor: Point;
  cursor_shown: boolean;
  ripple: { at: Point; key: number } | undefined;
  key: { label: string; key: number } | undefined;
};

const PIXELS_PER_SECOND = 700;
const SHORTEST_MOVE_MS = 450;
const LONGEST_MOVE_MS = 1100;
const TYPING_MS = 55;
const FIND_TIMEOUT_MS = 4000;

export class Stopped extends Error {}

export class Stage {
  instant = false;
  stopped = false;
  private visible = true;
  private on_visible: (() => void)[] = [];

  constructor(
    readonly frame: HTMLIFrameElement,
    readonly view: StageView,
  ) {}

  get doc(): Document {
    const doc = this.frame.contentDocument;
    if (doc === null) {
      throw new Stopped();
    }
    return doc;
  }

  get win(): Window & typeof globalThis {
    return this.frame.contentWindow as Window & typeof globalThis;
  }

  set_visible(visible: boolean): void {
    this.visible = visible;
    if (visible) {
      this.on_visible.splice(0).forEach((resume) => resume());
    }
  }

  private async until_visible(): Promise<void> {
    if (this.stopped) {
      throw new Stopped();
    }
    if (!this.visible) {
      await new Promise<void>((resume) => this.on_visible.push(resume));
    }
  }

  async wait(ms: number): Promise<void> {
    await this.until_visible();
    if (this.instant) {
      return;
    }
    await new Promise((done) => setTimeout(done, ms));
    await this.until_visible();
  }

  private frames_until(done_at: number, step: (progress: number) => void, duration: number): Promise<void> {
    return new Promise((done) => {
      const tick = (now: number) => {
        const left = done_at - now;
        step(Math.min(1, 1 - left / duration));
        if (left <= 0 || this.stopped) {
          done();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  async find<Found extends Element = HTMLElement>(selector: string): Promise<Found> {
    const give_up_at = performance.now() + FIND_TIMEOUT_MS;
    while (performance.now() < give_up_at) {
      const found = this.doc.querySelector<Found & Element>(selector);
      if (found !== null) {
        return found;
      }
      await new Promise((done) => requestAnimationFrame(done));
    }
    throw new Error(`The figure's page has no "${selector}".`);
  }

  center_of(element: Element): Point {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }

  /** Scrolls the panel that holds `element` so it is in sight, without scrolling the page around the frame. */
  bring_into_panel(element: Element): void {
    const panel = element.closest<HTMLElement>("[data-panel]");
    if (panel === null) {
      return;
    }
    const box = element.getBoundingClientRect();
    const frame = panel.getBoundingClientRect();
    if (box.top < frame.top + 20 || box.bottom > frame.bottom - 20) {
      panel.scrollTop += box.top - frame.top - frame.height / 3;
    }
    if (box.left < frame.left || box.right > frame.right) {
      panel.scrollLeft += box.left - frame.left - 24;
    }
  }

  async move_to(target: Element | Point, offset: Point = { x: 0, y: 0 }): Promise<Point> {
    await this.until_visible();
    if (target instanceof this.win.Element) {
      this.bring_into_panel(target);
    }
    const center = target instanceof this.win.Element ? this.center_of(target) : (target as Point);
    const to = { x: center.x + offset.x, y: center.y + offset.y };
    const from = { ...this.view.cursor };
    if (this.instant) {
      this.view.cursor = to;
      return to;
    }
    this.view.cursor_shown = true;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = Math.max(SHORTEST_MOVE_MS, Math.min(LONGEST_MOVE_MS, (distance / PIXELS_PER_SECOND) * 1000));
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    await this.frames_until(
      performance.now() + duration,
      (progress) => {
        const eased = ease(progress);
        this.view.cursor = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
      },
      duration,
    );
    return to;
  }

  private mouse(type: string, at: Point, target: Element, extra: MouseEventInit = {}): void {
    const init = { bubbles: true, cancelable: true, composed: true, clientX: at.x, clientY: at.y, button: 0, view: this.win, ...extra };
    if (type.startsWith("pointer")) {
      target.dispatchEvent(new this.win.PointerEvent(type, { pointerId: 1, pointerType: "mouse", isPrimary: true, ...init }));
    } else {
      target.dispatchEvent(new this.win.MouseEvent(type, init));
    }
  }

  private show_ripple(at: Point): void {
    if (!this.instant) {
      this.view.ripple = { at, key: performance.now() };
    }
  }

  /** Moves to `element` and clicks it, with the events a real click sends. */
  async click(element: Element, offset: Point = { x: 0, y: 0 }): Promise<void> {
    await this.click_at(element, await this.move_to(element, offset));
  }

  /** Moves to `point` and clicks there, sending the events to `element`. */
  async click_at(element: Element, point: Point): Promise<void> {
    const at = await this.move_to(point);
    await this.wait(140);
    this.show_ripple(at);
    this.mouse("pointerdown", at, element, { buttons: 1 });
    this.mouse("mousedown", at, element, { buttons: 1 });
    await this.wait(90);
    this.mouse("pointerup", at, element);
    this.mouse("mouseup", at, element);
    this.mouse("click", at, element);
  }

  async press_key(key: string): Promise<void> {
    await this.until_visible();
    if (!this.instant) {
      this.view.key = { label: key, key: performance.now() };
    }
    const target = this.doc.body;
    target.dispatchEvent(new this.win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    target.dispatchEvent(new this.win.KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
    await this.wait(700);
    this.view.key = undefined;
  }

  async type(input: HTMLTextAreaElement, text: string): Promise<void> {
    for (let length = 1; length <= text.length; length += 1) {
      if (!this.instant || length === text.length) {
        input.value = text.slice(0, length);
        input.dispatchEvent(new this.win.Event("input", { bubbles: true }));
      }
      const typed = text[length - 1] ?? "";
      await this.wait(TYPING_MS + (" ,.?".includes(typed) ? 90 : Math.random() * 40));
    }
  }

  /** Drags across `word` inside `element` as a reader would to highlight it, then lets go. */
  async select_word(element: Element, word: string): Promise<void> {
    const walker = this.doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    let at = -1;
    while (node !== null) {
      at = new RegExp(`\\b${word}\\b`).exec(node.data)?.index ?? -1;
      if (at !== -1) {
        break;
      }
      node = walker.nextNode() as Text | null;
    }
    if (node === null || at === -1) {
      throw new Error(`The figure's page has no "${word}" to highlight.`);
    }
    const text = node;
    const range = this.doc.createRange();
    const edge = (offset: number): Point => {
      range.setStart(text, offset);
      range.setEnd(text, offset);
      const box = range.getBoundingClientRect();
      return { x: box.left, y: box.top + box.height / 2 };
    };
    const start = await this.move_to(edge(at));
    await this.wait(160);
    this.mouse("pointerdown", start, text.parentElement ?? element, { buttons: 1 });
    const selection = this.doc.getSelection();
    for (let length = 1; length <= word.length; length += 1) {
      this.view.cursor = edge(at + length);
      selection?.removeAllRanges();
      const selected = this.doc.createRange();
      selected.setStart(text, at);
      selected.setEnd(text, at + length);
      selection?.addRange(selected);
      await this.wait(70);
    }
    await this.wait(120);
    this.mouse("pointerup", this.view.cursor, text.parentElement ?? element);
  }

  /** Presses on `element`, drags through `points` (relative to where it pressed) and lets go. */
  async drag(element: Element, start: Point, points: Point[]): Promise<void> {
    const from = await this.move_to(start);
    await this.wait(150);
    this.mouse("pointerdown", from, element, { buttons: 1 });
    for (const point of points) {
      const at = { x: from.x + point.x, y: from.y + point.y };
      this.view.cursor = at;
      if (!this.instant) {
        await new Promise((done) => requestAnimationFrame(done));
        await new Promise((done) => setTimeout(done, 14));
        await this.until_visible();
      }
      this.mouse("pointermove", at, element, { buttons: 1 });
    }
    this.mouse("pointerup", this.view.cursor, element);
  }
}
