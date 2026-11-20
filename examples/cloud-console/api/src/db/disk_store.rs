use crate::db::datastore::Tables;
use crate::db::models::Disk;

impl Tables {
    pub fn disk_insert(
        &mut self,
        project_id: &str,
        name: &str,
        size_gib: u32,
        boot_for_instance_id: Option<&str>,
    ) -> Disk {
        let disk = Disk {
            id: self.next_id("disk"),
            project_id: project_id.to_string(),
            name: name.to_string(),
            size_gib,
            attached_instance_id: boot_for_instance_id.map(str::to_string),
            is_boot_disk: boot_for_instance_id.is_some(),
        };
        self.disks.push(disk.clone());
        disk
    }

    pub fn disk_by_id(&self, disk_id: &str) -> Option<Disk> {
        self.disks.iter().find(|disk| disk.id == disk_id).cloned()
    }

    pub fn disk_by_name(&self, project_id: &str, name: &str) -> Option<Disk> {
        self.disks.iter().find(|disk| disk.project_id == project_id && disk.name == name).cloned()
    }

    /// The disks of a project, by name.
    pub fn disks_in_project(&self, project_id: &str) -> Vec<Disk> {
        let mut disks: Vec<Disk> =
            self.disks.iter().filter(|disk| disk.project_id == project_id).cloned().collect();
        disks.sort_by(|a, b| a.name.cmp(&b.name));
        disks
    }

    pub fn disks_attached_to(&self, instance_id: &str) -> Vec<Disk> {
        self.disks
            .iter()
            .filter(|disk| disk.attached_instance_id.as_deref() == Some(instance_id))
            .cloned()
            .collect()
    }

    /// Attaches the disk to an instance, or to none.
    pub fn disk_set_attachment(&mut self, disk_id: &str, instance_id: Option<&str>) -> Option<Disk> {
        let disk = self.disks.iter_mut().find(|disk| disk.id == disk_id)?;
        disk.attached_instance_id = instance_id.map(str::to_string);
        Some(disk.clone())
    }

    pub fn disk_delete(&mut self, disk_id: &str) {
        self.disks.retain(|disk| disk.id != disk_id);
    }
}
