use crate::errors::ApiError;

const MAX_NAME_LENGTH: usize = 40;

/// Projects, instances and disks share one rule for names: lowercase letters, digits and dashes,
/// starting with a letter, not ending with a dash, at most 40 characters.
pub fn validate_name(name: &str) -> Result<(), ApiError> {
    let starts_with_letter = name.chars().next().is_some_and(|first| first.is_ascii_lowercase());
    let allowed = name.chars().all(|each| each.is_ascii_lowercase() || each.is_ascii_digit() || each == '-');
    if !starts_with_letter || !allowed || name.ends_with('-') || name.len() > MAX_NAME_LENGTH {
        return Err(ApiError::InvalidRequest(format!(
            "\"{name}\" is not a valid name: use lowercase letters, digits and dashes, starting with a letter"
        )));
    }
    Ok(())
}
