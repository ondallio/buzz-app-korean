import { t, useLanguage } from "../shared/i18n";
import {
  localMessage,
  localError,
  errorMessage,
  resolveMessage,
  type DisplayMessage,
} from "../shared/i18n/deferred-message";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Communities } from "../features/communities/service";
import {
  DEFAULT_REPOSITORIES_FOLDER,
  readRepositoriesFolder,
  repositoriesKey,
  saveRepositoriesFolder,
} from "../features/communities/repositories";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Field } from "../shared/design-system/ui/Field";
import { Input } from "../shared/design-system/ui/Input";
import { Button } from "../shared/design-system/ui/Button";

export function CommunityRepositoriesSettings({
  communities,
  community,
  viewer,
}: {
  communities: Communities;
  community: string;
  viewer: string | undefined;
}) {
  useLanguage();
  const read = useCallback(() => {
    try {
      return {
        value: viewer ? readRepositoriesFolder(community, viewer) : "",
        error: "",
      };
    } catch {
      return {
        value: "",
        error: localMessage("settingsHost.repositoriesReadFailed"),
      };
    }
  }, [community, viewer]);
  const [stored, setStored] = useState(read);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<DisplayMessage>(stored.error);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  const browse = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const desktop = isTauri();
  const restoreFocus = useRef<{
    from: Element | null;
    to: HTMLElement | null;
  } | null>(null);
  useLayoutEffect(() => {
    if (busy) return;
    const pending = restoreFocus.current;
    restoreFocus.current = null;
    if (pending && document.activeElement === pending.from) pending.to?.focus();
  });
  useEffect(() => {
    alive.current = true;
    const sync = (event: StorageEvent) => {
      if (
        viewer &&
        event.storageArea === localStorage &&
        (event.key === null || event.key === repositoriesKey(community, viewer))
      ) {
        const next = read();
        setStored(next);
        setError(next.error);
        setSaved(false);
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      alive.current = false;
      window.removeEventListener("storage", sync);
    };
  }, [community, viewer, read]);
  const current = () => {
    const snapshot = communities.snapshot();
    if (
      !alive.current ||
      !viewer ||
      snapshot.viewer !== viewer ||
      !snapshot.memberships.some((entry) => entry.id === community)
    )
      throw localError("settingsHost.repositoriesAccountChanged");
    return viewer;
  };
  const save = async (path: string) => {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      current();
      if (!desktop) throw localError("settingsHost.repositoriesDesktopOnly");
      const validated = path.trim()
        ? await invoke<string>("repositories_folder_validate", { path })
        : "";
      const account = current();
      const value = saveRepositoriesFolder(community, account, validated);
      setStored({ value, error: "" });
      setDraft(null);
      setSaved(true);
    } catch (reason) {
      if (alive.current) setError(errorMessage(reason));
    } finally {
      if (alive.current) {
        // Hand off before settlement can natively disable the focused action.
        // Navigation outside this form must keep its focus.
        if (input.current?.form?.contains(document.activeElement))
          input.current.focus();
        setBusy(false);
      }
    }
  };
  const pick = async () => {
    if (busy) return;
    const focused = document.activeElement;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      current();
      const path = await invoke<string | null>("workspace_pick_folder", {
        title: t("settingsHost.chooseFolderTitle"),
        start: (draft ?? stored.value) || DEFAULT_REPOSITORIES_FOLDER,
      });
      current();
      if (path) setDraft(path);
    } catch (reason) {
      if (alive.current) setError(errorMessage(reason));
    } finally {
      if (alive.current) {
        restoreFocus.current = { from: focused, to: browse.current };
        setBusy(false);
      }
    }
  };
  const value = draft ?? stored.value;
  return (
    <div className="mt-section-gap">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim() !== stored.value) void save(value);
        }}
      >
        <SettingsGroup layout="form">
          <Field
            label={t("settingsHost.repositoriesFolder")}
            error={resolveMessage(error) || undefined}
            description={
              desktop
                ? t("settingsHost.repositoriesDescription")
                : t("settingsHost.repositoriesBrowserDescription")
            }
          >
            <Input
              ref={input}
              value={value}
              readOnly={!desktop || busy}
              placeholder={t("settingsHost.repositoriesPlaceholder")}
              maxLength={2048}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onValueChange={(path) => {
                setDraft(path);
                setError("");
                setSaved(false);
              }}
            />
          </Field>
          {desktop && (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                ref={browse}
                type="button"
                disabled={busy}
                focusableWhenDisabled={busy}
                onClick={() => void pick()}
              >
                {t("settingsHost.chooseFolder")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                focusableWhenDisabled={busy}
                disabled={busy || (!stored.value && !draft)}
                onClick={() => void save("")}
              >
                {t("settingsHost.restoreDefault")}
              </Button>
              <Button
                type="button"
                focusableWhenDisabled={busy}
                disabled={busy || draft === null}
                onClick={() => {
                  setDraft(null);
                  setError("");
                  setSaved(false);
                  input.current?.focus();
                }}
              >
                {t("settingsHost.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={busy}
                focusableWhenDisabled={busy}
                disabled={busy || value.trim() === stored.value}
              >
                {t("settingsHost.saveFolder")}
              </Button>
            </div>
          )}
          {saved && (
            <p role="status" className="m-0 text-body-sm text-muted">
              {t("settingsHost.repositoriesSaved")}
            </p>
          )}
        </SettingsGroup>
      </form>
    </div>
  );
}
