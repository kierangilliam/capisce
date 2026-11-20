use crate::db::datastore::Tables;
use crate::db::models::InstanceState;

impl Tables {
    /// The CPUs and memory no instance is using. Only running and stopping instances hold a place on the rack.
    pub fn rack_free_capacity(&self) -> (u32, u32) {
        let mut used_cpus = 0;
        let mut used_memory_gib = 0;
        for instance in &self.instances {
            if matches!(instance.state, InstanceState::Running | InstanceState::Stopping) {
                used_cpus += instance.ncpus;
                used_memory_gib += instance.memory_gib;
            }
        }
        (
            self.rack.total_cpus.saturating_sub(used_cpus),
            self.rack.total_memory_gib.saturating_sub(used_memory_gib),
        )
    }

    /// Hands the first free address in the pool to an instance, or returns nothing when all are taken.
    pub fn address_allocate(&mut self, instance_id: &str) -> Option<String> {
        let address = self.addresses.iter_mut().find(|address| address.instance_id.is_none())?;
        address.instance_id = Some(instance_id.to_string());
        Some(address.ip.clone())
    }

    /// Returns an instance's address to the pool.
    pub fn address_release(&mut self, instance_id: &str) {
        for address in self.addresses.iter_mut() {
            if address.instance_id.as_deref() == Some(instance_id) {
                address.instance_id = None;
            }
        }
    }
}
