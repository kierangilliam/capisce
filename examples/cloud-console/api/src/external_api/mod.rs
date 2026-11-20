pub mod disk_endpoints;
pub mod instance_endpoints;
pub mod params;
pub mod project_endpoints;
pub mod session_endpoints;

use crate::context::ApiContext;
use dropshot::ApiDescription;

/// Every endpoint the console calls.
pub fn api_description() -> Result<ApiDescription<ApiContext>, String> {
    let mut api = ApiDescription::new();
    let mut failures = Vec::new();
    macro_rules! register {
        ($endpoint:path) => {
            if let Err(error) = api.register($endpoint) {
                failures.push(error.to_string());
            }
        };
    }
    register!(session_endpoints::login);
    register!(session_endpoints::logout);
    register!(project_endpoints::project_list);
    register!(project_endpoints::project_create);
    register!(project_endpoints::project_view);
    register!(project_endpoints::project_delete);
    register!(project_endpoints::project_member_set);
    register!(instance_endpoints::instance_list);
    register!(instance_endpoints::instance_create);
    register!(instance_endpoints::instance_view);
    register!(instance_endpoints::instance_start);
    register!(instance_endpoints::instance_stop);
    register!(instance_endpoints::instance_delete);
    register!(instance_endpoints::instance_disk_attach);
    register!(disk_endpoints::disk_list);
    register!(disk_endpoints::disk_create);
    register!(disk_endpoints::disk_delete);
    if failures.is_empty() {
        return Ok(api);
    }
    Err(format!("could not register the endpoints: {}", failures.join("; ")))
}
