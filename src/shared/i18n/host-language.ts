import { invoke, isTauri } from "@tauri-apps/api/core";
import { t } from "./index";
import { initializeSystemLanguage } from "./language";
import { languagePreference } from "./language";

function localizeLaunch(): void {
  document.documentElement.lang = languagePreference();
  document
    .getElementById("buzz-launch")
    ?.setAttribute("aria-label", t("app.opening"));
}

/** macOS preferred language can differ from WKWebView's default English locale. */
export async function initializeHostLanguage(): Promise<void> {
  localizeLaunch();
  if (!isTauri()) return;
  try {
    initializeSystemLanguage(await invoke<string | null>("system_language"));
  } catch {
    // Continue with the webview locale and expose the failed lookup in Settings.
    initializeSystemLanguage(null, true);
  } finally {
    localizeLaunch();
  }
}
