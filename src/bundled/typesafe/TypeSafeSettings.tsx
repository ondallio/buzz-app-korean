import { useState, useSyncExternalStore } from "react";
import { t, useLanguage, type TranslationKey } from "../../shared/i18n";
import { isApplePlatform } from "../../features/shortcuts/format";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import type { KeyState, TypeSafeKey } from "./key";

const KEY_STATUS = {
  checking: "typesafeSettings.checking",
  saved: "typesafeSettings.saved",
  missing: "typesafeSettings.missing",
  unreadable: "typesafeSettings.unreadable",
  refused: "typesafeSettings.refused",
} as const satisfies Record<KeyState, TranslationKey>;

/** Sets or removes the TypeSafe key. The key goes straight to native storage
 * and is never shown again. */
export function TypeSafeSettings({
  typesafe,
  active,
  apple = isApplePlatform(navigator.platform),
}: {
  typesafe: Pick<
    TypeSafeKey,
    "snapshot" | "subscribe" | "save" | "clear" | "desktop"
  >;
  active(): boolean;
  /** Whether the key goes to the macOS Keychain, which only Buzz can read. */
  apple?: boolean;
}) {
  useLanguage();
  const keyState = useSyncExternalStore(
    typesafe.subscribe,
    typesafe.snapshot,
    typesafe.snapshot,
  );
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A key may be saved in each state but these two.
  const saved = keyState !== "missing" && keyState !== "checking";
  const run = async (action: () => Promise<void>) => {
    if (!active() || busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setKey("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  if (!typesafe.desktop())
    return (
      <p role="status" className="m-0 text-body-sm text-secondary">
        {t("typesafeSettings.desktop")}
      </p>
    );
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <p role="status" className="m-0 text-body-sm text-secondary">
        {t(KEY_STATUS[keyState])}
      </p>
      {!apple && (
        <p className="m-0 text-body-sm text-secondary">
          {t("typesafeSettings.otherPrograms")}
        </p>
      )}
      <form
        className="flex w-full flex-col items-start gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const value = key.trim();
          if (value) void run(() => typesafe.save(value));
        }}
      >
        <Field label={t("typesafeSettings.apiKey")}>
          <Input
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            disabled={busy}
            value={key}
            placeholder={
              saved
                ? t("typesafeSettings.unchanged")
                : t("typesafeSettings.paste")
            }
            onChange={(event) => setKey(event.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="prominent"
            disabled={busy || !key.trim()}
          >
            {saved ? t("typesafeSettings.replace") : t("typesafeSettings.save")}
          </Button>
          {saved && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => typesafe.clear())}
            >
              {t("typesafeSettings.remove")}
            </Button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="m-0 text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
