import type {
  Disk,
  Instance,
  InstanceCreateParams,
  LoginResult,
  Project,
  ProjectDetail,
  ProjectRole,
} from "./api_types";
import { console_state } from "./console_state";

const API_ORIGIN = "http://127.0.0.1:12220";

/** A refusal from the API. `error_code` is the API's own name for what went wrong, such as "QuotaExceeded". */
export class ApiError extends Error {
  status: number;
  error_code: string;

  constructor(status: number, error_code: string, message: string) {
    super(message);
    this.status = status;
    this.error_code = error_code;
  }
}

/** Sends one request with the session token, and turns any refusal into an ApiError. */
export async function api_request<Result>(method: string, path: string, body?: unknown): Promise<Result> {
  const headers: Record<string, string> = {};
  if (console_state.session_token !== null) {
    headers["Authorization"] = `Bearer ${console_state.session_token}`;
  }
  let payload: string | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Unreachable", "The API could not be reached.");
  }
  if (response.status === 204) {
    return undefined as Result;
  }
  const answer: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const refusal = (answer ?? {}) as { error_code?: string; message?: string };
    throw new ApiError(response.status, refusal.error_code ?? "Unknown", refusal.message ?? "");
  }
  return answer as Result;
}

const in_project = (project_name: string): string => `project=${encodeURIComponent(project_name)}`;

export function login(user_name: string, password: string): Promise<LoginResult> {
  return api_request("POST", "/v1/login", { user_name, password });
}

export function logout(): Promise<void> {
  return api_request("POST", "/v1/logout");
}

export function project_list(): Promise<Project[]> {
  return api_request("GET", "/v1/projects");
}

export function project_create(name: string, description: string): Promise<Project> {
  return api_request("POST", "/v1/projects", { name, description });
}

export function project_view(project_name: string): Promise<ProjectDetail> {
  return api_request("GET", `/v1/projects/${encodeURIComponent(project_name)}`);
}

export function project_delete(project_name: string): Promise<void> {
  return api_request("DELETE", `/v1/projects/${encodeURIComponent(project_name)}`);
}

export function project_member_set(project_name: string, user_name: string, role: ProjectRole): Promise<void> {
  return api_request("PUT", `/v1/projects/${encodeURIComponent(project_name)}/members`, { user_name, role });
}

export function instance_list(project_name: string): Promise<Instance[]> {
  return api_request("GET", `/v1/instances?${in_project(project_name)}`);
}

export function instance_create(project_name: string, params: InstanceCreateParams): Promise<Instance> {
  return api_request("POST", `/v1/instances?${in_project(project_name)}`, params);
}

export function instance_view(instance_id: string): Promise<Instance> {
  return api_request("GET", `/v1/instances/${instance_id}`);
}

export function instance_start(instance_id: string): Promise<Instance> {
  return api_request("POST", `/v1/instances/${instance_id}/start`);
}

export function instance_stop(instance_id: string): Promise<Instance> {
  return api_request("POST", `/v1/instances/${instance_id}/stop`);
}

export function instance_delete(instance_id: string): Promise<void> {
  return api_request("DELETE", `/v1/instances/${instance_id}`);
}

export function instance_disk_attach(instance_id: string, disk_id: string): Promise<Disk> {
  return api_request("POST", `/v1/instances/${instance_id}/disks/attach`, { disk: disk_id });
}

export function disk_list(project_name: string): Promise<Disk[]> {
  return api_request("GET", `/v1/disks?${in_project(project_name)}`);
}

export function disk_create(project_name: string, name: string, size_gib: number): Promise<Disk> {
  return api_request("POST", `/v1/disks?${in_project(project_name)}`, { name, size_gib });
}

export function disk_delete(disk_id: string): Promise<void> {
  return api_request("DELETE", `/v1/disks/${disk_id}`);
}
