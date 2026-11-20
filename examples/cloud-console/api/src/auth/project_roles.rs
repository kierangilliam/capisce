use crate::db::datastore::Tables;
use crate::db::models::Project;
use crate::db::models::ProjectRole;
use crate::db::models::User;
use crate::errors::ApiError;

/// Finds a project by name and checks the caller's role on it. A project the caller has no role on looks missing.
pub fn authorize_project(
    db: &Tables,
    caller: &User,
    project_name: &str,
    needed: ProjectRole,
) -> Result<(Project, ProjectRole), ApiError> {
    let project = db.project_by_name(project_name).ok_or(ApiError::ProjectNotFound)?;
    let role = require_role(db, caller, &project.id, needed)?;
    Ok((project, role))
}

/// Checks the caller's role on a project. No role at all reads as "not found", so names do not leak.
pub fn require_role(
    db: &Tables,
    caller: &User,
    project_id: &str,
    needed: ProjectRole,
) -> Result<ProjectRole, ApiError> {
    let role = db.role_of(project_id, &caller.id).ok_or(ApiError::ProjectNotFound)?;
    if role < needed {
        return Err(ApiError::Forbidden { needed });
    }
    Ok(role)
}
