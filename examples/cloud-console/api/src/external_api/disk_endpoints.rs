use crate::app::disks;
use crate::auth::session_auth;
use crate::context::ApiContext;
use crate::db::models::Disk;
use crate::external_api::params::DiskCreateParams;
use crate::external_api::params::DiskPath;
use crate::external_api::params::ProjectSelector;
use dropshot::endpoint;
use dropshot::HttpError;
use dropshot::HttpResponseCreated;
use dropshot::HttpResponseDeleted;
use dropshot::HttpResponseOk;
use dropshot::Path;
use dropshot::Query;
use dropshot::RequestContext;
use dropshot::TypedBody;

/// Lists the disks of a project.
#[endpoint { method = GET, path = "/v1/disks", tags = ["disks"] }]
pub async fn disk_list(
    rqctx: RequestContext<ApiContext>,
    query: Query<ProjectSelector>,
) -> Result<HttpResponseOk<Vec<Disk>>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let found = disks::list_disks(rqctx.context(), &caller, &query.into_inner().project)?;
    Ok(HttpResponseOk(found))
}

/// Creates an empty disk in a project.
#[endpoint { method = POST, path = "/v1/disks", tags = ["disks"] }]
pub async fn disk_create(
    rqctx: RequestContext<ApiContext>,
    query: Query<ProjectSelector>,
    body: TypedBody<DiskCreateParams>,
) -> Result<HttpResponseCreated<Disk>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let params = body.into_inner();
    let project_name = query.into_inner().project;
    let disk = disks::create_disk(rqctx.context(), &caller, &project_name, &params.name, params.size_gib)?;
    Ok(HttpResponseCreated(disk))
}

/// Deletes a disk that is attached to nothing.
#[endpoint { method = DELETE, path = "/v1/disks/{disk}", tags = ["disks"] }]
pub async fn disk_delete(
    rqctx: RequestContext<ApiContext>,
    path: Path<DiskPath>,
) -> Result<HttpResponseDeleted, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    disks::delete_disk(rqctx.context(), &caller, &path.into_inner().disk)?;
    Ok(HttpResponseDeleted())
}
