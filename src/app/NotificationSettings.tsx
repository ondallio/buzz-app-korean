import { t, useLanguage } from "../shared/i18n";
import { en as notificationEnglish } from "../shared/i18n/catalogs/notifications";
import { notificationCategoryLabel } from "../features/notifications/content";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";
import { ToastNotice } from "../shared/design-system/ui/Toast";
import { SwitchPreferenceRow } from "../shared/design-system/ui/SwitchPreferenceRow";
import { Button } from "../shared/design-system/ui/Button";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { Select } from "../shared/design-system/ui/Select";
import { UnreadIndicatorSettings } from "./UnreadIndicatorSettings";
import { usePermissionCheck } from "./usePermissionCheck";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { NotificationsService } from "../features/notifications/service";
import type { NotificationCategory } from "../features/notifications/preferences";
import {
  CATEGORY_SOUND_LABELS,
  RECOMMENDED_SOUND_BY_CATEGORY,
  SOUND_NAMES,
  type SoundName,
} from "../features/notifications/sound";
import styles from "./NotificationSettings.module.css";

// Reference row order: direct messages, mentions, thread replies.
const SOUND_ROWS: readonly NotificationCategory[] = [
  "direct",
  "mention",
  "thread",
  "agent",
];

function AlertSoundRow({
  category,
  value,
  disabled,
  onChange,
}: {
  category: NotificationCategory;
  value: SoundName;
  disabled: boolean;
  onChange: (next: SoundName) => void;
}) {
  const recommended = RECOMMENDED_SOUND_BY_CATEGORY[category];
  const label =
    category === "mention"
      ? t("notifications.sound.mention")
      : notificationCategoryLabel(category, CATEGORY_SOUND_LABELS[category]);

  const names = [
    "silent",
    recommended,
    ...SOUND_NAMES.filter((name) => name !== recommended).sort(),
  ];
  return (
    <PreferenceRow
      title={label}
      disabled={disabled}
      trailing={
        <Select
          label={label}
          variant="compact"
          disabled={disabled}
          value={value}
          valueLabel={
            value === "silent" ? t("notifications.settings.silent") : value
          }
          groups={[
            {
              label: "",
              options: names.map((name) => ({
                value: name,
                label:
                  name === "silent"
                    ? t("notifications.settings.silent")
                    : name === recommended
                      ? t("notifications.settings.recommended", { sound: name })
                      : name,
              })),
            },
          ]}
          onValueChange={(next) => onChange(next as SoundName)}
        />
      }
    />
  );
}

