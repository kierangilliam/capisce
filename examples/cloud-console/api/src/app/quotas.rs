use crate::db::datastore::Tables;
use crate::db::models::Project;
use crate::errors::ApiError;

/// Refuses a request that would take a project past one of its quotas, naming the first one it would break.
pub fn check_quota(
    db: &Tables,
    project: &Project,
    cpus: u32,
    memory_gib: u32,
    disk_gib: u32,
) -> Result<(), ApiError> {
    let usage = db.project_usage(&project.id);
    let checks = [
        ("CPUs", cpus, project.quota_cpus.saturating_sub(usage.cpus)),
        ("GiB of memory", memory_gib, project.quota_memory_gib.saturating_sub(usage.memory_gib)),
        ("GiB of disk", disk_gib, project.quota_disk_gib.saturating_sub(usage.disk_gib)),
    ];
    for (resource, requested, available) in checks {
        if requested > available {
            return Err(ApiError::QuotaExceeded { resource: resource.to_string(), requested, available });
        }
    }
    Ok(())
}
