//! Build-time ownership for an independent distributor. Unset preserves Buzz's stores.

/// An explicit reverse-DNS identifier, never selected from the runtime environment.
pub const ID: Option<&str> = checked_id(option_env!("BUZZ_DISTRIBUTION_ID"));
/// Whether automatic reads or migrations from official Buzz stores are forbidden.
pub const ISOLATED: bool = ID.is_some();
const PREFIX: &str = match ID {
    Some(id) => id,
    None => "xyz.block.buzz.desktop",
};

const fn checked_id(value: Option<&'static str>) -> Option<&'static str> {
    if let Some(id) = value {
        let bytes = id.as_bytes();
        assert!(
            bytes.len() >= 3 && bytes.len() <= 128,
            "Invalid distribution ID"
        );
        let mut index = 0;
        let mut dots = 0;
        let mut previous = b'.';
        while index < bytes.len() {
            let byte = bytes[index];
            assert!(
                byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-' || byte == b'.',
                "Invalid distribution ID"
            );
            if byte == b'.' {
                assert!(
                    previous != b'.' && previous != b'-',
                    "Invalid distribution ID"
                );
                dots += 1;
            }
            assert!(byte != b'-' || previous != b'.', "Invalid distribution ID");
            previous = byte;
            index += 1;
        }
        assert!(
            dots > 0 && previous != b'.' && previous != b'-',
            "Invalid distribution ID"
        );
        assert!(
            !reserved(id, "xyz.block.buzz") && !reserved(id, "dev.local.buzz"),
            "Distribution ID belongs to official Buzz"
        );
    }
    value
}
const fn reserved(id: &str, prefix: &str) -> bool {
    let bytes = id.as_bytes();
    let prefix = prefix.as_bytes();
    if bytes.len() < prefix.len() {
        return false;
    }
    let mut index = 0;
    while index < prefix.len() {
        if bytes[index] != prefix[index] {
            return false;
        }
        index += 1;
    }
    bytes.len() == index || bytes[index] == b'.'
}
const fn join<const N: usize>(a: &str, b: &str, c: &str) -> [u8; N] {
    let mut result = [0; N];
    let parts = [a.as_bytes(), b.as_bytes(), c.as_bytes()];
    let mut offset = 0;
    let mut part = 0;
    while part < parts.len() {
        let mut index = 0;
        while index < parts[part].len() {
            result[offset] = parts[part][index];
            offset += 1;
            index += 1;
        }
        part += 1;
    }
    result
}
macro_rules! text {
    ($a:expr, $b:expr, $c:expr) => {{
        const BYTES: [u8; $a.len() + $b.len() + $c.len()] = join($a, $b, $c);
        match std::str::from_utf8(&BYTES) {
            Ok(text) => text,
            Err(_) => panic!("Invalid distribution namespace"),
        }
    }};
}

/// Tauri application identifier for release or ordinary development storage.
pub const fn application_identifier(development: bool) -> &'static str {
    if development {
        text!(PREFIX, ".dev", "")
    } else {
        PREFIX
    }
}

/// The only scheme declared by an independent bundle; copied URLs stay canonical.
pub const INGRESS_SCHEME: Option<&str> = if ISOLATED {
    Some(text!("buzz-", PREFIX, ""))
} else {
    None
};

/// Current human credential service for a build mode.
pub const fn human_service(debug: bool) -> &'static str {
    if debug {
        text!(PREFIX, ".identity", ".debug")
    } else {
        text!(PREFIX, ".identity", "")
    }
}
/// Human marker and backup namespace, preserving official pre-1.0 ownership.
pub const fn human_store(debug: bool) -> &'static str {
    if ISOLATED {
        human_service(debug)
    } else if debug {
        "dev.local.buzz.foundation.identity.debug"
    } else {
        "dev.local.buzz.foundation.identity"
    }
}
/// Agent credentials remain shared between official builds, but never distributors.
pub const AGENT_SERVICE: &str = if ISOLATED && cfg!(debug_assertions) {
    text!(PREFIX, ".agents", ".debug")
} else {
    text!(PREFIX, ".agents", "")
};
/// The mode's federated session service, separate from immutable human keys.
pub const fn session_service(debug: bool) -> &'static str {
    if debug {
        text!(PREFIX, ".federated-session", ".debug")
    } else {
        text!(PREFIX, ".federated-session", "")
    }
}
/// The mode's user-provided Claude API key, separate from identity material.
pub const fn claude_service(debug: bool) -> &'static str {
    if debug {
        text!(PREFIX, ".claude-api-key", ".debug")
    } else {
        text!(PREFIX, ".claude-api-key", "")
    }
}
/// The mode's user-provided TypeSafe key, with its existing account and bytes.
pub const fn jev_service(debug: bool) -> &'static str {
    if debug {
        text!(PREFIX, ".jev-key", ".debug")
    } else {
        text!(PREFIX, ".jev-key", "")
    }
}
/// Home-relative directory for exact credential-entry locks.
pub const CREDENTIAL_LOCKS: &str = if ISOLATED {
    text!(".", PREFIX, "/credential-locks")
} else {
    ".buzz-foundation/credential-locks"
};
/// Home-relative directory for the agent bundle's non-secret epoch and lock.
pub const AGENT_LOCKS: &str = if ISOLATED && cfg!(debug_assertions) {
    text!(".", PREFIX, ".agent-credential-locks.debug")
} else if ISOLATED {
    text!(".", PREFIX, ".agent-credential-locks")
} else {
    ".buzz-foundation-credential-locks"
};
/// Instance lock for wipe/migration owners that share an agent namespace.
pub const INSTANCE_LOCK: &str = if ISOLATED {
    text!(".", PREFIX, ".instance.lock")
} else {
    ".dev.local.buzz.foundation.instance.lock"
};
/// Agent supervisor locks for this distributor, outside wiped application data.
pub const AGENT_OWNERSHIP: &str = if ISOLATED {
    text!(PREFIX, ".agent-ownership", "")
} else {
    "dev.local.buzz.agent-ownership"
};

