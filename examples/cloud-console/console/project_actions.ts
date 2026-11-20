import * as api_client from "./api_client";
import type { ProjectRole } from "./api_types";
import { LAST_PROJECT_KEY, console_state, page, show_message } from "./console_state";
import { handle_refusal, open_first_project } from "./session_actions";

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const MAX_NAME_LENGTH = 40;

/** The rule the API applies to names, checked in the form first so the person hears sooner. */
export function name_problem(name: string): string | null {
  if (name === "") {
    return "Enter a name.";
  }
  if (!NAME_PATTERN.test(name) || name.endsWith("-") || name.length > MAX_NAME_LENGTH) {
    return "Use lowercase letters, numbers and dashes, starting with a letter. 40 characters at most.";
  }
  return null;
}

/** The person picks a project in the project menu. */
export async function switch_project(project_name: string): Promise<boolean> {
  try {
    const [detail, instances, disks] = await Promise.all([
      api_client.project_view(project_name),
      api_client.instance_list(project_name),
      api_client.disk_list(project_name),
    ]);
    console_state.current_project = detail;
    console_state.instances = instances;
    console_state.disks = disks;
  } catch (error) {
    handle_refusal(error);
    return false;
  }
  console_state.screen = "project";
  page.remember(LAST_PROJECT_KEY, project_name);
  return true;
}

/** The person submits the new-project form. */
export async function submit_create_project(name: string, description: string): Promise<boolean> {
  const problem = name_problem(name);
  if (problem !== null) {
    show_message(problem);
    return false;
  }
  try {
    const project = await api_client.project_create(name, description.trim());
    console_state.projects = [...console_state.projects, project].sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    handle_refusal(error);
    return false;
  }
  show_message(null);
  return switch_project(name);
}

/** The person presses "Delete project" and confirms. */
export async function delete_project(project_name: string): Promise<boolean> {
  const current = console_state.current_project;
  if (current !== null && current.project.name === project_name) {
    if (current.role !== "admin") {
      show_message("Only a project admin can delete a project.");
      return false;
    }
    if (current.usage.instances > 0 || current.usage.disks > 0) {
      show_message(
        `This project still holds ${current.usage.instances} instances and ${current.usage.disks} disks. Delete them first.`,
      );
      return false;
    }
  }
  const confirmed = await page.confirm(`Delete the project "${project_name}"? This cannot be undone.`);
  if (!confirmed) {
    return false;
  }
  try {
    await api_client.project_delete(project_name);
  } catch (error) {
    handle_refusal(error);
    return false;
  }
  page.remember(LAST_PROJECT_KEY, null);
  show_message(`The project "${project_name}" was deleted.`);
  await open_first_project();
  return true;
}

/** A project admin gives someone a role from the access page. */
export async function give_role(user_name: string, role: ProjectRole): Promise<boolean> {
  const current = console_state.current_project;
  if (current === null) {
    return false;
  }
  if (user_name.trim() === "") {
    show_message("Enter the person's name.");
    return false;
  }
  try {
    await api_client.project_member_set(current.project.name, user_name.trim(), role);
  } catch (error) {
    handle_refusal(error);
    return false;
  }
  show_message(`${user_name.trim()} is now ${role} on ${current.project.name}.`);
  return true;
}
