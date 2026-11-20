import * as api_client from "./api_client";
import type { Disk, Instance } from "./api_types";
import { console_state, show_message } from "./console_state";
import { name_problem, switch_project } from "./project_actions";
import { handle_refusal } from "./session_actions";

/** The person submits the new-disk form. */
export async function submit_create_disk(name: string, size_gib: number): Promise<boolean> {
  const current = console_state.current_project;
  if (current === null) {
    return false;
  }
  const problem = name_problem(name);
  if (problem !== null) {
    show_message(problem);
    return false;
  }
  if (!Number.isInteger(size_gib) || size_gib < 1 || size_gib > 1000) {
    show_message("Choose a size of 1 to 1000 GiB.");
    return false;
  }
  try {
    await api_client.disk_create(current.project.name, name, size_gib);
  } catch (error) {
    handle_refusal(error);
    return false;
  }
  show_message(`The disk ${name} was created.`);
  return switch_project(current.project.name);
}

/** The person picks a disk to attach to an instance. */
export async function attach_disk(instance: Instance, disk: Disk): Promise<boolean> {
  if (instance.state !== "stopped") {
    show_message("Stop the instance first, then attach the disk.");
    return false;
  }
  try {
    const attached = await api_client.instance_disk_attach(instance.id, disk.id);
    console_state.disks = console_state.disks.map((each) => {
      if (each.id === attached.id) {
        return attached;
      }
      return each;
    });
  } catch (error) {
    handle_refusal(error);
    return false;
  }
  show_message(`${disk.name} is attached to ${instance.name}.`);
  return true;
}

/** The person presses "Delete" on a disk and confirms. */
export async function delete_disk(disk: Disk): Promise<boolean> {
  const current = console_state.current_project;
  if (current === null) {
    return false;
  }
  if (disk.attached_instance_id !== null) {
    show_message("This disk is attached to an instance. A boot disk is deleted with its instance.");
    return false;
  }
  try {
    await api_client.disk_delete(disk.id);
  } catch (error) {
    handle_refusal(error);
    return false;
  }
  show_message(`The disk ${disk.name} was deleted.`);
  return switch_project(current.project.name);
}
