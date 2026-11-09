import { useRef, useSyncExternalStore } from "react";
import { t, useLanguage } from "../../shared/i18n";
import { Header, InlineHeader } from "../../shared/design-system/ui/Header";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { Button } from "../../shared/design-system/ui/Button";
import { SwitchPreferenceRow } from "../../shared/design-system/ui/SwitchPreferenceRow";
import { ToastNotice } from "../../shared/design-system/ui/Toast";
import { isApplePlatform } from "../../features/shortcuts/format";
import { useFontAvailability } from "./font-availability";
import {
  parseFontFamily,
  parseFontSize,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  type TerminalFontPreference,
} from "./font-preference";
import { optionMetaPreference } from "./option-meta-preference";

/** Unsaved form state belongs to the plugin, across Settings card mounts. */
export function createTerminalSettingsDraft() {
  let state = {
    family: null as string | null,
    size: null as string | null,
    blurredValue: null as string | null,
  };
  const listeners = new Set<() => void>();
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(next: Partial<typeof state>) {
      state = { ...state, ...next };
      for (const listener of listeners) listener();
    },
  };
}

export function TerminalSettings({
  font,
  drafts,
  active,
}: {
  font: TerminalFontPreference;
  drafts: ReturnType<typeof createTerminalSettingsDraft>;
  active(): boolean;
}) {
  useLanguage();
  const { family, size, error } = useSyncExternalStore(
    font.subscribe,
    font.snapshot,
  );
  const {
    family: draft,
    size: sizeDraft,
    blurredValue,
  } = useSyncExternalStore(drafts.subscribe, drafts.snapshot);
  const familyInput = useRef<HTMLInputElement>(null);
  const value = draft ?? family ?? "";
  const parsed = parseFontFamily(value);
  const invalid = draft !== null && parsed === null;
  const availability = useFontAvailability(parsed);
  const savedAvailability = useFontAvailability(
    family === parsed ? null : family,
  );
  const savedStatus =
    family === parsed ? availability.status : savedAvailability.status;
  const unavailable =
    availability.status === "unavailable" &&
    (draft === null || blurredValue === value);
  const canApply =
    !invalid && (parsed === family || availability.status === "available");
  const sizeValue = sizeDraft ?? String(size);
  const parsedSize = parseFontSize(Number(sizeValue));
  const sizeInvalid = parsedSize === null;
  return (
    <section aria-labelledby="terminal-settings-title">
      <Header
        id="terminal-settings-title"
        title={t("terminalSettings.title")}
        subtitle={t("terminalSettings.subtitle")}
      />
      <InlineHeader title={t("terminalSettings.font")} />
      <SettingsGroup layout="form">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            drafts.update({ blurredValue: value });
            if (!canApply || parsedSize === null) return;
            font.set(parsed, parsedSize);
            drafts.update({ family: null, size: null, blurredValue: null });
          }}
        >
          <div className="flex flex-col gap-4">
            <Field
              label={t("terminalSettings.family")}
              description={t("terminalSettings.familyHelp")}
              error={
                invalid
                  ? t("terminalSettings.familyInvalid")
                  : unavailable
                    ? t("terminalSettings.unavailable", {
                        font: String(parsed),
                      })
                    : undefined
              }
            >
              <Input
                ref={familyInput}
                value={value}
                onValueChange={(next) => {
                  drafts.update({ family: next, blurredValue: null });
                }}
                onBlur={() => drafts.update({ blurredValue: value })}
                aria-busy={availability.status === "checking"}
                placeholder="JetBrains Mono"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </Field>
            {unavailable && (
              <Button
                type="button"
                size="sm"
                variant="subtle"
                onClick={() => {
                  familyInput.current?.focus();
                  availability.retry();
                }}
              >
                {t("terminalSettings.retryCheck")}
              </Button>
            )}
            {family && savedStatus === "unavailable" && (
              <p role="status" className="text-body-sm text-subtle">
                {t("terminalSettings.savedUnavailable", { font: family })}
              </p>
            )}
            <Field
              label={t("terminalSettings.size")}
              description={t("terminalSettings.sizeHelp", {
                size: DEFAULT_FONT_SIZE,
              })}
              error={
                sizeInvalid
                  ? t("terminalSettings.sizeInvalid", {
                      min: MIN_FONT_SIZE,
                      max: MAX_FONT_SIZE,
                    })
                  : undefined
              }
            >
              <Input
                type="number"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                step="any"
                value={sizeValue}
                onValueChange={(next) => drafts.update({ size: next })}
              />
            </Field>
          </div>
          <p
            className="mt-4 text-mono"
            style={{
              fontSize: `${parsedSize ?? DEFAULT_FONT_SIZE}px`,
              letterSpacing: 0,
              fontFamily: parsed
                ? `"${parsed}", var(--font-system-mono)`
                : "var(--font-system-mono)",
            }}
          >
            {t("terminalSettings.preview", { sample: "ABC 0123" })}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              variant="subtle"
              onClick={() => {
                font.reset();
                drafts.update({ family: null, size: null, blurredValue: null });
              }}
            >
              {t("terminalSettings.default")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                !canApply ||
                sizeInvalid ||
                (parsed === family && parsedSize === size)
              }
            >
              {t("terminalSettings.apply")}
            </Button>
          </div>
        </form>
      </SettingsGroup>
      {/* Only macOS keyboards choose between Option characters and Meta. */}
      {isApplePlatform(navigator.platform) && <OptionMetaSetting />}
      {active() && error && (
        <ToastNotice
          title={t("terminalSettings.attention")}
          description={fontPreferenceError(error)}
        >
          <Button type="button" size="sm" onClick={font.retry}>
            {t("terminalSettings.retryPreference")}
          </Button>
        </ToastNotice>
      )}
    </section>
  );
}

function OptionMetaSetting() {
  useLanguage();
  const checked = optionMetaPreference.usePreference();
  const error = optionMetaPreference.useSaveError();
  return (
    <section className="mt-section-gap">
      <InlineHeader title={t("terminalSettings.keyboard")} />
      <SettingsGroup>
        <SwitchPreferenceRow
          label={t("terminalSettings.optionMeta")}
          description={t("terminalSettings.optionMetaHelp")}
          checked={checked}
          onCheckedChange={optionMetaPreference.set}
        />
      </SettingsGroup>
      {error && (
        <div role="alert" className="grid gap-3 text-body-sm text-standard">
          <p className="m-0">{t("terminalSettings.optionSaveFailed")}</p>
          <div>
            <Button
              type="button"
              onClick={() => optionMetaPreference.set(checked)}
            >
              {t("terminalSettings.retrySave")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// This local snapshot has three fixed failure values, never a caught host message.
function fontPreferenceError(error: string) {
  switch (error) {
    case "Your terminal font could not be restored. The default is active.":
      return t("terminalSettings.restoreFailed");
    case "The default terminal font is active, but this reset could not be saved on this device. Your previous font may return after restarting. Try again.":
      return t("terminalSettings.resetFailed");
    case "Your terminal font is active, but could not be saved on this device. Try again.":
      return t("terminalSettings.saveFailed");
    default:
      return error;
  }
}