export function NotificationSettings({
  notifications,
  active = true,
}: {
  notifications: NotificationsService;
  active?: boolean;
}) {
  useLanguage();
  const state = useSyncExternalStore(
    notifications.subscribe,
    notifications.snapshot,
  );
  const { preferences, permission } = state;
  const [checking, checkPermission] = usePermissionCheck(() =>
    notifications.refreshPermission(),
  );
  const preview = useRef<{
    category: NotificationCategory;
    name: SoundName;
  } | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const stopPreview = useCallback((owner?: HTMLAudioElement) => {
    const audio = previewAudio.current;
    if (owner && audio !== owner) return;
    previewAudio.current = null;
    if (audio) {
      audio.onended = null;
      audio.onpause = null;
      audio.onerror = null;
      audio.pause();
    }
    preview.current = null;
  }, []);
  const previewSound = useCallback(
    (category: NotificationCategory, name: SoundName) => {
      stopPreview();
      if (name === "silent") return;
      try {
        const audio = new Audio(`/sounds/${name}.mp3`);
        previewAudio.current = audio;
        preview.current = { category, name };
        const stop = () => stopPreview(audio);
        audio.onended = stop;
        audio.onpause = stop;
        audio.onerror = stop;
        void audio.play().catch(stop);
      } catch {
        stopPreview();
      }
    },
    [stopPreview],
  );
  useEffect(
    () => () => {
      const audio = previewAudio.current;
      previewAudio.current = null;
      if (audio) {
        audio.onended = null;
        audio.onpause = null;
        audio.onerror = null;
        audio.pause();
      }
    },
    [],
  );
  useEffect(() => {
    if (
      preview.current &&
      (!active ||
        !preferences.enabled ||
        !preferences.sound ||
        preferences.categories[preview.current.category] === false ||
        preferences.sounds[preview.current.category] !== preview.current.name)
    )
      stopPreview();
  }, [active, preferences, stopPreview]);
  const desktopAlertsEnabled = !state.developmentPaused && preferences.enabled;
  const preferenceError =
    state.preferencesError ===
    notificationEnglish["notifications.error.restoreDetails"]
      ? t("notifications.error.restoreDetails")
      : state.preferencesError ===
          notificationEnglish["notifications.error.saveDetails"]
        ? t("notifications.error.saveDetails")
        : state.preferencesError;
  const permissionStatus = state.developmentPaused
    ? t("notifications.permission.development")
    : state.requesting
      ? t("notifications.permission.waiting")
      : permission === "denied"
        ? t("notifications.permission.denied")
        : permission === "unsupported"
          ? t("notifications.permission.unsupported")
          : permission === "default"
            ? t("notifications.permission.default")
            : null;
  return (
    <section
      className={styles.root}
      aria-labelledby="notification-settings-title"
    >
      <Header
        id="notification-settings-title"
        title={t("notifications.settings.title")}
      />
      <div className="grid grid-cols-1 gap-section-gap">
        <section aria-labelledby="notification-categories-title">
          <InlineHeader
            id="notification-categories-title"
            title={t("notifications.settings.about")}
          />
          <SettingsGroup>
            {state.categories.map(({ key, label }) => (
              <SwitchPreferenceRow
                key={key}
                label={notificationCategoryLabel(key, label)}
                checked={preferences.categories[key] !== false}
                onCheckedChange={(enabled) =>
                  notifications.updatePreferences({
                    categories: { ...preferences.categories, [key]: enabled },
                  })
                }
              />
            ))}
          </SettingsGroup>
        </section>
        <section
          id="setting-delivery"
          aria-label={t("notifications.settings.deliveryRegion")}
        >
          <InlineHeader title={t("notifications.settings.delivery")} />
          <SettingsGroup>
            <SwitchPreferenceRow
              label={t("notifications.settings.alerts")}
              checked={desktopAlertsEnabled}
              disabled={state.developmentPaused}
              onCheckedChange={(enabled) =>
                notifications.updatePreferences({ enabled })
              }
            />
            {(desktopAlertsEnabled || state.developmentPaused) &&
              (permissionStatus ||
                (!state.systemManaged && !state.developmentPaused)) && (
                <div
                  className={styles.permission}
                  data-warning={
                    state.developmentPaused ||
                    permission === "denied" ||
                    permission === "default" ||
                    permission === "unsupported" ||
                    undefined
                  }
                >
                  {permissionStatus && (
                    <p role="status" className="text-body-sm">
                      {permissionStatus}
                    </p>
                  )}
                  {!state.systemManaged && !state.developmentPaused && (
                    <div className={styles.actions}>
                      {permission === "default" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="link"
                          disabled={state.requesting}
                          onClick={() => void notifications.requestPermission()}
                        >
                          {t("notifications.permission.allow")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        disabled={state.requesting}
                        loading={checking}
                        onClick={checkPermission}
                      >
                        {t("notifications.permission.check")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            {desktopAlertsEnabled && (
              <div className={styles.nestedPreferences}>
                <SwitchPreferenceRow
                  id="setting-viewing"
                  label={t("notifications.settings.viewing")}
                  description={t("notifications.settings.viewingDescription")}
                  checked={preferences.notifyWhileViewing}
                  onCheckedChange={(notifyWhileViewing) =>
                    notifications.updatePreferences({ notifyWhileViewing })
                  }
                />
                <SwitchPreferenceRow
                  id="setting-sound"
                  label={t("notifications.settings.sound")}
                  description={t("notifications.settings.soundDescription")}
                  checked={preferences.sound}
                  onCheckedChange={(sound) =>
                    notifications.updatePreferences({ sound })
                  }
                />
                {preferences.sound && (
                  <div className={styles.soundRows}>
                    {SOUND_ROWS.map((category) => (
                      <AlertSoundRow
                        key={category}
                        category={category}
                        disabled={preferences.categories[category] === false}
                        value={preferences.sounds[category]}
                        onChange={(next) => {
                          if (next === preferences.sounds[category]) return;
                          notifications.updatePreferences({
                            sounds: {
                              ...preferences.sounds,
                              [category]: next,
                            },
                          });
                          previewSound(category, next);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </SettingsGroup>
        </section>
        <UnreadIndicatorSettings
          indicator={notifications.indicator}
          active={active}
        />
        {active && state.preferencesError && (
          <ToastNotice
            title={t("notifications.error.preferences")}
            description={preferenceError ?? state.preferencesError}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => notifications.updatePreferences({})}
            >
              {t("notifications.error.retry")}
            </Button>{" "}
            <Button
              type="button"
              size="sm"
              onClick={() => notifications.reloadPreferences()}
            >
              {t("notifications.error.reload")}
            </Button>
          </ToastNotice>
        )}
        {active && state.error && (
          <ToastNotice
            title={t("notifications.error.send")}
            description={state.error}
          />
        )}
      </div>
    </section>
  );
}
