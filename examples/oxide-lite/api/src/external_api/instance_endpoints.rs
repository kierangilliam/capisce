use crate::app::disks;
use crate::app::instances;
use crate::auth::session_auth;
use crate::context::ApiContext;
use crate::db::models::Disk;
use crate::db::models::Instance;
use crate::external_api::params::DiskAttachParams;
use crate::external_api::params::InstanceCreateParams;
use crate::external_api::params::InstancePath;
use crate::external_api::params::ProjectSelector;
use dropshot::endpoint;
use dropshot::HttpError;
use dropshot::HttpResponseAccepted;
use dropshot::HttpResponseCreated;
use dropshot::HttpResponseDeleted;
use dropshot::HttpResponseOk;
use dropshot::Path;
use dropshot::Query;
use dropshot::RequestContext;
use dropshot::TypedBody;

/// Lists the instances of a project.
#[endpoint { method = GET, path = "/v1/instances", tags = ["instances"] }]
pub async fn instance_list(
    rqctx: RequestContext<ApiContext>,
    query: Query<ProjectSelector>,
) -> Result<HttpResponseOk<Vec<Instance>>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let found = instances::list_instances(rqctx.context(), &caller, &query.into_inner().project)?;
    Ok(HttpResponseOk(found))
}

/// Creates an instance in a project, with a boot disk and an address. It answers at once with the
/// instance as "creating"; the console polls until it is running or failed.
#[endpoint { method = POST, path = "/v1/instances", tags = ["instances"] }]
pub async fn instance_create(
    rqctx: RequestContext<ApiContext>,
    query: Query<ProjectSelector>,
    body: TypedBody<InstanceCreateParams>,
) -> Result<HttpResponseCreated<Instance>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let params = body.into_inner();
    let new = instances::NewInstance {
        name: params.name,
        ncpus: params.ncpus,
        memory_gib: params.memory_gib,
        boot_disk_size_gib: params.boot_disk_size_gib,
    };
    let instance = instances::create_instance(rqctx.context(), &caller, &query.into_inner().project, new)?;
    Ok(HttpResponseCreated(instance))
}

/// Shows one instance as it is now.
#[endpoint { method = GET, path = "/v1/instances/{instance}", tags = ["instances"] }]
pub async fn instance_view(
    rqctx: RequestContext<ApiContext>,
    path: Path<InstancePath>,
) -> Result<HttpResponseOk<Instance>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let instance = instances::view_instance(rqctx.context(), &caller, &path.into_inner().instance)?;
    Ok(HttpResponseOk(instance))
}

/// Starts a stopped or failed instance. It answers with the instance as "starting".
#[endpoint { method = POST, path = "/v1/instances/{instance}/start", tags = ["instances"] }]
pub async fn instance_start(
    rqctx: RequestContext<ApiContext>,
    path: Path<InstancePath>,
) -> Result<HttpResponseAccepted<Instance>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let instance = instances::start_instance(rqctx.context(), &caller, &path.into_inner().instance)?;
    Ok(HttpResponseAccepted(instance))
}

/// Stops a running instance. It answers with the instance as "stopping".
#[endpoint { method = POST, path = "/v1/instances/{instance}/stop", tags = ["instances"] }]
pub async fn instance_stop(
    rqctx: RequestContext<ApiContext>,
    path: Path<InstancePath>,
) -> Result<HttpResponseAccepted<Instance>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let instance = instances::stop_instance(rqctx.context(), &caller, &path.into_inner().instance)?;
    Ok(HttpResponseAccepted(instance))
}

/// Deletes a stopped or failed instance, with its boot disk.
#[endpoint { method = DELETE, path = "/v1/instances/{instance}", tags = ["instances"] }]
pub async fn instance_delete(
    rqctx: RequestContext<ApiContext>,
    path: Path<InstancePath>,
) -> Result<HttpResponseDeleted, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    instances::delete_instance(rqctx.context(), &caller, &path.into_inner().instance)?;
    Ok(HttpResponseDeleted())
}

/// Attaches a disk of the same project to a stopped instance.
#[endpoint { method = POST, path = "/v1/instances/{instance}/disks/attach", tags = ["instances"] }]
pub async fn instance_disk_attach(
    rqctx: RequestContext<ApiContext>,
    path: Path<InstancePath>,
    body: TypedBody<DiskAttachParams>,
) -> Result<HttpResponseAccepted<Disk>, HttpError> {
    let caller = session_auth::authenticate(&rqctx)?;
    let instance_id = path.into_inner().instance;
    let disk = disks::attach_disk(rqctx.context(), &caller, &instance_id, &body.into_inner().disk)?;
    Ok(HttpResponseAccepted(disk))
}
