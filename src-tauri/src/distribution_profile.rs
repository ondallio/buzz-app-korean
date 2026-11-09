use buzzodz_plugins::Manager;
use std::ffi::{OsStr, OsString};
use std::path::PathBuf;

/// Selects plugin storage before opening it; callers supply environment reads so
/// unit tests never change the process environment or touch an installed profile.
pub(crate) fn plugin_manager(
    home: Option<PathBuf>,
    isolated: bool,
    environment: impl Fn(&str) -> Option<OsString>,
) -> Result<Manager, String> {
    let inherited = environment("BUZZODZ_HOME").map(PathBuf::from);
    let home = if isolated {
        let owned = home.ok_or("Cannot resolve this distribution's plugin home")?;
        if !owned.is_absolute() {
            return Err("This distribution's plugin home must be absolute".into());
        }
        if inherited.as_ref().is_some_and(|other| other != &owned) {
            return Err("This distribution cannot use a different BUZZODZ_HOME. Remove that override and restart Buzz.".into());
        }
        Some(owned)
    } else {
        inherited.or(home)
    };
    let profile = environment("BUZZODZ_PROFILE")
        .and_then(|value| value.into_string().ok())
        .unwrap_or_else(|| "default".into());
    let safe = environment("BUZZODZ_SAFE_MODE").as_deref() == Some(OsStr::new("1"));
    Manager::open(home, &profile, safe)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn isolated_plugin_home_rejects_a_foreign_inherited_directory_before_opening_it() {
        let directory = tempfile::tempdir().unwrap();
        let own = directory.path().join("korean");
        let foreign = directory.path().join("official");
        let result = plugin_manager(Some(own), true, |name| {
            (name == "BUZZODZ_HOME").then(|| foreign.clone().into_os_string())
        });
        assert!(result.is_err());
        assert!(!foreign.exists());
        assert!(plugin_manager(None, true, |_| None).is_err());
    }

    #[test]
    fn isolated_plugin_home_keeps_profile_and_safe_mode_inside_its_owned_directory() {
        let directory = tempfile::tempdir().unwrap();
        let own = directory.path().join("korean");
        let manager = plugin_manager(Some(own.clone()), true, |name| match name {
            "BUZZODZ_HOME" => Some(own.clone().into_os_string()),
            "BUZZODZ_PROFILE" => Some("test-profile".into()),
            "BUZZODZ_SAFE_MODE" => Some("1".into()),
            _ => None,
        })
        .unwrap();
        assert_eq!(manager.storage_root(), own.join("profiles/test-profile"));
        assert!(manager.external_plugins_paused());
    }

    #[test]
    fn official_plugin_home_retains_the_existing_explicit_environment_override() {
        let directory = tempfile::tempdir().unwrap();
        let own = directory.path().join("default");
        let selected = directory.path().join("selected");
        let manager = plugin_manager(Some(own), false, |name| {
            (name == "BUZZODZ_HOME").then(|| selected.clone().into_os_string())
        })
        .unwrap();
        assert_eq!(manager.storage_root(), selected.join("profiles/default"));
    }
}
