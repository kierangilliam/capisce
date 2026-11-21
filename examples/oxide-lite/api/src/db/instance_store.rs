use crate::db::datastore::Tables;
use crate::db::models::Instance;
use crate::db::models::InstanceState;

impl Tables {
    pub fn instance_insert(&mut self, instance: Instance) {
        self.instances.push(instance);
    }

    pub fn instance_by_id(&self, instance_id: &str) -> Option<Instance> {
        self.instances.iter().find(|instance| instance.id == instance_id).cloned()
    }

    pub fn instance_by_name(&self, project_id: &str, name: &str) -> Option<Instance> {
        self.instances
            .iter()
            .find(|instance| instance.project_id == project_id && instance.name == name)
            .cloned()
    }

    /// The instances of a project, by name.
    pub fn instances_in_project(&self, project_id: &str) -> Vec<Instance> {
        let mut instances: Vec<Instance> =
            self.instances.iter().filter(|instance| instance.project_id == project_id).cloned().collect();
        instances.sort_by(|a, b| a.name.cmp(&b.name));
        instances
    }

    /// Moves an instance to a new state and notes when. Any earlier failure reason is replaced.
    pub fn instance_set_state(
        &mut self,
        instance_id: &str,
        state: InstanceState,
        failure_reason: Option<String>,
        now: u64,
    ) -> Option<Instance> {
        let instance = self.instances.iter_mut().find(|instance| instance.id == instance_id)?;
        instance.state = state;
        instance.state_changed_at = now;
        instance.failure_reason = failure_reason;
        Some(instance.clone())
    }

    pub fn instance_delete(&mut self, instance_id: &str) {
        self.instances.retain(|instance| instance.id != instance_id);
    }
}
