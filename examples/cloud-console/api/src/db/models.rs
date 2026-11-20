//! What the datastore holds. Ids are short text such as `instance-12`. Times are seconds since 1970.

use schemars::JsonSchema;
use serde::Deserialize;
use serde::Serialize;

/// A person who can sign in to the console.
#[derive(Clone, Debug)]
pub struct User {
    pub id: String,
    /// What the person types to sign in. Unique.
    pub name: String,
    pub password_digest: u64,
    /// Wrong passwords in a row since the last good sign-in.
    pub failed_logins: u32,
    /// Sign-in is refused until this time, after too many wrong passwords.
    pub locked_until: Option<u64>,
}

/// One signed-in browser. The console sends its token with every request.
#[derive(Clone, Debug)]
pub struct Session {
    pub token: String,
    pub user_id: String,
    pub expires_at: u64,
}

/// What a person may do in a project. Each role includes the ones before it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ProjectRole {
    /// May look at the project and what it holds.
    Viewer,
    /// May also create, start, stop and delete instances and disks.
    Collaborator,
    /// May also change who has a role, and delete the project.
    Admin,
}

/// The role one person has on one project. A person with no role cannot see the project at all.
#[derive(Clone, Debug)]
pub struct RoleAssignment {
    pub project_id: String,
    pub user_id: String,
    pub role: ProjectRole,
}

/// A group of instances and disks, with a quota they share.
#[derive(Clone, Debug, Serialize, JsonSchema)]
pub struct Project {
    pub id: String,
    /// Unique across the rack. The console addresses a project by its name.
    pub name: String,
    pub description: String,
    /// The most CPUs its instances may hold together, running or not.
    pub quota_cpus: u32,
    pub quota_memory_gib: u32,
    /// The most storage its disks may hold together, attached or not.
    pub quota_disk_gib: u32,
}

/// Where an instance is in its life.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum InstanceState {
    /// Recorded, and waiting for a place on the rack for the first time.
    Creating,
    /// Asked to start again, and waiting for a place on the rack.
    Starting,
    /// Placed on the rack and using its CPUs and memory.
    Running,
    /// Asked to stop. It still holds its place on the rack.
    Stopping,
    /// Off. It keeps its disks, address and quota, and uses no rack capacity.
    Stopped,
    /// The rack had no room when it was created or started.
    Failed,
}

/// A virtual machine in a project.
#[derive(Clone, Debug, Serialize, JsonSchema)]
pub struct Instance {
    pub id: String,
    pub project_id: String,
    /// Unique within its project.
    pub name: String,
    pub ncpus: u32,
    pub memory_gib: u32,
    pub state: InstanceState,
    /// When it entered its state. Creating, starting and stopping finish a few seconds after this.
    pub state_changed_at: u64,
    /// The disk it starts from. Created with the instance and deleted with it.
    pub boot_disk_id: String,
    /// Held from creation until the instance is deleted.
    pub address_ip: String,
    /// Why it failed, in words for the person. Empty unless the state is failed.
    pub failure_reason: Option<String>,
}

/// Storage in a project. A disk is attached to one instance or to none.
#[derive(Clone, Debug, Serialize, JsonSchema)]
pub struct Disk {
    pub id: String,
    pub project_id: String,
    /// Unique within its project.
    pub name: String,
    pub size_gib: u32,
    pub attached_instance_id: Option<String>,
    /// A boot disk lives and dies with its instance and cannot be deleted on its own.
    pub is_boot_disk: bool,
}

/// One address from the rack's pool. Every project draws from the same pool.
#[derive(Clone, Debug)]
pub struct Address {
    pub ip: String,
    /// The instance holding it, or nobody.
    pub instance_id: Option<String>,
}

/// The hardware every project shares. Running instances use its CPUs and memory.
#[derive(Clone, Debug)]
pub struct Rack {
    pub total_cpus: u32,
    pub total_memory_gib: u32,
}

/// How much of its quota a project is using.
#[derive(Clone, Debug, Default, Serialize, JsonSchema)]
pub struct ProjectUsage {
    pub instances: usize,
    pub disks: usize,
    pub cpus: u32,
    pub memory_gib: u32,
    pub disk_gib: u32,
}
