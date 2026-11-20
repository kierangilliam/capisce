use crate::db::datastore::Datastore;

/// What every endpoint shares: the datastore.
pub struct ApiContext {
    pub datastore: Datastore,
}

impl ApiContext {
    pub fn with_demo_data() -> ApiContext {
        ApiContext { datastore: Datastore::with_demo_data() }
    }
}
