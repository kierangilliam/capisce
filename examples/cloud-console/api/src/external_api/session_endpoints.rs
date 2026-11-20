use crate::app::sessions;
use crate::auth::session_auth;
use crate::context::ApiContext;
use crate::external_api::params::LoginParams;
use crate::external_api::params::LoginResult;
use dropshot::endpoint;
use dropshot::HttpError;
use dropshot::HttpResponseOk;
use dropshot::HttpResponseUpdatedNoContent;
use dropshot::RequestContext;
use dropshot::TypedBody;

/// Signs a person in with a name and password. The answer holds the session token the console sends from then on.
#[endpoint { method = POST, path = "/v1/login", tags = ["session"] }]
pub async fn login(
    rqctx: RequestContext<ApiContext>,
    body: TypedBody<LoginParams>,
) -> Result<HttpResponseOk<LoginResult>, HttpError> {
    let params = body.into_inner();
    let (user, session) = sessions::login(rqctx.context(), &params.user_name, &params.password)?;
    Ok(HttpResponseOk(LoginResult {
        token: session.token,
        user_name: user.name,
        expires_at: session.expires_at,
    }))
}

/// Signs out: ends the session whose token the request carries. It needs no valid session to succeed.
#[endpoint { method = POST, path = "/v1/logout", tags = ["session"] }]
pub async fn logout(rqctx: RequestContext<ApiContext>) -> Result<HttpResponseUpdatedNoContent, HttpError> {
    if let Some(token) = session_auth::bearer_token(&rqctx) {
        sessions::logout(rqctx.context(), &token);
    }
    Ok(HttpResponseUpdatedNoContent())
}
