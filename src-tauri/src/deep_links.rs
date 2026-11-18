//! OS deep-link ingress. The shell holds raw URL strings in a small queue until the
//! webview drains them, so a link that launched the app is not lost. Every parse and
//! every authorization decision stays in TypeScript: a valid address is not
//! authorization, and the navigation target parser remains the single gate.
use serde::Serialize;
use std::borrow::Cow;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use tauri::{ipc::Channel, Manager};

/// All desktop builds use the same scheme as in-app links and Copy link.
const SCHEME: &str = "buzz";

/// A cold start can receive links before the webview exists. The newest are kept so
/// a late reader still sees the user's latest intent. The OS bounds each URL's size.
const MAX_PENDING: usize = 32;

/// Sent to the webview when the queue grows. It carries no URL; the webview drains.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub(crate) struct Pending {
    pending: usize,
}

#[derive(Default)]
struct Queue {
    urls: VecDeque<String>,
    watcher: Option<Channel<Pending>>,
}

#[derive(Clone, Default)]
pub(crate) struct DeepLinks(Arc<Mutex<Queue>>);

fn scheme(raw: &str) -> Option<&str> {
    raw.split_once(':').map(|(scheme, _)| scheme)
}

impl DeepLinks {
    /// Hold one OS-delivered URL for the webview.
    fn push(&self, raw: &str) -> Result<(), String> {
        let raw = match scheme(raw) {
            Some(SCHEME) => Cow::Borrowed(raw),
            Some(alias) if Some(alias) == buzz_credential_store::distribution::INGRESS_SCHEME => {
                Cow::Owned(format!("{SCHEME}{}", &raw[alias.len()..]))
            }
            _ => return Err("Not a buzz deep-link scheme".to_owned()),
        };
        let mut queue = self.0.lock().map_err(|_| "Deep link state unavailable")?;
        if queue.urls.len() >= MAX_PENDING {
            queue.urls.pop_front();
        }
        queue.urls.push_back(raw.into_owned());
        let pending = Pending {
            pending: queue.urls.len(),
        };
        if let Some(watcher) = &queue.watcher {
            // A stale channel from a reloaded webview drops the ping; the new page
            // drains on startup anyway.
            let _ = watcher.send(pending);
        }
        Ok(())
    }
    /// Everything held so far, oldest first. The queue is empty afterwards.
    fn drain(&self) -> Result<Vec<String>, String> {
        let mut queue = self.0.lock().map_err(|_| "Deep link state unavailable")?;
        Ok(queue.urls.drain(..).collect())
    }
    fn watch(&self, channel: Channel<Pending>) -> Result<(), String> {
        let mut queue = self.0.lock().map_err(|_| "Deep link state unavailable")?;
        queue.watcher = Some(channel);
        Ok(())
    }
}

/// Foreground Buzz on the main thread, as notification clicks already do.
pub(crate) fn focus_main<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let handle = app.clone();
    if let Err(error) = app.run_on_main_thread(move || {
        let Some(window) = handle.get_webview_window("main") else {
            return;
        };
        if let Err(error) = crate::notifications::focus(&window) {
            eprintln!("Could not focus Buzz for a deep link: {error}");
        }
    }) {
        eprintln!("Could not focus Buzz for a deep link: {error}");
    }
}

fn accept<R: tauri::Runtime>(app: &tauri::AppHandle<R>, raw: &str) {
    match app.state::<DeepLinks>().push(raw) {
        Ok(()) => focus_main(app),
        // The URL itself is not logged; it may carry a message locator.
        Err(error) => eprintln!(
            "Ignored an OS link with scheme {:?}: {error}",
            scheme(raw).unwrap_or_default()
        ),
    }
}

