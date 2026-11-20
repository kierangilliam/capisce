const ESTIMATED_CHAR_WIDTH = 6.5;
let context: CanvasRenderingContext2D | null | undefined;

/** How wide `text` draws in the CSS `font`, in pixels. Falls back to an estimate where there is no canvas. */
export function text_width(text: string, font: string): number {
  if (context === undefined) {
    context = document.createElement("canvas").getContext("2d");
  }
  if (context === null) {
    return text.length * ESTIMATED_CHAR_WIDTH;
  }
  context.font = font;
  return context.measureText(text).width;
}

export function wrap_words(text: string, max_width: number, width_of: (text: string) => number): string[] {
  const lines = [""];
  for (const word of text.split(" ")) {
    const last = lines.at(-1) ?? "";
    if (last === "") {
      lines[lines.length - 1] = word;
    } else if (width_of(`${last} ${word}`) > max_width) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${last} ${word}`;
    }
  }
  return lines;
}
