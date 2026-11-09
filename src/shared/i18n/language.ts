import { useSyncExternalStore } from "react";

export type Language = "en" | "ko";
export const localeStorageKey = "buzz-korean-beta.language.v1";
const changeEvent = "buzz-korean-beta-language-changed";
let unsaved: Language | undefined;
let nativeLanguage: Language | undefined;
let systemUnavailable = false;

/** The device's first language, without treating secondary languages as a default. */
export function systemLanguage(): Language {
  if (nativeLanguage) return nativeLanguage;
  const locale = typeof navigator === "undefined" ? "en" : navigator.language;
  return /^ko(?:-|$)/i.test(locale) ? "ko" : "en";
}

/** Captures the host's preferred language before mounting. Saved choices still win. */
export function initializeSystemLanguage(
  locale: string | null,
  failed = false,
): void {
  nativeLanguage = locale
    ? /^ko(?:-|$)/i.test(locale)
      ? "ko"
      : "en"
    : undefined;
  systemUnavailable = failed;
}

/** Exposes a failed OS lookup until the user has chosen a saved language. */
export function systemLanguageProblem(): boolean {
  if (!systemUnavailable) return false;
  try {
    const saved = localStorage.getItem(localeStorageKey);
    return saved !== "en" && saved !== "ko";
  } catch {
    return true;
  }
}

/** A saved language wins over the OS default. Invalid storage is ignored. */
export function languagePreference(): Language {
  if (unsaved !== undefined) return unsaved;
  try {
    const value = localStorage.getItem(localeStorageKey);
    if (value === "en" || value === "ko") return value;
  } catch {
    // Reading the preference is optional; the OS default remains available.
  }
  return systemLanguage();
}

/** True while the active language still needs an explicit save retry. */
export const languageSaveProblem = () => unsaved !== undefined;

function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== localeStorageKey && event.key !== null) return;
    unsaved = undefined;
    listener();
  };
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("storage", storage);
  };
}

/** Applies one atomic device preference; a failed persist remains retryable. */
export function setLanguage(language: Language): void {
  if (language !== "en" && language !== "ko")
    throw new Error(`Unsupported Buzz language: ${language}`);
  unsaved = language;
  try {
    localStorage.setItem(localeStorageKey, language);
    unsaved = undefined;
  } catch {
    // Keep the active choice and expose the failure even after Settings remounts.
  }
  window.dispatchEvent(new Event(changeEvent));
}

/** Subscribes a mounted consumer without replacing its state, inputs or services. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, languagePreference, () => "en");
}

/** The language and independent save state for the Settings control. */
export function useLanguagePreference() {
  return {
    language: useLanguage(),
    unsaved: useSyncExternalStore(subscribe, languageSaveProblem, () => false),
    systemUnavailable: useSyncExternalStore(
      subscribe,
      systemLanguageProblem,
      () => false,
    ),
  };
}

/** Locale controls formatting only. Intl continues to use the device's time zone. */
export function formattingLocale(language = languagePreference()): string {
  return language === "ko" ? "ko-KR" : "en-US";
}
