import * as api_client from "./api_client";
import { LAST_PROJECT_KEY, SESSION_KEY, USER_KEY, console_state, page, show_message } from "./console_state";
import { message_for, signed_out } from "./error_messages";
import { switch_project } from "./project_actions";

/** The person submits the sign-in form. */
export async function sign_in(user_name: string, password: string): Promise<boolean> {
  if (user_name.trim() === "" || password === "") {
    show_message("Enter your name and password.");
    return false;
  }
  try {
    const result = await api_client.login(user_name.trim(), password);
    console_state.session_token = result.token;
    console_state.user_name = result.user_name;
    page.remember(SESSION_KEY, result.token);
    page.remember(USER_KEY, result.user_name);
  } catch (error) {
    show_message(message_for(error));
    return false;
  }
  show_message(null);
  await open_first_project();
  return true;
}

/** The console opens in a browser that signed in before. */
export async function restore_session(): Promise<void> {
  const token = page.recall(SESSION_KEY);
  if (token === null) {
    console_state.screen = "sign_in";
    return;
  }
  console_state.session_token = token;
  console_state.user_name = page.recall(USER_KEY);
  await open_first_project();
}

/** Loads the person's projects and opens the one they used last, or the first one. */
export async function open_first_project(): Promise<void> {
  try {
    console_state.projects = await api_client.project_list();
  } catch (error) {
    handle_refusal(error);
    return;
  }
  if (console_state.projects.length === 0) {
    console_state.current_project = null;
    console_state.screen = "no_projects";
    return;
  }
  const last_used = page.recall(LAST_PROJECT_KEY);
  const project = console_state.projects.find((each) => each.name === last_used) ?? console_state.projects[0];
  if (project !== undefined) {
    await switch_project(project.name);
  }
}

/** The person presses "Sign out". The console signs out even when the API cannot be told. */
export async function sign_out(): Promise<void> {
  try {
    await api_client.logout();
  } catch {
    // The session ends on its own after eight hours.
  }
  forget_session();
  show_message(null);
}

/** Shows why the API refused something. A refusal that means "signed out" returns the person to the sign-in form. */
export function handle_refusal(error: unknown): void {
  if (signed_out(error)) {
    forget_session();
    show_message("Your session ended. Sign in again.");
    return;
  }
  show_message(message_for(error));
}

function forget_session(): void {
  page.remember(SESSION_KEY, null);
  page.remember(USER_KEY, null);
  console_state.session_token = null;
  console_state.user_name = null;
  console_state.projects = [];
  console_state.current_project = null;
  console_state.instances = [];
  console_state.disks = [];
  console_state.screen = "sign_in";
}
