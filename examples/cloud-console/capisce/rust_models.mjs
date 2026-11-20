// Reads the `pub struct` and `pub enum` definitions of a Rust file as models.
const PSEUDO_TYPES = { String: "text", bool: "boolean", u8: "integer", u32: "integer", u64: "integer", usize: "integer" };
const COMMENT_WIDTH = 56;

/** A Rust type, such as `Option<String>` or `Vec<Disk>`, in the words the model pseudo-code uses. */
function pseudo_type(type) {
  const optional = /^Option<(.+)>$/.exec(type);
  if (optional !== null) {
    return `${pseudo_type(optional[1])} | None`;
  }
  const list = /^Vec<(.+)>$/.exec(type);
  if (list !== null) {
    return `list[${pseudo_type(list[1])}]`;
  }
  return PSEUDO_TYPES[type] ?? type;
}

const snake_case = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

/** The model a field points at: by its type, or by a name such as `boot_disk_id` for Disk. */
function target_of(field, type, model_names) {
  const by_type = model_names.find((name) => new RegExp(`\\b${name}\\b`).test(type));
  if (by_type !== undefined) {
    return by_type;
  }
  return model_names.find((name) => new RegExp(`(^|_)${snake_case(name)}_id$`).test(field));
}

function comment_lines(words) {
  const lines = [];
  let line = "";
  for (const word of words.join(" ").split(" ")) {
    if (line !== "" && line.length + word.length + 1 > COMMENT_WIDTH) {
      lines.push(line);
      line = "";
    }
    line = `${line} ${word}`.trim();
  }
  if (line !== "") {
    lines.push(line);
  }
  return lines.map((each) => `    # ${each}`);
}

/** A model's fields (or an enum's choices) with their comments, as pseudo-code lines and links. */
function read_body(name, shape, body, model_names) {
  const pseudo = [`model ${name}:`];
  const links = [];
  if (shape === "enum") {
    pseudo.push("    # one of:");
  }
  let comment = [];
  for (const line of body) {
    const text = line.trim();
    const doc = /^\/\/\/ ?(.*)$/.exec(text)?.[1];
    const field = /^pub (\w+): (.+),$/.exec(text);
    const choice = /^([A-Z]\w*),$/.exec(text)?.[1];
    if (doc !== undefined) {
      comment.push(doc);
      continue;
    }
    if (field !== null && shape === "struct") {
      const to = target_of(field[1], field[2], model_names);
      let points_at = "";
      if (to !== undefined && to !== name) {
        links.push({ from: name, field: field[1], to });
        if (!field[2].includes(to)) {
          points_at = `    # -> [[${to}]]`;
        }
      }
      pseudo.push(...comment_lines(comment), `    ${field[1]}: ${pseudo_type(field[2])}${points_at}`);
    }
    if (choice !== undefined && shape === "enum") {
      pseudo.push(...comment_lines(comment), `    ${snake_case(choice)}`);
    }
    comment = [];
  }
  return { pseudo, links };
}

export default function extract_rust_models({ rule, files, lines_of, short_doc }) {
  const found = [];
  for (const path of files(rule.files)) {
    const lines = lines_of(path);
    lines.forEach((line, index) => {
      const definition = /^pub (struct|enum) (\w+) \{$/.exec(line);
      if (definition === null) {
        return;
      }
      // The doc comment sits above the derive attributes, so walk up over both.
      let start = index;
      while (start > 0 && /^(\/\/\/|#\[)/.test(lines[start - 1])) {
        start -= 1;
      }
      const end = lines.findIndex((each, at) => at > index && each === "}");
      const doc = lines
        .slice(start, index)
        .flatMap((each) => (each.startsWith("///") ? [each.replace(/^\/\/\/ ?/, "")] : []))
        .join(" ");
      found.push({
        name: definition[2],
        shape: definition[1],
        doc: short_doc(doc),
        body: lines.slice(index + 1, end),
        src: { path, start: start + 1, end: end + 1, code: lines.slice(start, end + 1).join("\n") },
      });
    });
  }
  const model_names = found.map((model) => model.name);
  const symbols = [];
  const links = [];
  for (const model of found) {
    const body = read_body(model.name, model.shape, model.body, model_names);
    links.push(...body.links);
    symbols.push({ id: model.name, kind: "model", doc: model.doc, src: model.src, pseudo: body.pseudo });
  }
  return { symbols, links };
}
