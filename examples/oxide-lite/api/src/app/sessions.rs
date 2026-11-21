use crate::context::ApiContext;
use crate::db::datastore::now_seconds;
use crate::db::models::Session;
use crate::db::models::User;
use crate::db::user_store::password_digest;
use crate::errors::ApiError;

const SESSION_SECONDS: u64 = 8 * 60 * 60;
const MAX_FAILED_LOGINS: u32 = 5;
const LOCK_SECONDS: u64 = 15 * 60;

/// Signs a person in with their name and password, and starts a session.
/// An unknown name and a wrong password get the same answer.
pub fn login(ctx: &ApiContext, user_name: &str, password: &str) -> Result<(User, Session), ApiError> {
    let now = now_seconds();
    let mut db = ctx.datastore.lock();
    let user = db.user_by_name(user_name).ok_or(ApiError::InvalidCredentials)?;
    if let Some(until) = user.locked_until {
        if until > now {
            return Err(ApiError::AccountLocked { until });
        }
    }
    if user.password_digest != password_digest(user_name, password) {
        let failed = db.user_record_failed_login(&user.id);
        if failed >= MAX_FAILED_LOGINS {
            db.user_lock_until(&user.id, now + LOCK_SECONDS);
        }
        return Err(ApiError::InvalidCredentials);
    }
    db.user_clear_failed_logins(&user.id);
    let session = db.session_insert(&user.id, now + SESSION_SECONDS);
    Ok((user, session))
}

/// Ends the session a token belongs to. A token that is already gone is not an error.
pub fn logout(ctx: &ApiContext, token: &str) {
    ctx.datastore.lock().session_delete(token);
}
