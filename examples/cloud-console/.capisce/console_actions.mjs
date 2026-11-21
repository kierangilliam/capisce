// Reads the exported functions of the console's action files, and makes each one something the check
// requires pseudo-code for: an action is where a person's click enters the code, as an endpoint is for a request.
const ACTION = /^export (?:async )?function (?<name>\w+)/;

export default function extract_console_actions({ rule, files, lines_of, statement_at, short_doc }) {
  const symbols = [];
  const required = [];
  for (const path of files(rule.files)) {
    const module_name = path.split("/").at(-1).replace(/\.ts$/, "");
    lines_of(path).forEach((line, index) => {
      const name = ACTION.exec(line)?.groups.name;
      if (name === undefined) {
        return;
      }
      const { src, comment } = statement_at(path, index);
      symbols.push({ id: `${module_name}.${name}`, kind: "def", doc: short_doc(comment), src });
      required.push({ path, line: index + 1, start: src.start, end: src.end });
    });
  }
  return { symbols, required };
}
