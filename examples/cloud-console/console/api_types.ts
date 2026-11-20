export type ProjectRole = "viewer" | "collaborator" | "admin";
export type InstanceState = "creating" | "starting" | "running" | "stopping" | "stopped" | "failed";

export type LoginResult = { token: string; user_name: string; expires_at: number };

export type Project = {
  id: string;
  name: string;
  description: string;
  quota_cpus: number;
  quota_memory_gib: number;
  quota_disk_gib: number;
};

export type ProjectUsage = { instances: number; disks: number; cpus: number; memory_gib: number; disk_gib: number };

export type ProjectDetail = { project: Project; usage: ProjectUsage; role: ProjectRole };

export type Instance = {
  id: string;
  project_id: string;
  name: string;
  ncpus: number;
  memory_gib: number;
  state: InstanceState;
  state_changed_at: number;
  boot_disk_id: string;
  address_ip: string;
  failure_reason: string | null;
};

export type Disk = {
  id: string;
  project_id: string;
  name: string;
  size_gib: number;
  attached_instance_id: string | null;
  is_boot_disk: boolean;
};

export type InstanceCreateParams = { name: string; ncpus: number; memory_gib: number; boot_disk_size_gib: number };
