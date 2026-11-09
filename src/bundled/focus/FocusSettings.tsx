import { useSyncExternalStore } from "react";
import { t, useLanguage } from "../../shared/i18n";
import { Header } from "../../shared/design-system/ui/Header";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { Select } from "../../shared/design-system/ui/Select";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import {
  type FocusLength,
  type FocusPreferences,
  focusLengths,
  type Preferences,
} from "./preferences";

function Choice<T extends string>({
  title,
  subtitle,
  value,
  options,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange(value: T): void;
}) {
  return (
    <PreferenceRow
      title={title}
      subtitle={subtitle}
      trailing={
        <Select
          label={title}
          variant="compact"
          value={value}
          groups={[
            {
              label: "",
              options: options.map(([value, label]) => ({ value, label })),
            },
          ]}
          onValueChange={(next) => onChange(next as T)}
        />
      }
    />
  );
}

/** Focus's defaults in Settings → Plugins. */
export function FocusSettings({
  preferences,
  active,
}: {
  preferences: Preferences;
  active(): boolean;
}) {
  useLanguage();
  const current = useSyncExternalStore(
    preferences.subscribe,
    preferences.snapshot,
  );
  const error = useSyncExternalStore(preferences.subscribe, preferences.error);
  const set = (change: Partial<FocusPreferences>) => {
    if (active()) preferences.set(change);
  };
  return (
    <section aria-label={t("statusFocus.settings")}>
      <Header title={t("statusFocus.focus")} />
      <SettingsGroup>
        <Choice<FocusLength>
          title={t("statusFocus.defaultLength")}
          subtitle={t("statusFocus.defaultHelp")}
          value={current.length}
          options={focusLengths.map(([value]) => [
            value,
            t(
              value === "1800"
                ? "statusFocus.minutes30"
                : value === "3600"
                  ? "statusFocus.hour1"
                  : value === "7200"
                    ? "statusFocus.hours2"
                    : "statusFocus.restToday",
            ),
          ])}
          onChange={(length) => set({ length })}
        />
      </SettingsGroup>
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error === "Focus settings could not be saved on this device."
            ? t("statusFocus.settingsSaveFailed")
            : error}
        </p>
      )}
    </section>
  );
}
