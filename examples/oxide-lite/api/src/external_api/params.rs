//! The shapes of requests and responses that are not a model as stored.

use crate::db::models::Project;
use crate::db::models::ProjectRole;
use crate::db::models::ProjectUsage;
use schemars::JsonSchema;
use serde::Deserialize;
use serde::Serialize;

#[derive(Deserialize, JsonSchema)]
pub struct LoginParams {
    pub user_name: String,
    pub password: String,
}

#[derive(Serialize, JsonSchema)]
pub struct LoginResult {
    pub token: String,
    pub user_name: String,
    pub expires_at: u64,
}

#[derive(Deserialize, JsonSchema)]
pub struct ProjectSelector {
    /// The project's name.
    pub project: String,
}

#[derive(Deserialize, JsonSchema)]
pub struct ProjectPath {
    pub project: String,
}

#[derive(Deserialize, JsonSchema)]
pub struct InstancePath {
    pub instance: String,
}

#[derive(Deserialize, JsonSchema)]
pub struct DiskPath {
    pub disk: String,
}

#[derive(Deserialize, JsonSchema)]
pub struct ProjectCreateParams {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Serialize, JsonSchema)]
pub struct ProjectDetail {
    pub project: Project,
    pub usage: ProjectUsage,
    /// The caller's own role, so the console can hide what they may not do.
    pub role: ProjectRole,
}

#[derive(Deserialize, JsonSchema)]
pub struct MemberParams {
    pub user_name: String,
    pub role: ProjectRole,
}

#[derive(Deserialize, JsonSchema)]
pub struct InstanceCreateParams {
    pub name: String,
    pub ncpus: u32,
    pub memory_gib: u32,
    pub boot_disk_size_gib: u32,
}

#[derive(Deserialize, JsonSchema)]
pub struct DiskCreateParams {
    pub name: String,
    pub size_gib: u32,
}

#[derive(Deserialize, JsonSchema)]
pub struct DiskAttachParams {
    pub disk: String,
}
