//! Caption-only localization. Menu identities, native actions and accelerators stay intact.
use serde::{
    de::{MapAccess, Visitor},
    Deserialize, Deserializer, Serialize,
};
use std::{collections::BTreeMap, fmt};
use tauri::{
    menu::{Menu, MenuItemKind},
    AppHandle, Manager, Runtime,
};

const TOP: &[&str] = &["File", "Edit", "View", "Window", "Help"];
const PREDEFINED: &[&str] = &[
    "Undo",
    "Redo",
    "Cut",
    "Copy",
    "Paste",
    "Select All",
    "Minimize",
    "Zoom",
    "Toggle Full Screen",
    "Services",
    "Hide Others",
    "Show All",
    "About",
    "Hide",
    "Quit",
];
const NAMED: &[&str] = &["About {app}", "Hide {app}", "Quit {app}"];
const CUSTOM: &[(&str, &str)] = &[
    ("buzz-close", "Close"),
    ("buzz-close-all", "Close All Tabs"),
    ("buzz-settings", "Settings…"),
    ("buzz-next-tab", "Show Next Tab"),
    ("buzz-previous-tab", "Show Previous Tab"),
    ("buzz-paste-plain", "Paste and Match Style"),
];

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Language {
    En,
    Ko,
}
impl Language {
    fn initial(locale: Option<&str>) -> Self {
        if locale.is_some_and(|s| {
            s.eq_ignore_ascii_case("ko")
                || s.get(..3).is_some_and(|s| s.eq_ignore_ascii_case("ko-"))
        }) {
            Self::Ko
        } else {
            Self::En
        }
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Status {
    language: Language,
    missing_keys: Vec<String>,
}

// serde_json::Value and ordinary maps silently overwrite duplicate JSON keys.
#[derive(Debug)]
struct UniqueMap(BTreeMap<String, String>);
impl<'de> Deserialize<'de> for UniqueMap {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct UniqueVisitor;
        impl<'de> Visitor<'de> for UniqueVisitor {
            type Value = UniqueMap;
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("unique translation keys")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut values = BTreeMap::new();
                while let Some((key, value)) = map.next_entry::<String, String>()? {
                    if values.insert(key, value).is_some() {
                        return Err(serde::de::Error::custom("duplicate menu translation key"));
                    }
                }
                Ok(UniqueMap(values))
            }
        }
        deserializer.deserialize_map(UniqueVisitor)
    }
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Catalog {
    en: UniqueMap,
    ko: UniqueMap,
}
fn variables(value: &str) -> Result<usize, String> {
    let count = value.matches("{app}").count();
    if value.replace("{app}", "").contains(['{', '}']) {
        return Err("Unknown menu template variable".into());
    }
    Ok(count)
}
impl Catalog {
    fn parse(json: &str) -> Result<Self, String> {
        let catalog: Self = serde_json::from_str(json).map_err(|error| error.to_string())?;
        let required = TOP
            .iter()
            .chain(PREDEFINED)
            .chain(NAMED)
            .copied()
            .chain(CUSTOM.iter().map(|(_, key)| *key));
        for key in required {
            if catalog.en.0.get(key).map(String::as_str) != Some(key) {
                return Err(format!("Invalid English menu template: {key}"));
            }
        }
        if catalog.en.0.len() != TOP.len() + PREDEFINED.len() + NAMED.len() + CUSTOM.len() {
            return Err("Unknown English menu key".into());
        }
        for (key, english) in &catalog.en.0 {
            if key != english || english.trim().is_empty() {
                return Err("Invalid English menu template".into());
            }
            let expected = variables(english)?;
            if let Some(korean) = catalog.ko.0.get(key) {
                if korean.trim().is_empty() || variables(korean)? != expected {
                    return Err(format!("Invalid Korean menu template: {key}"));
                }
            }
        }
        if catalog
            .ko
            .0
            .keys()
            .any(|key| !catalog.en.0.contains_key(key))
        {
            return Err("Unknown Korean menu key".into());
        }
        Ok(catalog)
    }
    fn caption(&self, source: &Source, language: Language) -> (String, bool) {
        if language == Language::En {
            return (source.original.clone(), false);
        }
        match self.ko.0.get(&source.key) {
            Some(template) => (template.replace("{app}", &source.app), false),
            None => (source.original.clone(), true),
        }
    }
}
#[derive(Debug)]
struct Source {
    original: String,
    key: String,
    app: String,
}
impl Source {
    fn capture(original: String, kind: &str, id: &str, app_menu: bool) -> Option<Self> {
        let key = match kind {
            "submenu" if TOP.contains(&original.as_str()) => original.clone(),
            "custom" => CUSTOM
                .iter()
                .find(|(expected_id, expected)| *expected_id == id && *expected == original)
                .map(|(_, key)| key.to_string())?,
            "predefined" if PREDEFINED.contains(&original.as_str()) => original.clone(),
            "predefined" if app_menu => {
                let (key, app) = NAMED.iter().find_map(|key| {
                    original
                        .strip_prefix(key.strip_suffix("{app}")?)
                        .filter(|app| !app.is_empty())
                        .map(|app| (*key, app.to_string()))
                })?;
                return Some(Self {
                    original,
                    key: key.into(),
                    app,
                });
            }
            _ => return None,
        };
        Some(Self {
            original,
            key,
            app: String::new(),
        })
    }
}
struct Caption<R: Runtime> {
    item: MenuItemKind<R>,
    source: Source,
}
struct MenuLanguage<R: Runtime> {
    captions: Vec<Caption<R>>,
    catalog: Catalog,
}
fn apply_captions<T>(
    captions: &[T],
    catalog: &Catalog,
    language: Language,
    source: impl Fn(&T) -> &Source,
    mut set: impl FnMut(&T, &str) -> Result<(), String>,
) -> Result<Status, String> {
    let mut missing_keys = Vec::new();
    for caption in captions {
        let source = source(caption);
        let (text, missing) = catalog.caption(source, language);
        // Muda uses && for a literal ampersand; text() returns visible native text.
        set(caption, &text.replace('&', "&&"))?;
        if missing && missing_keys.len() < 32 && !missing_keys.contains(&source.key) {
            missing_keys.push(source.key.clone());
        }
    }
    Ok(Status {
        language,
        missing_keys,
    })
}
impl<R: Runtime> MenuLanguage<R> {
    fn apply(&self, language: Language) -> Result<Status, String> {
        apply_captions(
            &self.captions,
            &self.catalog,
            language,
            |caption| &caption.source,
            |caption, text| {
                match &caption.item {
                    MenuItemKind::MenuItem(item) => item.set_text(text),
                    MenuItemKind::Submenu(item) => item.set_text(text),
                    MenuItemKind::Predefined(item) => item.set_text(text),
                    _ => return Ok(()),
                }
                .map_err(|error| error.to_string())
            },
        )
    }
}

fn capture<R: Runtime>(
    item: MenuItemKind<R>,
    app_menu: bool,
    captions: &mut Vec<Caption<R>>,
) -> tauri::Result<()> {
    let (text, kind) = match &item {
        MenuItemKind::MenuItem(item) => (item.text()?, "custom"),
        MenuItemKind::Submenu(item) => (item.text()?, "submenu"),
        MenuItemKind::Predefined(item) => (item.text()?, "predefined"),
        _ => return Ok(()),
    };
    if let Some(source) = Source::capture(text, kind, item.id().as_ref(), app_menu) {
        captions.push(Caption { item, source });
    }
    Ok(())
}
/// Captures the completed English menu once, after Close/Paste replacements.
pub(crate) fn install<R: Runtime>(app: &AppHandle<R>, menu: &Menu<R>) -> tauri::Result<()> {
    let mut captions = Vec::new();
    for (index, item) in menu.items()?.into_iter().enumerate() {
        if let Some(submenu) = item.as_submenu() {
            // Do not descend into native Services or dynamic OS-owned children.
            for child in submenu.items()? {
                capture(child, index == 0, &mut captions)?;
            }
        }
        if index != 0 {
            capture(item, false, &mut captions)?;
        }
    }
    let catalog = Catalog::parse(include_str!("../resources/localization/menus.json"))
        .map_err(std::io::Error::other)?;
    let state = MenuLanguage { captions, catalog };
    let status = state
        .apply(Language::initial(
            crate::system_clock::system_language().as_deref(),
        ))
        .map_err(std::io::Error::other)?;
    if !status.missing_keys.is_empty() {
        eprintln!(
            "Missing Korean menu translations: {:?}",
            status.missing_keys
        );
    }
    if !app.manage(state) {
        return Err(std::io::Error::other("Native menu language already initialized").into());
    }
    Ok(())
}
/// Updates existing captions on the main thread; the device preference stays in JS storage.
#[tauri::command]
pub(crate) async fn set_desktop_language<R: Runtime>(
    app: AppHandle<R>,
    language: Language,
) -> Result<Status, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let result = handle
            .try_state::<MenuLanguage<R>>()
            .ok_or_else(|| "Native menu language unavailable".to_string())
            .and_then(|state| state.apply(language));
        let _ = send.send(result);
    })
    .map_err(|error| error.to_string())?;
    receive
        .await
        .map_err(|_| "Native menu language callback unavailable".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    const JSON: &str = include_str!("../resources/localization/menus.json");
    fn catalog() -> Catalog {
        Catalog::parse(JSON).unwrap()
    }
    fn source(text: &str, kind: &str, id: &str, app: bool) -> Source {
        Source::capture(text.into(), kind, id, app).unwrap()
    }
    #[test]
    fn catalog_is_complete_and_named_templates_preserve_literal_app_names() {
        let catalog = catalog();
        assert_eq!(catalog.en.0.len(), catalog.ko.0.len());
        for key in catalog.en.0.keys() {
            assert!(catalog.ko.0.contains_key(key));
        }
        let source = source("About R&D {draft} 한글", "predefined", "native-id", true);
        assert_eq!(
            catalog.caption(&source, Language::Ko),
            ("R&D {draft} 한글 정보".into(), false)
        );
        assert_eq!(
            catalog.caption(&source, Language::En),
            ("About R&D {draft} 한글".into(), false)
        );
        for (caption, korean) in [("Hide Buzz", "Buzz 가리기"), ("Quit Buzz", "Buzz 종료")] {
            assert_eq!(
                catalog
                    .caption(
                        &self::source(caption, "predefined", "native-id", true),
                        Language::Ko
                    )
                    .0,
                korean
            );
        }
    }
    #[test]
    fn catalog_rejects_duplicate_keys_empty_korean_and_variable_drift() {
        for bad in [
            JSON.replacen(
                "\"File\": \"파일\"",
                "\"File\": \"파일\", \"File\": \"중복\"",
                1,
            ),
            JSON.replacen("\"File\": \"파일\"", "\"File\": \"\"", 1),
            JSON.replace("{app} 정보", "정보"),
            JSON.replace("{app} 정보", "{name} 정보"),
            JSON.replace("{app} 정보", "{app} {app} 정보"),
            JSON.replacen("\"en\": {", "\"en\": {}, \"en\": {", 1),
        ] {
            assert!(
                Catalog::parse(&bad).is_err(),
                "accepted invalid catalog: {bad}"
            );
        }
    }
    #[test]
    fn os_first_language_and_ipc_language_are_strict() {
        for locale in [Some("ko"), Some("ko-KR"), Some("KO-kr")] {
            assert_eq!(Language::initial(locale), Language::Ko);
        }
        for locale in [
            None,
            Some("en-KR"),
            Some("kok"),
            Some("en,ko"),
            Some("ko_KR"),
        ] {
            assert_eq!(Language::initial(locale), Language::En);
        }
        assert_eq!(
            serde_json::from_str::<Language>("\"en\"").unwrap(),
            Language::En
        );
        for invalid in ["\"ko-KR\"", "\"KO\"", "\"ja\"", "null", "0"] {
            assert!(serde_json::from_str::<Language>(invalid).is_err());
        }
    }
    #[test]
    fn only_known_original_captions_and_exact_custom_ids_are_captured() {
        assert!(Source::capture("Close".into(), "custom", "vendor-close", false).is_none());
        assert!(Source::capture("User Close".into(), "custom", "buzz-close", false).is_none());
        assert!(Source::capture("User Service".into(), "predefined", "os-service", true).is_none());
        assert!(Source::capture("About Buzz".into(), "predefined", "native-id", false).is_none());
        assert!(Source::capture("File".into(), "custom", "vendor", false).is_none());
        assert_eq!(
            source("Hide Others", "predefined", "native-id", true).key,
            "Hide Others"
        );
        for (id, text) in CUSTOM {
            assert_eq!(source(text, "custom", id, false).key, *text);
        }
        for text in TOP {
            assert_eq!(source(text, "submenu", "native-id", false).key, *text);
        }
        for text in PREDEFINED {
            assert_eq!(source(text, "predefined", "native-id", true).key, *text);
        }
    }
    #[test]
    fn actual_apply_policy_updates_existing_targets_roundtrip_and_escapes_ampersands() {
        let targets = [
            source("About R&D", "predefined", "native-id", true),
            source("Close", "custom", "buzz-close", false),
        ];
        let writes = RefCell::new(Vec::new());
        for language in [Language::En, Language::Ko, Language::En] {
            let status = apply_captions(
                &targets,
                &catalog(),
                language,
                |source| source,
                |target, text| {
                    writes
                        .borrow_mut()
                        .push((target.original.clone(), text.to_string()));
                    Ok(())
                },
            )
            .unwrap();
            assert!(status.missing_keys.is_empty());
        }
        assert_eq!(
            *writes.borrow(),
            [
                ("About R&D".into(), "About R&&D".into()),
                ("Close".into(), "Close".into()),
                ("About R&D".into(), "R&&D 정보".into()),
                ("Close".into(), "닫기".into()),
                ("About R&D".into(), "About R&&D".into()),
                ("Close".into(), "Close".into())
            ]
        );
    }
    #[test]
    fn missing_korean_reports_bounded_distinct_keys_and_keeps_original_english() {
        let mut catalog = catalog();
        catalog.ko.0.remove("File");
        let targets = [
            source("File", "submenu", "file", false),
            source("File", "submenu", "file2", false),
        ];
        let mut writes = Vec::new();
        let status = apply_captions(
            &targets,
            &catalog,
            Language::Ko,
            |source| source,
            |_, text| {
                writes.push(text.to_string());
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(status.missing_keys, ["File"]);
        assert_eq!(writes, ["File", "File"]);
        assert!(status.missing_keys.len() <= 32);
    }
    #[test]
    fn missing_key_report_is_capped_and_ipc_schema_stays_exact() {
        let targets = (0..40)
            .map(|n| Source {
                original: format!("Unknown {n}"),
                key: format!("Missing {n}"),
                app: String::new(),
            })
            .collect::<Vec<_>>();
        let status = apply_captions(
            &targets,
            &catalog(),
            Language::Ko,
            |source| source,
            |_, _| Ok(()),
        )
        .unwrap();
        assert_eq!(status.missing_keys.len(), 32);
        assert_eq!(status.missing_keys[0], "Missing 0");
        assert_eq!(status.missing_keys[31], "Missing 31");
        assert_eq!(
            serde_json::to_value(Status {
                language: Language::Ko,
                missing_keys: vec!["File".into()]
            })
            .unwrap(),
            serde_json::json!({"language":"ko", "missingKeys":["File"]})
        );
    }
    #[test]
    fn caption_set_failure_propagates_and_retry_reapplies_from_original_sources() {
        let targets = [
            source("Close", "custom", "buzz-close", false),
            source("Copy", "predefined", "copy", false),
        ];
        let mut calls = 0;
        let result = apply_captions(
            &targets,
            &catalog(),
            Language::Ko,
            |source| source,
            |_, _| {
                calls += 1;
                Err("set_text failed".into())
            },
        );
        assert_eq!(result.unwrap_err(), "set_text failed");
        assert_eq!(calls, 1);
        let mut retry = Vec::new();
        apply_captions(
            &targets,
            &catalog(),
            Language::Ko,
            |source| source,
            |_, text| {
                retry.push(text.to_string());
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(retry, ["닫기", "복사"]);
    }
}
