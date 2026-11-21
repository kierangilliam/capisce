//! Everything the service remembers, in memory behind one lock.

use crate::db::models::Address;
use crate::db::models::Disk;
use crate::db::models::Instance;
use crate::db::models::Project;
use crate::db::models::ProjectRole;
use crate::db::models::Rack;
use crate::db::models::RoleAssignment;
use crate::db::models::Session;
use crate::db::models::User;
use crate::db::user_store::password_digest;
use std::sync::Mutex;
use std::sync::MutexGuard;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;

const ADDRESS_POOL_SIZE: u8 = 24;

pub struct Datastore {
    tables: Mutex<Tables>,
}

/// The rows. Each `*_store.rs` file adds the reads and writes for its own tables.
pub struct Tables {
    pub users: Vec<User>,
    pub sessions: Vec<Session>,
    pub role_assignments: Vec<RoleAssignment>,
    pub projects: Vec<Project>,
    pub instances: Vec<Instance>,
    pub disks: Vec<Disk>,
    pub addresses: Vec<Address>,
    pub rack: Rack,
    last_id: u64,
}

impl Datastore {
    /// A rack with two people, one project they share, and a pool of free addresses.
    pub fn with_demo_data() -> Datastore {
        let mut tables = Tables {
            users: Vec::new(),
            sessions: Vec::new(),
            role_assignments: Vec::new(),
            projects: Vec::new(),
            instances: Vec::new(),
            disks: Vec::new(),
            addresses: Vec::new(),
            rack: Rack { total_cpus: 32, total_memory_gib: 128 },
            last_id: 0,
        };
        for host in 0..ADDRESS_POOL_SIZE {
            tables.addresses.push(Address { ip: format!("192.168.20.{}", 10 + host), instance_id: None });
        }
        let mut user_ids = Vec::new();
        for name in ["ada", "grace"] {
            let id = tables.next_id("user");
            let digest = password_digest(name, "console-demo");
            tables.users.push(User {
                id: id.clone(),
                name: name.to_string(),
                password_digest: digest,
                failed_logins: 0,
                locked_until: None,
            });
            user_ids.push(id);
        }
        let project = tables.project_insert("demo", "A project to try the console with");
        tables.role_set(&project.id, &user_ids[0], ProjectRole::Admin);
        tables.role_set(&project.id, &user_ids[1], ProjectRole::Viewer);
        Datastore { tables: Mutex::new(tables) }
    }

    /// Holds the whole store for one piece of work, so its checks and writes cannot interleave with another's.
    pub fn lock(&self) -> MutexGuard<'_, Tables> {
        self.tables.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

impl Tables {
    pub fn next_id(&mut self, kind: &str) -> String {
        self.last_id += 1;
        format!("{kind}-{}", self.last_id)
    }
}

pub fn now_seconds() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|elapsed| elapsed.as_secs()).unwrap_or(0)
}