/// Subscribe to the plugin and pick up a launch URL it already parsed.
pub(crate) fn setup<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    use tauri_plugin_deep_link::DeepLinkExt;
    let handle = app.clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            accept(&handle, url.as_str());
        }
    });
    // The launch URL arrives before this listener exists: as argv on Windows and
    // Linux, and on macOS as an open event delivered before app setup runs. The
    // plugin keeps it either way.
    match app.deep_link().get_current() {
        Ok(Some(urls)) => {
            for url in urls {
                accept(app, url.as_str());
            }
        }
        Ok(None) => {}
        Err(error) => eprintln!("Could not read the launch deep link: {error}"),
    }
    // Official packaged/debug launches claim the canonical handler. Development
    // and independent distributors leave the existing OS preference alone.
    register_default_handler(tauri::is_dev(), || {
        #[cfg(any(windows, target_os = "linux"))]
        if let Err(error) = app.deep_link().register_all() {
            eprintln!("Could not register {SCHEME}:// for this binary: {error}");
        }
        // Launch Services otherwise picks among every bundle declaring the scheme.
        #[cfg(target_os = "macos")]
        if let Err(status) = claim_macos_default(&app.config().identifier) {
            eprintln!("Could not make this app the {SCHEME}:// handler: OSStatus {status}");
        }
    });
}

fn register_default_handler(development: bool, register: impl FnOnce()) {
    if !development && !buzz_credential_store::distribution::ISOLATED {
        register();
    }
}

#[cfg(target_os = "macos")]
fn claim_macos_default(bundle_id: &str) -> Result<(), i32> {
    use objc2_foundation::NSString;
    // NSString is toll-free bridged to CFStringRef.
    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn LSSetDefaultHandlerForURLScheme(scheme: *const NSString, bundle: *const NSString)
            -> i32;
    }
    let scheme = NSString::from_str(SCHEME);
    let bundle = NSString::from_str(bundle_id);
    match unsafe { LSSetDefaultHandlerForURLScheme(&*scheme, &*bundle) } {
        0 => Ok(()),
        status => Err(status),
    }
}

#[tauri::command]
pub(crate) fn deep_link_take<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    state: tauri::State<'_, DeepLinks>,
) -> Result<Vec<String>, String> {
    if window.label() != "main" {
        return Err("Deep links belong to the main window".into());
    }
    state.drain()
}

