import * as api_client from "./api_client";
import type { Instance, InstanceCreateParams, InstanceState } from "./api_types";
import { console_state, page, replace_instance, show_message } from "./console_state";
import { name_problem, switch_project } from "./project_actions";
import { handle_refusal } from "./session_actions";

const POLL_MILLISECONDS = 1000;
const MAX_POLLS = 30;

/** What is wrong with the create-instance form, or null. It also checks the project's remaining quota. */
export function instance_form_problem(form: InstanceCreateParams): string | null {
  const current = console_state.current_project;
  if (current === null) {
    return "Choose a project first.";
  }
  const problem = name_problem(form.name);
  if (problem !== null) {
    return problem;
  }
  if (!Number.isInteger(form.ncpus) || form.ncpus < 1 || form.ncpus > 8) {
    return "Choose 1 to 8 CPUs.";
  }
  if (!Number.isInteger(form.memory_gib) || form.memory_gib < 1 || form.memory_gib > 32) {
    return "Choose 1 to 32 GiB of memory.";
  }
  if (!Number.isInteger(form.boot_disk_size_gib) || form.boot_disk_size_gib < 10 || form.boot_disk_size_gib > 200) {
    return "Choose a boot disk of 10 to 200 GiB.";
  }
  const { project, usage } = current;
  if (form.ncpus > project.quota_cpus - usage.cpus) {
    return `This project has ${project.quota_cpus - usage.cpus} CPUs left. Choose fewer, or delete an instance.`;
  }
  if (form.memory_gib > project.quota_memory_gib - usage.memory_gib) {
    return `This project has ${project.quota_memory_gib - usage.memory_gib} GiB of memory left. Choose less.`;
  }
  if (form.boot_disk_size_gib > project.quota_disk_gib - usage.disk_gib) {
    return `This project has ${project.quota_disk_gib - usage.disk_gib} GiB of disk left. Choose a smaller disk.`;
  }
  return null;
}

/** The person submits the create-instance form. */
export async function submit_create_instance(form: InstanceCreateParams): Promise<Instance | null> {
  const problem = instance_form_problem(form);
  const current = console_state.current_project;
  if (problem !== null || current === null) {
    show_message(problem);
    return null;
  }
  let instance: Instance;
  try {
    instance = await api_client.instance_create(current.project.name, form);
  } catch (error) {
    handle_refusal(error);
    return null;
  }
  replace_instance(instance);
  show_message(`Creating ${instance.name}…`);
  const settled = await wait_for_instance(instance.id, ["running", "failed"]);
  await switch_project(current.project.name);
  return report_outcome(settled, "running", `${instance.name} is running at ${instance.address_ip}.`);
}

/** Asks the API for the instance once a second until it reaches one of `states`, for up to 30 seconds. */
export async function wait_for_instance(instance_id: string, states: InstanceState[]): Promise<Instance | null> {
  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    await page.sleep(POLL_MILLISECONDS);
    let instance: Instance;
    try {
      instance = await api_client.instance_view(instance_id);
    } catch (error) {
      handle_refusal(error);
      return null;
    }
    replace_instance(instance);
    if (states.includes(instance.state)) {
      return instance;
    }
  }
  show_message("This is taking longer than usual. Reload the page to see where it stands.");
  return null;
}

/** Tells the person how a change ended: as hoped, failed with the API's reason, or unknown. */
function report_outcome(settled: Instance | null, hoped: InstanceState, success: string): Instance | null {
  if (settled === null) {
    return null;
  }
  if (settled.state === hoped) {
    show_message(success);
  } else {
    const reason = settled.failure_reason ?? "It could not be started.";
    show_message(`${settled.name} failed. ${reason} Try again later, or choose a smaller size.`);
  }
  return settled;
}

/** The person presses "Stop" on an instance and confirms. */
export async function stop_instance(instance: Instance): Promise<Instance | null> {
  if (instance.state !== "running") {
    show_message("Only a running instance can be stopped.");
    return null;
  }
  const confirmed = await page.confirm(`Stop ${instance.name}? Anything running on it will be interrupted.`);
  if (!confirmed) {
    return null;
  }
  try {
    replace_instance(await api_client.instance_stop(instance.id));
  } catch (error) {
    handle_refusal(error);
    return null;
  }
  show_message(`Stopping ${instance.name}…`);
  const settled = await wait_for_instance(instance.id, ["stopped"]);
  return report_outcome(settled, "stopped", `${instance.name} is stopped.`);
}

/** The person presses "Start" on a stopped or failed instance. */
export async function start_instance(instance: Instance): Promise<Instance | null> {
  if (instance.state !== "stopped" && instance.state !== "failed") {
    show_message("Only a stopped instance can be started.");
    return null;
  }
  try {
    replace_instance(await api_client.instance_start(instance.id));
  } catch (error) {
    handle_refusal(error);
    return null;
  }
  show_message(`Starting ${instance.name}…`);
  const settled = await wait_for_instance(instance.id, ["running", "failed"]);
  return report_outcome(settled, "running", `${instance.name} is running.`);
}

/** The person presses "Delete" on an instance and confirms. */
export async function delete_instance(instance: Instance): Promise<boolean> {
  if (instance.state !== "stopped" && instance.state !== "failed") {
    show_message("Stop the instance first, then delete it.");
    return false;
  }
  const confirmed = await page.confirm(
    `Delete ${instance.name}? Its boot disk is deleted with it. Other disks are kept.`,
  );
  if (!confirmed) {
    return false;
  }
  try {
    await api_client.instance_delete(instance.id);
  } catch (error) {
    handle_refusal(error);
    return false;
  }
  show_message(`${instance.name} was deleted.`);
  const current = console_state.current_project;
  if (current !== null) {
    await switch_project(current.project.name);
  }
  return true;
}
