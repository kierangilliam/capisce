use crate::app::projects;
use crate::auth::session_auth;
use crate::context::ApiContext;
use crate::db::models::Project;
use crate::external_api::params::MemberParams;
use crate::external_api::params::ProjectCreateParams;
use crate::external_api::params::ProjectDetail;
use crate::external_api::params::ProjectPath;
use dropshot::endpoint;
use dropshot::HttpError;
use dropshot::HttpResponseCreated;
use dropshot::HttpResponseDeleted;
use dropshot::HttpResponseOk;
use dropshot::HttpResponseUpdatedNoContent;
use dropshot::Path;
use dropshot::RequestContext;
use dropshot::TypedBody;

/// Lists the projects the signed-in person has a role on.
#[endpoint { method = GET, path = "/v1/projects", tags = ["projects"] }]
pub async fn project_list(rqctx: RequestContext<ApiContext>) -> Result<HttpResponseOk<Vec<Project>>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    Ok(HttpResponseOk(projects::list_projects(rqctx.context(), &caller)))
}

/// Creates a project. Whoever creates it becomes its admin.
#[endpoint { method = POST, path = "/v1/projects", tags = ["projects"] }]
pub async fn project_create(
    rqctx: RequestContext<ApiContext>,
    body: TypedBody<ProjectCreateParams>,
) -> Result<HttpResponseCreated<Project>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let params = body.into_inner();
    let project = projects::create_project(rqctx.context(), &caller, &params.name, &params.description)?;
    Ok(HttpResponseCreated(project))
}

/// Shows one project with how much of its quota is used and the caller's role on it.
#[endpoint { method = GET, path = "/v1/projects/{project}", tags = ["projects"] }]
pub async fn project_view(
    rqctx: RequestContext<ApiContext>,
    path: Path<ProjectPath>,
) -> Result<HttpResponseOk<ProjectDetail>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let (project, usage, role) = projects::view_project(rqctx.context(), &caller, &path.into_inner().project)?;
    Ok(HttpResponseOk(ProjectDetail { project, usage, role }))
}

/// Deletes a project that holds no instances and no disks. Only an admin of the project may.
#[endpoint { method = DELETE, path = "/v1/projects/{project}", tags = ["projects"] }]
pub async fn project_delete(
    rqctx: RequestContext<ApiContext>,
    path: Path<ProjectPath>,
) -> Result<HttpResponseDeleted, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    projects::delete_project(rqctx.context(), &caller, &path.into_inner().project)?;
    Ok(HttpResponseDeleted())
}

/// Gives a person a role on a project. Only an admin of the project may.
#[endpoint { method = PUT, path = "/v1/projects/{project}/members", tags = ["projects"] }]
pub async fn project_member_set(
    rqctx: RequestContext<ApiContext>,
    path: Path<ProjectPath>,
    body: TypedBody<MemberParams>,
) -> Result<HttpResponseUpdatedNoContent, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let params = body.into_inner();
    let project_name = path.into_inner().project;
    projects::set_member_role(rqctx.context(), &caller, &project_name, &params.user_name, params.role)?;
    Ok(HttpResponseUpdatedNoContent())
}
