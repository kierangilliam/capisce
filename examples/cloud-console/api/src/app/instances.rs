use crate::app::names::validate_name;
use crate::app::placement::place_instance;
use crate::app::quotas::check_quota;
use crate::auth::project_roles::authorize_project;
use crate::auth::project_roles::require_role;
use crate::context::ApiContext;
use crate::db::datastore::now_seconds;
use crate::db::datastore::Tables;
use crate::db::models::Instance;
use crate::db::models::InstanceState;
use crate::db::models::ProjectRole;
use crate::db::models::User;
use crate::errors::ApiError;

const MAX_CPUS: u32 = 8;
const MAX_MEMORY_GIB: u32 = 32;
const MIN_BOOT_DISK_GIB: u32 = 10;
const MAX_BOOT_DISK_GIB: u32 = 200;
const SETTLE_SECONDS: u64 = 3;

pub struct NewInstance {
    pub name: String,
    pub ncpus: u32,
    pub memory_gib: u32,
    pub boot_disk_size_gib: u32,
}

/// Creates an instance with its boot disk and an address. It is recorded as creating, and gets a
/// place on the rack a few seconds later.
pub fn create_instance(
    ctx: &ApiContext,
    caller: &User,
    project_name: &str,
    new: NewInstance,
) -> Result<Instance, ApiError> {
    let mut db = ctx.datastore.lock();
    let (project, _) = authorize_project(&db, caller, project_name, ProjectRole::Collaborator)?;
    validate_name(&new.name)?;
    if new.ncpus < 1 || new.ncpus > MAX_CPUS {
        return Err(ApiError::InvalidRequest(format!("an instance has 1 to {MAX_CPUS} CPUs")));
    }
    if new.memory_gib < 1 || new.memory_gib > MAX_MEMORY_GIB {
        return Err(ApiError::InvalidRequest(format!("an instance has 1 to {MAX_MEMORY_GIB} GiB of memory")));
    }
    if new.boot_disk_size_gib < MIN_BOOT_DISK_GIB || new.boot_disk_size_gib > MAX_BOOT_DISK_GIB {
        return Err(ApiError::InvalidRequest(format!(
            "a boot disk is {MIN_BOOT_DISK_GIB} to {MAX_BOOT_DISK_GIB} GiB"
        )));
    }
    if db.instance_by_name(&project.id, &new.name).is_some() {
        return Err(ApiError::InstanceNameTaken);
    }
    let boot_disk_name = format!("{}-boot", new.name);
    if db.disk_by_name(&project.id, &boot_disk_name).is_some() {
        return Err(ApiError::DiskNameTaken);
    }
    check_quota(&db, &project, new.ncpus, new.memory_gib, new.boot_disk_size_gib)?;

    let instance_id = db.next_id("instance");
    let address_ip = db.address_allocate(&instance_id).ok_or(ApiError::AddressPoolExhausted)?;
    let boot_disk = db.disk_insert(&project.id, &boot_disk_name, new.boot_disk_size_gib, Some(&instance_id));
    let instance = Instance {
        id: instance_id,
        project_id: project.id,
        name: new.name,
        ncpus: new.ncpus,
        memory_gib: new.memory_gib,
        state: InstanceState::Creating,
        state_changed_at: now_seconds(),
        boot_disk_id: boot_disk.id,
        address_ip,
        failure_reason: None,
    };
    db.instance_insert(instance.clone());
    Ok(instance)
}

/// Finishes a change that has had its few seconds: creating and starting instances are placed on
/// the rack, and stopping instances become stopped. Anything else is returned as it is.
pub fn settle_instance(db: &mut Tables, instance: Instance, now: u64) -> Instance {
    if now < instance.state_changed_at + SETTLE_SECONDS {
        return instance;
    }
    let settled = match instance.state {
        InstanceState::Creating | InstanceState::Starting => place_instance(db, &instance, now),
        InstanceState::Stopping => db.instance_set_state(&instance.id, InstanceState::Stopped, None, now),
        _ => None,
    };
    settled.unwrap_or(instance)
}

