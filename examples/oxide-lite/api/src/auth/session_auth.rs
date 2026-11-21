use crate::context::ApiContext;
use crate::db::datastore::now_seconds;
use crate::db::models::User;
use crate::errors::ApiError;
use dropshot::RequestContext;

/// The session token a request carries in its `Authorization: Bearer` header.
pub fn bearer_token(rqctx: &RequestContext<ApiContext>) -> Option<String> {
    let header = rqctx.request.headers().get("authorization")?.to_str().ok()?;
    let token = header.strip_prefix("Bearer ")?.trim();
    if token.is_empty() {
        return None;
    }
    Some(token.to_string())
}

/// Says who is calling, from the session token the console sends. An expired session is deleted.
pub fn authenticate(rqctx: &RequestContext<ApiContext>) -> Result<User, ApiError> {
    let token = bearer_token(rqctx).ok_or(ApiError::Unauthenticated)?;
    let mut db = rqctx.context().datastore.lock();
    let session = db.session_by_token(&token).ok_or(ApiError::Unauthenticated)?;
    if session.expires_at <= now_seconds() {
        db.session_delete(&token);
        return Err(ApiError::SessionExpired);
    }
    db.user_by_id(&session.user_id).ok_or(ApiError::Unauthenticated)
}