#[tauri::command]
pub(crate) fn deep_link_watch<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    state: tauri::State<'_, DeepLinks>,
    on_event: Channel<Pending>,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Deep links belong to the main window".into());
    }
    state.watch(on_event)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::ipc::InvokeResponseBody;

    #[test]
    fn distribution_registration_never_claims_another_apps_handler() {
        let calls = std::cell::Cell::new(0);
        register_default_handler(true, || calls.set(calls.get() + 1));
        assert_eq!(calls.get(), 0);
        register_default_handler(false, || calls.set(calls.get() + 1));
        assert_eq!(
            calls.get(),
            usize::from(option_env!("BUZZ_DISTRIBUTION_ID").is_none())
        );
    }

    #[test]
    fn distribution_alias_normalizes_only_its_scheme_and_preserves_duplicate_payloads() {
        let id = option_env!("BUZZ_DISTRIBUTION_ID").unwrap_or("org.example.buzz-beta");
        let alias = format!("buzz-{id}");
        let links = DeepLinks::default();
        for suffix in [
            "://message?channel=user%2Fvalue&id=abc&thread=%2523#fragment%20한글",
            "://join?relay=wss%3A%2F%2Frelay.example%2Fa&code=a%2Bb%3Dc&policy_receipt=%252F#raw",
        ] {
            let raw = format!("{alias}{suffix}");
            if option_env!("BUZZ_DISTRIBUTION_ID").is_some() {
                links.push(&raw).unwrap();
                links.push(&raw).unwrap();
                assert_eq!(
                    links.drain().unwrap(),
                    vec![format!("buzz{suffix}"), format!("buzz{suffix}")]
                );
            } else {
                assert!(links.push(&raw).is_err());
            }
        }
        for raw in [
            format!("other-{alias}://channel/general"),
            format!("{alias}x://channel/general"),
            format!("https://example.org/?next={alias}://channel/general"),
            format!("%62uzz-{id}://channel/general"),
            format!("BUZZ-{id}://channel/general"),
            format!(" {alias}://channel/general"),
        ] {
            assert!(links.push(&raw).is_err(), "{raw}");
        }
        assert!(links.drain().unwrap().is_empty());
    }

    fn channel_url(id: impl std::fmt::Display) -> String {
        format!("buzz://channel/{id}")
    }

    #[test]
    fn the_committed_config_declares_buzz_and_nothing_else() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(
            config["plugins"]["deep-link"]["desktop"]["schemes"],
            serde_json::json!([SCHEME])
        );
    }

    #[test]
    fn buzz_links_reach_the_webview_unchanged() {
        let links = DeepLinks::default();
        for raw in [
            channel_url("general"),
            format!("buzz://channel/general/{}", "a".repeat(64)),
            format!(
                "buzz://message?channel=general&id={}&thread={}",
                "a".repeat(64),
                "b".repeat(64)
            ),
            // The webview owns validation and failure notices beyond the scheme.
            "buzz://join?relay=wss%3A%2F%2Frelay.example&code=v2.invite&policy_receipt=proof"
                .to_owned(),
            "buzz://join?relay=example".to_owned(),
            "buzz:agent-activity?agent=x".to_owned(),
            "buzz:".to_owned(),
        ] {
            links.push(&raw).unwrap();
            assert_eq!(links.drain().unwrap(), vec![raw]);
        }
    }

    #[test]
    fn only_the_exact_buzz_scheme_is_accepted() {
        let links = DeepLinks::default();
        for raw in [
            "BUZZ://channel/general",
            "Buzz://channel/general",
            "http://example.com",
            "https://example.com/?next=buzz://channel/general",
            "buzz",
            "",
            " buzz://channel/general",
            "javascript:alert(1)",
            "xbuzz://channel/general",
            "buzzx://channel/general",
            "buzz-app://channel/general",
            "buzz-dev-3fa9c1://channel/general",
        ] {
            assert!(links.push(raw).is_err(), "{raw}");
        }
        assert!(links.drain().unwrap().is_empty());
    }

    #[test]
    fn held_links_drain_oldest_first_and_only_once() {
        let links = DeepLinks::default();
        for id in ["a", "b", "c"] {
            links.push(&channel_url(id)).unwrap();
        }
        assert_eq!(
            links.drain().unwrap(),
            vec![channel_url("a"), channel_url("b"), channel_url("c")]
        );
        assert_eq!(links.drain().unwrap(), Vec::<String>::new());
    }

    #[test]
    fn the_bound_keeps_the_newest_links() {
        let links = DeepLinks::default();
        for index in 0..MAX_PENDING + 2 {
            links.push(&channel_url(index)).unwrap();
        }
        let held = links.drain().unwrap();
        assert_eq!(held.len(), MAX_PENDING);
        assert_eq!(held.first().cloned(), Some(channel_url(2)));
        assert_eq!(held.last().cloned(), Some(channel_url(MAX_PENDING + 1)));
    }

    #[test]
    fn a_watcher_learns_the_queue_depth_without_receiving_urls() {
        let links = DeepLinks::default();
        let seen = Arc::new(Mutex::new(Vec::new()));
        let output = seen.clone();
        links
            .watch(Channel::new(move |body| {
                if let InvokeResponseBody::Json(json) = body {
                    output.lock().unwrap().push(json);
                }
                Ok(())
            }))
            .unwrap();
        links.push(&channel_url("a")).unwrap();
        links.push(&channel_url("b")).unwrap();
        assert!(links.push("http://example.com").is_err());
        assert_eq!(
            *seen.lock().unwrap(),
            vec![r#"{"pending":1}"#.to_owned(), r#"{"pending":2}"#.to_owned()]
        );
        assert_eq!(links.drain().unwrap().len(), 2);
    }
}
