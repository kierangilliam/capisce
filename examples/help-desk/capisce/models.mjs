// Reads Go struct types as models: pseudo-code from the fields, and links for fields that point at another model.

const STRUCT = /^type (?<name>\w+) struct \{/;
const FIELD = /^(?<name>[A-Z]\w*)\s+(?<type>[^`/]+?)\s*(?:`[^`]*`)?\s*(?:\/\/.*)?$/;
const PSEUDO_TYPES = { string: "text", bool: "boolean", int: "integer", "time.Time": "time" };

/** A Go type in the words the pseudo-code uses: `[]Reply` is `list[Reply]`, `deadlines.Priority` is `Priority`. */
function pseudo_type(type) {
  if (type.startsWith("[]")) {
    return `list[${pseudo_type(type.slice(2))}]`;
  }
  if (type.startsWith("*")) {
    return `${pseudo_type(type.slice(1))} | None`;
  }
  return PSEUDO_TYPES[type] ?? type.split(".").at(-1);
}

/** The model a field such as `AssignedAgentID` points at: the longest model name it ends with before `ID`. */
function model_pointed_at(field, model_names) {
  if (!field.endsWith("ID")) {
    return undefined;
  }
  const stem = field.slice(0, -2);
  return model_names
    .filter((name) => stem.endsWith(name))
    .sort((a, b) => b.length - a.length)[0];
}

function fields_of(code) {
  const fields = [];
  let comment = [];
  for (const line of code.split("\n").slice(1, -1)) {
    const text = line.trim();
    const field = FIELD.exec(text)?.groups;
    if (text.startsWith("//")) {
      comment.push(text.replace(/^\/\/\s?/, ""));
    } else if (field !== undefined) {
      fields.push({ ...field, comment });
      comment = [];
    }
  }
  return fields;
}

export default function extract_models({ rule, files, lines_of, statement_at, short_doc }) {
  const structs = [];
  for (const path of files(rule.files)) {
    lines_of(path).forEach((line, index) => {
      const name = STRUCT.exec(line)?.groups.name;
      if (name !== undefined) {
        structs.push({ name, ...statement_at(path, index) });
      }
    });
  }
  const model_names = structs.map((struct) => struct.name);
  const symbols = [];
  const links = [];
  for (const { name, src, comment } of structs) {
    const pseudo = [`model ${name}:`];
    for (const field of fields_of(src.code.slice(src.code.indexOf(`type ${name} struct`)))) {
      for (const comment_line of field.comment) {
        pseudo.push(`    # ${comment_line}`);
      }
      const type = pseudo_type(field.type);
      const by_id = model_pointed_at(field.name, model_names);
      const by_type = model_names.find((model) => model !== name && type.replace(/^list\[|\]$| \| None$/g, "") === model);
      let points_at = "";
      if (by_id !== undefined) {
        points_at = `    # -> [[${by_id}]]`;
      }
      if (by_id !== undefined || by_type !== undefined) {
        links.push({ from: name, field: field.name, to: by_id ?? by_type });
      }
      pseudo.push(`    ${field.name}: ${type}${points_at}`);
    }
    symbols.push({ id: name, kind: "model", doc: short_doc(comment), pseudo, src });
  }
  return { symbols, links };
}
