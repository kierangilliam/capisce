use crate::db::datastore::Tables;
use crate::db::models::Instance;
use crate::db::models::InstanceState;

/// Gives an instance that is creating or starting a place on the rack. It runs if the rack has
/// the CPUs and memory free, and fails if not.
pub fn place_instance(db: &mut Tables, instance: &Instance, now: u64) -> Option<Instance> {
    let (free_cpus, free_memory_gib) = db.rack_free_capacity();
    if instance.ncpus > free_cpus || instance.memory_gib > free_memory_gib {
        let reason = "The rack has no room for this instance right now.".to_string();
        return db.instance_set_state(&instance.id, InstanceState::Failed, Some(reason), now);
    }
    db.instance_set_state(&instance.id, InstanceState::Running, None, now)
}