/// Finds an instance, checks the caller's role on its project, and settles its state.
pub fn lookup_instance(
    db: &mut Tables,
    caller: &User,
    instance_id: &str,
    needed: ProjectRole,
) -> Result<Instance, ApiError> {
    let instance = db.instance_by_id(instance_id).ok_or(ApiError::InstanceNotFound)?;
    match require_role(db, caller, &instance.project_id, needed) {
        Err(ApiError::ProjectNotFound) => return Err(ApiError::InstanceNotFound),
        Err(other) => return Err(other),
        Ok(_) => {}
    }
    Ok(settle_instance(db, instance, now_seconds()))
}

/// The instances of a project, each with its state settled.
pub fn list_instances(ctx: &ApiContext, caller: &User, project_name: &str) -> Result<Vec<Instance>, ApiError> {
    let mut db = ctx.datastore.lock();
    let (project, _) = authorize_project(&db, caller, project_name, ProjectRole::Viewer)?;
    let now = now_seconds();
    let mut instances = Vec::new();
    for instance in db.instances_in_project(&project.id) {
        instances.push(settle_instance(&mut db, instance, now));
    }
    Ok(instances)
}

/// One instance as it is now. The console polls this while an instance is changing state.
pub fn view_instance(ctx: &ApiContext, caller: &User, instance_id: &str) -> Result<Instance, ApiError> {
    let mut db = ctx.datastore.lock();
    lookup_instance(&mut db, caller, instance_id, ProjectRole::Viewer)
}

/// Starts a stopped or failed instance. One that is already running or starting is left alone.
pub fn start_instance(ctx: &ApiContext, caller: &User, instance_id: &str) -> Result<Instance, ApiError> {
    let mut db = ctx.datastore.lock();
    let instance = lookup_instance(&mut db, caller, instance_id, ProjectRole::Collaborator)?;
    match instance.state {
        InstanceState::Running | InstanceState::Starting => Ok(instance),
        InstanceState::Stopped | InstanceState::Failed => db
            .instance_set_state(&instance.id, InstanceState::Starting, None, now_seconds())
            .ok_or(ApiError::InstanceNotFound),
        state => Err(ApiError::InstanceBusy { state }),
    }
}

/// Stops a running instance. One that is already stopped or stopping is left alone.
pub fn stop_instance(ctx: &ApiContext, caller: &User, instance_id: &str) -> Result<Instance, ApiError> {
    let mut db = ctx.datastore.lock();
    let instance = lookup_instance(&mut db, caller, instance_id, ProjectRole::Collaborator)?;
    match instance.state {
        InstanceState::Stopped | InstanceState::Stopping => Ok(instance),
        InstanceState::Running => db
            .instance_set_state(&instance.id, InstanceState::Stopping, None, now_seconds())
            .ok_or(ApiError::InstanceNotFound),
        state => Err(ApiError::InstanceNotRunning { state }),
    }
}

/// Deletes a stopped or failed instance. Its boot disk goes with it, its other disks are
/// detached and kept, and its address returns to the pool.
pub fn delete_instance(ctx: &ApiContext, caller: &User, instance_id: &str) -> Result<(), ApiError> {
    let mut db = ctx.datastore.lock();
    let instance = lookup_instance(&mut db, caller, instance_id, ProjectRole::Collaborator)?;
    if !matches!(instance.state, InstanceState::Stopped | InstanceState::Failed) {
        return Err(ApiError::InstanceNotStopped { state: instance.state });
    }
    for disk in db.disks_attached_to(&instance.id) {
        if disk.is_boot_disk {
            db.disk_delete(&disk.id);
        } else {
            db.disk_set_attachment(&disk.id, None);
        }
    }
    db.address_release(&instance.id);
    db.instance_delete(&instance.id);
    Ok(())
}
