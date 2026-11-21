// The .capisce folder holds two kinds of files. The map (maps, domains, stamps, the project's own extractors) is
// written by people and agents and is committed. The rest is local to one checkout: the built page, the timings,
// and one reader's comments and notes. capisce writes a .gitignore into the folder so only the map is committed.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const LOCAL_FILES = ["*.html", "timings.json", "comments.json", "comments/", "notes.json", "*.tmp"];

const IGNORE_FILE = `# Written by capisce. The map in this folder is committed. These files are local to one checkout.
# To share comments and notes through git, delete the lines comments.json, comments/ and notes.json.
${LOCAL_FILES.join("\n")}
`;

/** Makes the folder that holds local files, and tells git to leave them out. A .gitignore already there is kept. */
export function prepare_state(state) {
  mkdirSync(state, { recursive: true });
  const ignore_path = join(state, ".gitignore");
  if (!existsSync(ignore_path)) {
    writeFileSync(ignore_path, IGNORE_FILE);
  }
}
