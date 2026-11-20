//! A small cloud control-plane API: projects, instances and disks, kept in memory.

mod app;
mod auth;
mod context;
mod db;
mod errors;
mod external_api;

use context::ApiContext;
use dropshot::ConfigDropshot;
use dropshot::ConfigLogging;
use dropshot::ConfigLoggingLevel;
use dropshot::ServerBuilder;

#[tokio::main]
async fn main() -> Result<(), String> {
    let log = ConfigLogging::StderrTerminal { level: ConfigLoggingLevel::Info }
        .to_logger("cloud-console-api")
        .map_err(|error| format!("could not create the logger: {error}"))?;
    let config = ConfigDropshot {
        bind_address: "127.0.0.1:12220".parse().expect("a valid address"),
        ..Default::default()
    };
    let api = external_api::api_description()?;
    let server = ServerBuilder::new(api, ApiContext::with_demo_data(), log)
        .config(config)
        .start()
        .map_err(|error| format!("could not start the server: {error}"))?;
    server.await
}
