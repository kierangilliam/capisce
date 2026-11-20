use crate::db::models::InstanceState;
use crate::db::models::ProjectRole;
use dropshot::ClientErrorStatusCode;
use dropshot::HttpError;

/// Every way a request can be refused. The console reads `error_code` to choose what to tell the person.
#[derive(Debug)]
pub enum ApiError {
    Unauthenticated,
    SessionExpired,
    InvalidCredentials,
    AccountLocked { until: u64 },
    Forbidden { needed: ProjectRole },
    ProjectNotFound,
    InstanceNotFound,
    DiskNotFound,
    UserNotFound,
    InvalidRequest(String),
    ProjectNameTaken,
    InstanceNameTaken,
    DiskNameTaken,
    ProjectNotEmpty { instances: usize, disks: usize },
    LastAdmin,
    QuotaExceeded { resource: String, requested: u32, available: u32 },
    AddressPoolExhausted,
    InstanceBusy { state: InstanceState },
    InstanceNotRunning { state: InstanceState },
    InstanceNotStopped { state: InstanceState },
    DiskAttached,
    TooManyDisks { limit: usize },
}

impl ApiError {
    fn status(&self) -> ClientErrorStatusCode {
        match self {
            ApiError::Unauthenticated | ApiError::SessionExpired | ApiError::InvalidCredentials => {
                ClientErrorStatusCode::UNAUTHORIZED
            }
            ApiError::AccountLocked { .. } | ApiError::Forbidden { .. } | ApiError::QuotaExceeded { .. } => {
                ClientErrorStatusCode::FORBIDDEN
            }
            ApiError::ProjectNotFound
            | ApiError::InstanceNotFound
            | ApiError::DiskNotFound
            | ApiError::UserNotFound => ClientErrorStatusCode::NOT_FOUND,
            ApiError::InvalidRequest(_) => ClientErrorStatusCode::BAD_REQUEST,
            _ => ClientErrorStatusCode::CONFLICT,
        }
    }

    fn message(&self) -> String {
        match self {
            ApiError::Unauthenticated => "sign in to continue".to_string(),
            ApiError::SessionExpired => "the session has expired".to_string(),
            ApiError::InvalidCredentials => "the name or password is wrong".to_string(),
            ApiError::AccountLocked { until } => format!("too many failed sign-ins; locked until {until}"),
            ApiError::Forbidden { needed } => format!("this needs the {needed:?} role on the project"),
            ApiError::ProjectNotFound => "no such project".to_string(),
            ApiError::InstanceNotFound => "no such instance".to_string(),
            ApiError::DiskNotFound => "no such disk".to_string(),
            ApiError::UserNotFound => "no such user".to_string(),
            ApiError::InvalidRequest(reason) => reason.clone(),
            ApiError::ProjectNameTaken => "a project already has this name".to_string(),
            ApiError::InstanceNameTaken => "an instance in the project already has this name".to_string(),
            ApiError::DiskNameTaken => "a disk in the project already has this name".to_string(),
            ApiError::ProjectNotEmpty { instances, disks } => {
                format!("the project still holds {instances} instances and {disks} disks")
            }
            ApiError::LastAdmin => "a project must keep at least one admin".to_string(),
            ApiError::QuotaExceeded { resource, requested, available } => {
                format!("asked for {requested} {resource}; the project has {available} left")
            }
            ApiError::AddressPoolExhausted => "no addresses are free".to_string(),
            ApiError::InstanceBusy { state } => format!("the instance is {state:?}; wait for it to settle"),
            ApiError::InstanceNotRunning { state } => format!("the instance is {state:?}, not running"),
            ApiError::InstanceNotStopped { state } => format!("the instance is {state:?}; stop it first"),
            ApiError::DiskAttached => "the disk is attached to an instance".to_string(),
            ApiError::TooManyDisks { limit } => format!("an instance holds at most {limit} disks"),
        }
    }

    fn error_code(&self) -> String {
        let debug = format!("{self:?}");
        let name_end = debug.find([' ', '(']).unwrap_or(debug.len());
        debug[..name_end].to_string()
    }
}

impl From<ApiError> for HttpError {
    fn from(error: ApiError) -> HttpError {
        if let ApiError::AddressPoolExhausted = error {
            return HttpError::for_unavail(Some(error.error_code()), error.message());
        }
        HttpError::for_client_error(Some(error.error_code()), error.status(), error.message())
    }
}
