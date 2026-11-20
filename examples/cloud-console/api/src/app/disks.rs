use crate::app::instances::lookup_instance;
use crate::app::names::validate_name;
use crate::app::quotas::check_quota;
use crate::auth::project_roles::authorize_project;
use crate::auth::project_roles::require_role;
use crate::context::ApiContext;
use crate::db::models::Disk;
use crate::db::models::InstanceState;
use crate::db::models::ProjectRole;
use crate::db::models::User;
use crate::errors::ApiError;

const MAX_DISK_GIB: u32 = 1000;
const MAX_DISKS_PER_INSTANCE: usize = 4;

/// The disks of a project, attached or not.
pub fn list_disks(ctx: &ApiContext, caller: &User, project_name: &str) -> Result<Vec<Disk>, ApiError> {
    let db = ctx.datastore.lock();
    let (project, _) = authorize_project(&db, caller, project_name, ProjectRole::Viewer)?;
    Ok(db.disks_in_project(&project.id))
}

/// Creates an empty disk in a project, attached to nothing.
pub fn create_disk(
    ctx: &ApiContext,
    caller: &User,
    project_name: &str,
    name: &str,
    size_gib: u32,
) -> Result<Disk, ApiError> {
    let mut db = ctx.datastore.lock();
    let (project, _) = authorize_project(&db, caller, project_name, ProjectRole::Collaborator)?;
    validate_name(name)?;
    if size_gib < 1 || size_gib > MAX_DISK_GIB {
        return Err(ApiError::InvalidRequest(format!("a disk is 1 to {MAX_DISK_GIB} GiB")));
    }
    if db.disk_by_name(&project.id, name).is_some() {
        return Err(ApiError::DiskNameTaken);
    }
    check_quota(&db, &project, 0, 0, size_gib)?;
    Ok(db.disk_insert(&project.id, name, size_gib, None))
}

/// Attaches a disk to an instance of the same project. The instance must be stopped, and a disk
/// serves one instance at a time.
pub fn attach_disk(ctx: &ApiContext, caller: &User, instance_id: &str, disk_id: &str) -> Result<Disk, ApiError> {
    let mut db = ctx.datastore.lock();
    let instance = lookup_instance(&mut db, caller, instance_id, ProjectRole::Collaborator)?;
    let disk = db.disk_by_id(disk_id).ok_or(ApiError::DiskNotFound)?;
    if disk.project_id != instance.project_id {
        return Err(ApiError::DiskNotFound);
    }
    match disk.attached_instance_id.as_deref() {
        Some(holder) if holder == instance.id => return Ok(disk),
        Some(_) => return Err(ApiError::DiskAttached),
        None => {}
    }
    if instance.state != InstanceState::Stopped {
        return Err(ApiError::InstanceNotStopped { state: instance.state });
    }
    if db.disks_attached_to(&instance.id).len() >= MAX_DISKS_PER_INSTANCE {
        return Err(ApiError::TooManyDisks { limit: MAX_DISKS_PER_INSTANCE });
    }
    db.disk_set_attachment(&disk.id, Some(&instance.id)).ok_or(ApiError::DiskNotFound)
}

/// Deletes a disk that is attached to nothing. A boot disk is always attached, so it goes only with its instance.
pub fn delete_disk(ctx: &ApiContext, caller: &User, disk_id: &str) -> Result<(), ApiError> {
    let mut db = ctx.datastore.lock();
    let disk = db.disk_by_id(disk_id).ok_or(ApiError::DiskNotFound)?;
    match require_role(&db, caller, &disk.project_id, ProjectRole::Collaborator) {
        Err(ApiError::ProjectNotFound) => return Err(ApiError::DiskNotFound),
        Err(other) => return Err(other),
        Ok(_) => {}
    }
    if disk.attached_instance_id.is_some() {
        return Err(ApiError::DiskAttached);
    }
    db.disk_delete(&disk.id);
    Ok(())
}