/// Custom profiles accept only their exact session owners; official policy is unchanged.
pub fn session_service_allowed(service: &str) -> bool {
    if ISOLATED {
        service == session_service(cfg!(debug_assertions))
    } else {
        service.starts_with("xyz.block.buzz.desktop.federated-session")
    }
}
/// Custom native builds must agree with the Tauri bundle identifier before boot.
pub fn owns_identifier(identifier: &str) -> bool {
    match ID {
        Some(id) => identifier == id || identifier.strip_prefix(id) == Some(".dev"),
        None => reserved(identifier, "xyz.block.buzz") || reserved(identifier, "dev.local.buzz"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn distribution_id_rejects_paths_empty_labels_reserved_owners_and_invalid_ascii() {
        for id in [
            "",
            "../other",
            "example",
            "example..org",
            "-example.org",
            "example-.org",
            "Example.org",
            "example.org/child",
            "example.한국",
            "xyz.block.buzz",
            "xyz.block.buzz.desktop.dev",
            "dev.local.buzz.foundation",
        ] {
            assert!(
                std::panic::catch_unwind(|| checked_id(Some(id))).is_err(),
                "{id}"
            );
        }
        assert_eq!(
            checked_id(Some("org.example.buzz-beta")),
            Some("org.example.buzz-beta")
        );
    }
    #[test]
    fn distribution_session_guards_and_const_names_match_the_selected_owner() {
        if ISOLATED {
            assert!(session_service_allowed(session_service(cfg!(
                debug_assertions
            ))));
            assert!(!session_service_allowed(session_service(!cfg!(
                debug_assertions
            ))));
        } else {
            assert!(session_service_allowed(session_service(false)));
            assert!(session_service_allowed(session_service(true)));
        }
        assert!(!session_service_allowed(human_service(false)));
        if let Some(id) = ID {
            assert!(!session_service_allowed(
                "xyz.block.buzz.desktop.federated-session"
            ));
            assert!(!session_service_allowed(&format!(
                "{}.other",
                session_service(false)
            )));
            assert_eq!(
                AGENT_SERVICE,
                format!(
                    "{id}.agents{}",
                    if cfg!(debug_assertions) { ".debug" } else { "" }
                )
            );
            assert_eq!(CREDENTIAL_LOCKS, format!(".{id}/credential-locks"));
            assert!(owns_identifier(id));
            assert!(owns_identifier(&format!("{id}.dev")));
            assert!(!owns_identifier("xyz.block.buzz.desktop"));
            assert!(!owns_identifier(&format!("{id}.other")));
        } else {
            for id in [
                "xyz.block.buzz.desktop",
                "xyz.block.buzz.desktop.dev",
                "dev.local.buzz.foundation",
                "dev.local.buzz.foundation.thread-perf",
                "dev.local.buzz.foundation.nexus-test-012345abcdef",
                "dev.local.buzz.custom",
            ] {
                assert!(owns_identifier(id), "official owner: {id}");
            }
            for id in [
                "io.github.ondallio.buzz-korean-beta",
                "org.example.buzz-beta",
                "xyz.block.buzzx",
                "dev.local.buzz-other",
            ] {
                assert!(
                    !owns_identifier(id),
                    "missing distributor build input: {id}"
                );
            }
            assert_eq!(AGENT_SERVICE, "xyz.block.buzz.desktop.agents");
            assert_eq!(CREDENTIAL_LOCKS, ".buzz-foundation/credential-locks");
            assert_eq!(AGENT_LOCKS, ".buzz-foundation-credential-locks");
            assert_eq!(INSTANCE_LOCK, ".dev.local.buzz.foundation.instance.lock");
            assert_eq!(AGENT_OWNERSHIP, "dev.local.buzz.agent-ownership");
        }
    }
}
