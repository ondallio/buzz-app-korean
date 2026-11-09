import { formattingLocale, t } from "../../shared/i18n";
import { clockHourCycle, useClockFormat } from "../../shared/clock-preference";
import {
  errorMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { useState, useSyncExternalStore } from "react";
import { TelescopeIcon } from "../../shared/design-system/icons/index";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { FieldButton } from "../../shared/design-system/ui/FieldButton";
import {
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import { StatusExpiration } from "../../features/user-status/StatusExpiration";
import { statusDeadline } from "../../features/user-status/status-duration";
import {
  type FocusLength,
  focusLengths,
  type Preferences,
} from "./preferences";
import type { Focus } from "./state";
import styles from "./Focus.module.css";

const focusDurations: readonly (readonly [Duration, string])[] = [
  ...focusLengths,
  ["custom", "Custom"],
];
type Duration = FocusLength | "custom";
const durationKeys = {
  "1800": "statusFocus.minutes30",
  "3600": "statusFocus.hour1",
  "7200": "statusFocus.hours2",
  today: "statusFocus.restToday",
  custom: "statusFocus.custom",
} as const;
/** Start Focus for a preset; the shortcut and the dialog share it. */
export function startFocus(focus: Focus, length: FocusLength) {
  focus.start(statusDeadline(length, Math.floor(Date.now() / 1000)));
}

export function useFocus(focus: Focus) {
  return useSyncExternalStore(focus.subscribe, focus.snapshot);
}

/** "3:30 PM" today, otherwise "Tue 3:30 PM". */
export function focusUntilLabel(until: number, now = new Date()) {
  const date = new Date(until * 1000);
  const cycle = clockHourCycle();
  const time = date.toLocaleTimeString(formattingLocale(), {
    ...(cycle ? { hourCycle: cycle } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
  return date.toDateString() === now.toDateString()
    ? time
    : t("statusFocus.dayTime", {
        day: date.toLocaleDateString(formattingLocale(), { weekday: "short" }),
        time,
      });
}

/** Sidebar banner while Focus is on: until when, and End. */
export function FocusBanner({ focus }: { focus: Focus }) {
  useClockFormat();
  const { until } = useFocus(focus);
  if (until === undefined) return null;
  return (
    <div className={styles.banner}>
      <span className={`${styles.label} text-label-sm`}>
        <TelescopeIcon size={16} aria-hidden="true" />
        {t("statusFocus.focusUntil", { time: focusUntilLabel(until) })}
      </span>
      <Button size="sm" variant="ghost" onClick={focus.end}>
        {t("statusFocus.end")}
      </Button>
    </div>
  );
}

/** The profile-menu action: start Focus for a duration, or end it early. */
export function FocusDialog({
  open,
  onOpenChange,
  focus,
  preferences,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  focus: Focus;
  preferences: Preferences;
}) {
  useClockFormat();
  const state = useFocus(focus);
  // Each opening starts from the default in Settings.
  const [duration, setDuration] = useState<Duration>(
    () => preferences.snapshot().length,
  );
  const [custom, setCustom] = useState(() => {
    const date = new Date(Date.now() + 3600_000);
    date.setMinutes(date.getMinutes() < 30 ? 30 : 60, 0, 0);
    return date;
  });
  const [error, setError] = useState<DisplayMessage>("");
  const close = () => onOpenChange(false);
  const on = state.until !== undefined;
  const start = () => {
    try {
      if (duration === "custom")
        focus.start(Math.floor(custom.getTime() / 1000));
      else startFocus(focus, duration);
      close();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };
  const durationLabel = t(durationKeys[duration]);
  return (
    <Dialog
      size="compact"
      open={open}
      onOpenChange={onOpenChange}
      title={t("statusFocus.focus")}
      closeLabel={t("statusFocus.closeFocus")}
      description={
        on
          ? t("statusFocus.focusUntil", {
              time: focusUntilLabel(state.until as number),
            })
          : t("statusFocus.focusHelp")
      }
      actions={
        on ? (
          <Button
            variant="prominent"
            onClick={() => {
              focus.end();
              close();
            }}
          >
            {t("statusFocus.endFocus")}
          </Button>
        ) : (
          <Button variant="prominent" onClick={start}>
            {t("statusFocus.startFocus")}
          </Button>
        )
      }
    >
      {!on && (
        <div className={styles.fields}>
          <div className={styles.section}>
            <span className="text-label-sm text-subtle">
              {t("statusFocus.duration")}
            </span>
            <MenuRoot>
              <MenuTrigger
                aria-label={t("statusFocus.durationName", {
                  duration: durationLabel,
                })}
                render={<FieldButton />}
              >
                {durationLabel}
              </MenuTrigger>
              <MenuPopup align="end">
                <MenuRadioGroup
                  value={duration}
                  onValueChange={(value) => {
                    setDuration(value as Duration);
                    setError("");
                  }}
                  aria-label={t("statusFocus.duration")}
                >
                  {focusDurations.map(([value]) => (
                    <MenuRadioItem key={value} value={value} closeOnClick>
                      {t(durationKeys[value])}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuPopup>
            </MenuRoot>
          </div>
          {duration === "custom" && (
            <StatusExpiration
              label={t("statusFocus.focusEnd")}
              value={custom}
              disabled={false}
              onChange={(next) => {
                setCustom(next);
                setError("");
              }}
            />
          )}
        </div>
      )}
      {(error || state.error) && (
        <p role="alert" className="text-body-sm text-danger">
          {error
            ? resolveMessage(error)
            : state.error === "Focus could not be saved on this device."
              ? t("statusFocus.focusSaveFailed")
              : state.error}
        </p>
      )}
    </Dialog>
  );
}
