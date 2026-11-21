use crate::app::names::validate_name;
use crate::auth::project_roles::authorize_project;
use crate::context::ApiContext;
use crate::db::models::Project;
use crate::db::models::ProjectRole;
use crate::db::models::ProjectUsage;
use crate::db::models::User;
use crate::errors::ApiError;

/// The projects the caller has a role on.
pub fn list_projects(ctx: &ApiContext, caller: &User) -> Vec<Project> {
    ctx.datastore.lock().projects_for_user(&caller.id)
}

/// Creates a project with the default quota. Whoever creates it becomes its admin.
pub fn create_project(
    ctx: &ApiContext,
    caller: &User,
    name: &str,
    description: &str,
) -> Result<Project, ApiError> {
    validate_name(name)?;
    let mut db = ctx.datastore.lock();
    if db.project_by_name(name).is_some() {
        return Err(ApiError::ProjectNameTaken);
    }
    let project = db.project_insert(name, description);
    db.role_set(&project.id, &caller.id, ProjectRole::Admin);
    Ok(project)
}

/// One project, how much of its quota is used, and the caller's role on it.
pub fn view_project(
    ctx: &ApiContext,
    caller: &User,
    project_name: &str,
) -> Result<(Project, ProjectUsage, ProjectRole), ApiError> {
    let db = ctx.datastore.lock();
    let (project, role) = authorize_project(&db, caller, project_name, ProjectRole::Viewer)?;
    let usage = db.project_usage(&project.id);
    Ok((project, usage, role))
}

/// Deletes a project. It is refused while the project holds any instance or disk.
pub fn delete_project(ctx: &ApiContext, caller: &User, project_name: &str) -> Result<(), ApiError> {
    let mut db = ctx.datastore.lock();
    let (project, _) = authorize_project(&db, caller, project_name, ProjectRole::Admin)?;
    let usage = db.project_usage(&project.id);
    if usage.instances > 0 || usage.disks > 0 {
        return Err(ApiError::ProjectNotEmpty { instances: usage.instances, disks: usage.disks });
    }
    db.project_delete(&project.id);
    Ok(())
}

/// Gives a person a role on a project, replacing any role they had. The project must keep an admin.
pub fn set_member_role(
    ctx: &ApiContext,
    caller: &User,
    project_name: &str,
    user_name: &str,
    role: ProjectRole,
) -> Result<(), ApiError> {
    let mut db = ctx.datastore.lock();
    let (project, _) = authorize_project(&db, caller, project_name, ProjectRole::Admin)?;
    let member = db.user_by_name(user_name).ok_or(ApiError::UserNotFound)?;
    let is_admin_now = db.role_of(&project.id, &member.id) == Some(ProjectRole::Admin);
    if is_admin_now && role != ProjectRole::Admin && db.admin_count(&project.id) == 1 {
        return Err(ApiError::LastAdmin);
    }
    db.role_set(&project.id, &member.id, role);
    Ok(())
}
