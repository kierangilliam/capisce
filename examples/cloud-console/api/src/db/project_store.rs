use crate::db::datastore::Tables;
use crate::db::models::Project;
use crate::db::models::ProjectUsage;

const DEFAULT_QUOTA_CPUS: u32 = 16;
const DEFAULT_QUOTA_MEMORY_GIB: u32 = 64;
const DEFAULT_QUOTA_DISK_GIB: u32 = 500;

impl Tables {
    pub fn project_by_name(&self, name: &str) -> Option<Project> {
        self.projects.iter().find(|project| project.name == name).cloned()
    }

    pub fn project_by_id(&self, project_id: &str) -> Option<Project> {
        self.projects.iter().find(|project| project.id == project_id).cloned()
    }

    /// Every new project starts with the same quota.
    pub fn project_insert(&mut self, name: &str, description: &str) -> Project {
        let project = Project {
            id: self.next_id("project"),
            name: name.to_string(),
            description: description.to_string(),
            quota_cpus: DEFAULT_QUOTA_CPUS,
            quota_memory_gib: DEFAULT_QUOTA_MEMORY_GIB,
            quota_disk_gib: DEFAULT_QUOTA_DISK_GIB,
        };
        self.projects.push(project.clone());
        project
    }

    /// The projects a person has any role on, by name.
    pub fn projects_for_user(&self, user_id: &str) -> Vec<Project> {
        let mut projects: Vec<Project> = self
            .projects
            .iter()
            .filter(|project| self.role_of(&project.id, user_id).is_some())
            .cloned()
            .collect();
        projects.sort_by(|a, b| a.name.cmp(&b.name));
        projects
    }

    /// What the project holds against its quota. Instances count in every state, and disks attached or not.
    pub fn project_usage(&self, project_id: &str) -> ProjectUsage {
        let mut usage = ProjectUsage::default();
        for instance in self.instances.iter().filter(|instance| instance.project_id == project_id) {
            usage.instances += 1;
            usage.cpus += instance.ncpus;
            usage.memory_gib += instance.memory_gib;
        }
        for disk in self.disks.iter().filter(|disk| disk.project_id == project_id) {
            usage.disks += 1;
            usage.disk_gib += disk.size_gib;
        }
        usage
    }

    /// Removes the project and every role on it.
    pub fn project_delete(&mut self, project_id: &str) {
        self.role_assignments.retain(|each| each.project_id != project_id);
        self.projects.retain(|project| project.id != project_id);
    }
}
