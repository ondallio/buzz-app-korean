import { formattingLocale, languagePreference, t } from "../../shared/i18n";
import { clockHourCycle, useClockFormat } from "../../shared/clock-preference";
import { enUS, ko } from "react-day-picker/locale";
import { Popover } from "@base-ui/react/popover";
import { useState } from "react";
import { Calendar } from "../../shared/design-system/ui/Calendar";
import { FieldButton } from "../../shared/design-system/ui/FieldButton";
import {
  MenuRoot,
  MenuTrigger,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
} from "../../shared/design-system/ui/Menu";
import styles from "./Status.module.css";

const times = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 ? "30" : "00";
  return {
    value: `${hour.toString().padStart(2, "0")}:${minute}`,
    wallTime: new Date(Date.UTC(2000, 0, 1, hour, Number(minute))),
  };
});

export function StatusExpiration({
  value,
  onChange,
  disabled,
  label = t("statusFocus.expiration"),
}: {
  value: Date;
  onChange(value: Date): void;
  disabled: boolean;
  /** Names the date and time controls, e.g. "Focus end". */
  label?: string;
}) {
  useClockFormat();
  const cycle = clockHourCycle();
  const clock = cycle ? { hourCycle: cycle } : {};
  // Slots are abstract wall-clock choices, so a selected day's DST gap cannot rename them.
  const format = new Intl.DateTimeFormat(formattingLocale(), {
    hour: "numeric",
    minute: "2-digit",
    ...clock,
    timeZone: "UTC",
  });
  const labels = new Map(
    times.map((option) => [option.value, format.format(option.wallTime)]),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const time = `${value.getHours().toString().padStart(2, "0")}:${value.getMinutes().toString().padStart(2, "0")}`;
  return (
    <div className={styles.expiration}>
      <span className="text-label-sm text-subtle">
        {t("statusFocus.until")}
      </span>
      <div className={styles.expirationFields}>
        <Popover.Root open={calendarOpen} onOpenChange={setCalendarOpen}>
          <Popover.Trigger
            disabled={disabled}
            render={
              <FieldButton aria-label={t("statusFocus.dateLabel", { label })} />
            }
          >
            {value.toLocaleDateString(formattingLocale(), {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner
              sideOffset={4}
              align="start"
              collisionPadding={16}
              className={styles.calendarPositioner}
            >
              <Popover.Popup
                className={styles.calendarPopup}
                aria-label={t("statusFocus.chooseDate")}
              >
                <Calendar
                  locale={languagePreference() === "ko" ? ko : enUS}
                  mode="single"
                  required
                  autoFocus
                  selected={value}
                  defaultMonth={value}
                  disabled={{ before: today }}
                  onSelect={(day) => {
                    const next = new Date(day);
                    next.setHours(
                      value.getHours(),
                      value.getMinutes(),
                      value.getSeconds(),
                      0,
                    );
                    onChange(next);
                    setCalendarOpen(false);
                  }}
                />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <MenuRoot>
          <MenuTrigger
            disabled={disabled}
            render={
              <FieldButton aria-label={t("statusFocus.timeLabel", { label })} />
            }
          >
            {labels.get(time) ??
              value.toLocaleTimeString(formattingLocale(), {
                ...clock,
                hour: "numeric",
                minute: "2-digit",
              })}
          </MenuTrigger>
          <MenuPopup align="end" data-status-menu>
            <div className={styles.timeOptions}>
              <MenuRadioGroup
                value={time}
                aria-label={t("statusFocus.expirationTime")}
                onValueChange={(timeValue) => {
                  const hour = Number(timeValue.slice(0, 2));
                  const minute = Number(timeValue.slice(3));
                  const next = new Date(value);
                  next.setHours(hour, minute, 0, 0);
                  onChange(next);
                }}
              >
                {times.map((option) => (
                  <MenuRadioItem
                    key={option.value}
                    value={option.value}
                    closeOnClick
                  >
                    {labels.get(option.value)}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </div>
          </MenuPopup>
        </MenuRoot>
      </div>
    </div>
  );
}
