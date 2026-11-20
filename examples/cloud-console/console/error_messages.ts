import { ApiError } from "./api_client";

const MESSAGES: Record<string, string> = {
  Unreachable: "The console could not reach the service. Check your connection and try again.",
  InvalidCredentials: "That name or password is not right. Try again.",
  AccountLocked: "Too many wrong passwords. Wait 15 minutes, then try again.",
  Forbidden: "Your role on this project does not allow that. Ask a project admin for access.",
  ProjectNotFound: "That project does not exist, or you do not have access to it.",
  InstanceNotFound: "That instance no longer exists.",
  DiskNotFound: "That disk no longer exists.",
  UserNotFound: "Nobody has that name. Check the spelling and try again.",
  ProjectNameTaken: "A project already has that name. Choose another name.",
  InstanceNameTaken: "An instance in this project already has that name. Choose another name.",
  DiskNameTaken: "A disk in this project already has that name. Choose another name.",
  ProjectNotEmpty: "Delete the project's instances and disks first, then delete the project.",
  LastAdmin: "A project needs at least one admin. Make someone else an admin first.",
  QuotaExceeded: "This is more than the project has left. Choose a smaller size, or delete something first.",
  AddressPoolExhausted: "No addresses are free right now. Delete an instance you no longer need, or try later.",
  InstanceBusy: "The instance is still changing. Wait a few seconds and try again.",
  InstanceNotRunning: "The instance is not running, so there is nothing to stop.",
  InstanceNotStopped: "Stop the instance first, then try again.",
  DiskAttached: "The disk is attached to an instance. Delete or change that instance first.",
  TooManyDisks: "This instance already holds as many disks as it can.",
};

/** What to tell the person when the API refuses something, in plain words with a next step. */
export function message_for(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.error_code] ?? "Something went wrong. Try again.";
  }
  return "Something went wrong. Try again.";
}

export const signed_out = (error: unknown): boolean => error instanceof ApiError && error.status === 401;
