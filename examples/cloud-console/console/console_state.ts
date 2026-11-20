import type { Disk, Instance, ProjectDetail, Project } from "./api_types";

/** Everything the console is showing. Actions change it, and the screen draws from it. */
export type ConsoleState = {
  session_token: string | null;
  user_name: string | null;
  projects: Project[];
  current_project: ProjectDetail | null;
  instances: Instance[];
  disks: Disk[];
  screen: "sign_in" | "no_projects" | "project";
  message: string | null;
};

export const console_state: ConsoleState = {
  session_token: null,
  user_name: null,
  projects: [],
  current_project: null,
  instances: [],
  disks: [],
  screen: "sign_in",
  message: null,
};

/** What the console asks of the page around it. Tests and other hosts can replace these. */
export const page = {
  confirm: async (question: string): Promise<boolean> => globalThis.confirm(question),
  sleep: (milliseconds: number): Promise<void> => new Promise((done) => setTimeout(done, milliseconds)),
  remember: (key: string, value: string | null): void => {
    if (value === null) {
      globalThis.localStorage.removeItem(key);
    } else {
      globalThis.localStorage.setItem(key, value);
    }
  },
  recall: (key: string): string | null => globalThis.localStorage.getItem(key),
};

export const SESSION_KEY = "console.session_token";
export const USER_KEY = "console.user_name";
export const LAST_PROJECT_KEY = "console.last_project";

export function show_message(message: string | null): void {
  console_state.message = message;
}

export function replace_instance(instance: Instance): void {
  const others = console_state.instances.filter((each) => each.id !== instance.id);
  console_state.instances = [...others, instance].sort((a, b) => a.name.localeCompare(b.name));
}
