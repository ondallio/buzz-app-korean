import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLanguage, type Language } from "../../shared/i18n/language";

export interface DesktopLanguageResult {
  language: Language;
  missingKeys: string[];
}
export interface DesktopLanguageSnapshot {
  language: Language | null;
  missingKeys: string[];
  pending: boolean;
  error: string | null;
}
/** Serializes native caption updates; failed choices require an explicit retry. */
export function createDesktopLanguageSync(
  send: (language: Language) => Promise<DesktopLanguageResult>,
) {
  let snapshot: DesktopLanguageSnapshot = {
    language: null,
    missingKeys: [],
    pending: false,
    error: null,
  };
  const listeners = new Set<() => void>();
  let desired: Language | null = null;
  let attempted: Language | null = null;
  let pending = false;
  const publish = (next: DesktopLanguageSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const pump = async () => {
    if (pending || desired === null || desired === attempted) return;
    const language = desired;
    attempted = language;
    pending = true;
    publish({ ...snapshot, pending: true, error: null });
    try {
      const result = await send(language);
      if (result.language !== language)
        throw new Error(
          "Native menu language did not match the requested language",
        );
      if (desired === language)
        publish({ ...result, pending: true, error: null });
    } catch (error) {
      if (desired === language)
        publish({
          ...snapshot,
          error: String(error instanceof Error ? error.message : error),
        });
    } finally {
      pending = false;
      if (desired !== language) void pump();
      else publish({ ...snapshot, pending: false });
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    request: (language: Language) => {
      desired = language;
      void pump();
    },
    retry: () => {
      if (!pending) {
        attempted = null;
        void pump();
      }
    },
  };
}
/** Root mounts this once; browser and non-macOS hosts do not own this menu. */
export function useDesktopLanguage(
  enabled = isTauri() && /Mac/.test(navigator.platform),
) {
  const language = useLanguage();
  const [sync] = useState(() =>
    createDesktopLanguageSync((language) =>
      invoke<DesktopLanguageResult>("set_desktop_language", { language }),
    ),
  );
  useEffect(() => {
    if (enabled) sync.request(language);
  }, [enabled, language, sync]);
  return {
    ...useSyncExternalStore(sync.subscribe, sync.getSnapshot, sync.getSnapshot),
    retry: sync.retry,
  };
}

const DesktopLanguageContext = createContext<ReturnType<
  typeof useDesktopLanguage
> | null>(null);
const unavailable = {
  language: null,
  missingKeys: [],
  pending: false,
  error: null,
  retry: () => {},
};
/** Owns the single native synchronizer; status consumers never create IPC requests. */
export function DesktopLanguageProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const status = useDesktopLanguage(enabled);
  return createElement(
    DesktopLanguageContext.Provider,
    { value: status },
    children,
  );
}
/** Shares the provider's retained status and explicit retry with Settings. */
export function useDesktopLanguageStatus() {
  return useContext(DesktopLanguageContext) ?? unavailable;
}
