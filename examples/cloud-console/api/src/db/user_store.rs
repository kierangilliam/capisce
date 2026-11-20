use crate::db::datastore::Tables;
use crate::db::models::ProjectRole;
use crate::db::models::RoleAssignment;
use crate::db::models::Session;
use crate::db::models::User;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;

/// A stand-in for a real password hash, so the example needs no extra crate. Do not use it for real passwords.
pub fn password_digest(user_name: &str, password: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    ("cloud-console", user_name, password).hash(&mut hasher);
    hasher.finish()
}

impl Tables {
    pub fn user_by_name(&self, name: &str) -> Option<User> {
        self.users.iter().find(|user| user.name == name).cloned()
    }

    pub fn user_by_id(&self, user_id: &str) -> Option<User> {
        self.users.iter().find(|user| user.id == user_id).cloned()
    }

    /// Counts one more wrong password, and returns how many there have been in a row.
    pub fn user_record_failed_login(&mut self, user_id: &str) -> u32 {
        let Some(user) = self.users.iter_mut().find(|user| user.id == user_id) else {
            return 0;
        };
        user.failed_logins += 1;
        user.failed_logins
    }

    pub fn user_lock_until(&mut self, user_id: &str, until: u64) {
        if let Some(user) = self.users.iter_mut().find(|user| user.id == user_id) {
            user.failed_logins = 0;
            user.locked_until = Some(until);
        }
    }

    pub fn user_clear_failed_logins(&mut self, user_id: &str) {
        if let Some(user) = self.users.iter_mut().find(|user| user.id == user_id) {
            user.failed_logins = 0;
            user.locked_until = None;
        }
    }

    pub fn session_insert(&mut self, user_id: &str, expires_at: u64) -> Session {
        let session = Session {
            token: uuid::Uuid::new_v4().simple().to_string(),
            user_id: user_id.to_string(),
            expires_at,
        };
        self.sessions.push(session.clone());
        session
    }

    pub fn session_by_token(&self, token: &str) -> Option<Session> {
        self.sessions.iter().find(|session| session.token == token).cloned()
    }

    pub fn session_delete(&mut self, token: &str) {
        self.sessions.retain(|session| session.token != token);
    }

    pub fn role_of(&self, project_id: &str, user_id: &str) -> Option<ProjectRole> {
        self.role_assignments
            .iter()
            .find(|each| each.project_id == project_id && each.user_id == user_id)
            .map(|each| each.role)
    }

    /// Gives a person a role on a project, replacing the role they had.
    pub fn role_set(&mut self, project_id: &str, user_id: &str, role: ProjectRole) {
        self.role_assignments.retain(|each| !(each.project_id == project_id && each.user_id == user_id));
        self.role_assignments.push(RoleAssignment {
            project_id: project_id.to_string(),
            user_id: user_id.to_string(),
            role,
        });
    }

    pub fn admin_count(&self, project_id: &str) -> usize {
        self.role_assignments
            .iter()
            .filter(|each| each.project_id == project_id && each.role == ProjectRole::Admin)
            .count()
    }
}
