import type { Reminder, RemindersState } from "../../features/relay/reminders";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import { t } from "../../shared/i18n";

export const nowSeconds = () => Math.floor(Date.now() / 1000);

/** A pending reminder whose due time has arrived. */
export const isDue = (reminder: Reminder, now: number) =>
  reminder.status === "pending" &&
  reminder.notBefore !== undefined &&
  reminder.notBefore <= now;

export const countDue = (reminders: readonly Reminder[], now: number) =>
  reminders.filter((reminder) => isDue(reminder, now)).length;

/**
 * Pending reminders that came due in `(watermark, now]`. The strict lower bound
 * keeps reminders already overdue at launch from notifying again.
 */
export const dueSince = (
  reminders: readonly Reminder[],
  watermark: number,
  now: number,
) =>
  reminders.filter(
    (reminder) => isDue(reminder, now) && (reminder.notBefore ?? 0) > watermark,
  );

/** setTimeout fires at once past 2^31-1 ms, so long delays are re-checked. */
export const MAX_DELAY_MS = 2 ** 31 - 1;

/** Milliseconds until the next pending reminder comes due, capped. */
export function nextDelay(reminders: readonly Reminder[], now: number) {
  let next: number | undefined;
  for (const { status, notBefore } of reminders)
    if (status === "pending" && notBefore !== undefined && notBefore > now)
      next = Math.min(next ?? notBefore, notBefore);
  return next === undefined
    ? undefined
    : Math.min((next - now) * 1000, MAX_DELAY_MS);
}

const pendingIds = new WeakMap<RemindersState, ReadonlySet<string>>();
/** Message ids with a pending reminder, derived once per reminders snapshot. */
export function pendingMessageIds(state: RemindersState) {
  let ids = pendingIds.get(state);
  if (!ids) {
    ids = new Set(
      state.reminders.flatMap((reminder) =>
        reminder.status === "pending" && reminder.target
          ? [reminder.target.eventId]
          : [],
      ),
    );
    pendingIds.set(state, ids);
  }
  return ids;
}

export type ReminderGroup = Readonly<{ label: string; reminders: Reminder[] }>;

/** Overdue, Today and Upcoming pending reminders, then Done newest first; cancelled is hidden. */
export function groupReminders(
  reminders: readonly Reminder[],
  now: number,
  endOfToday: number,
): ReminderGroup[] {
  const groups = { Overdue: [], Today: [], Upcoming: [], Done: [] } as Record<
    string,
    Reminder[]
  >;
  for (const reminder of reminders) {
    const at = reminder.notBefore;
    if (reminder.status === "done") groups.Done?.push(reminder);
    if (reminder.status !== "pending" || at === undefined) continue;
    const label =
      at <= now ? "Overdue" : at <= endOfToday ? "Today" : "Upcoming";
    groups[label]?.push(reminder);
  }
  return Object.entries(groups)
    .filter(([, list]) => list.length)
    .map(([label, list]) => ({
      label,
      reminders: list.sort((a, b) =>
        label === "Done"
          ? b.createdAt - a.createdAt
          : (a.notBefore ?? 0) - (b.notBefore ?? 0),
      ),
    }));
}

export function endOfToday() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return Math.floor(end.getTime() / 1000);
}

/** The given day offset at 9am local, rolled forward a day if already past. */
function nextDayAt9am(dayOffset: number) {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + dayOffset);
  target.setHours(9, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return Math.floor(target.getTime() / 1000);
}

const groupKeys = {
  Overdue: "v1wf.rem.group.Overdue",
  Today: "v1wf.rem.group.Today",
  Upcoming: "v1wf.rem.group.Upcoming",
  Done: "v1wf.rem.group.Done",
} as const;

/** A group's heading, by its English label. */
export const groupLabel = (label: string) =>
  Object.hasOwn(groupKeys, label)
    ? t(groupKeys[label as keyof typeof groupKeys])
    : label;

const presetKeys = {
  "In 30 minutes": "v1wf.rem.preset.30m",
  "In 1 hour": "v1wf.rem.preset.1h",
  "In 3 hours": "v1wf.rem.preset.3h",
  "Tomorrow at 9am": "v1wf.rem.preset.tomorrow",
  "Next Monday at 9am": "v1wf.rem.preset.monday",
} as const;

/** A time preset's label in the display language, by its English label. */
export const presetLabel = (label: string) =>
  Object.hasOwn(presetKeys, label)
    ? t(presetKeys[label as keyof typeof presetKeys])
    : label;

export type TimePreset = Readonly<{ label: string; at(): number }>;
export const TIME_PRESETS: readonly TimePreset[] = [
  { label: "In 30 minutes", at: () => nowSeconds() + 30 * 60 },
  { label: "In 1 hour", at: () => nowSeconds() + 60 * 60 },
  { label: "In 3 hours", at: () => nowSeconds() + 3 * 60 * 60 },
  { label: "Tomorrow at 9am", at: () => nextDayAt9am(1) },
  {
    label: "Next Monday at 9am",
    at: () => nextDayAt9am((8 - new Date().getDay()) % 7 || 7),
  },
];

/** Today as local `YYYY-MM-DD`, for the custom date input. */
export function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** A strictly future local date and time in unix seconds, or null. */
export function parseCustomDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const at = Math.floor(new Date(`${date}T${time}`).getTime() / 1000);
  return Number.isNaN(at) || at <= nowSeconds() ? null : at;
}

/** True when the clock skipped the entered local time (a DST gap) and `at` moved. */
export const shiftedFrom = (time: string, at: number) =>
  new Date(at * 1000).toTimeString().slice(0, 5) !== time.slice(0, 5);

/** Relay-valid not_before values can exceed JavaScript's Date range. */
export const isDisplayable = (at: number) =>
  !Number.isNaN(new Date(at * 1000).getTime());

export const formatDue = (at: number) =>
  new Date(at * 1000).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** Beta may store empty target fields; those reminders cannot open a message. */
export const navigableTarget = (reminder: Reminder) =>
  reminder.target?.channelId && reminder.target.eventId
    ? reminder.target
    : undefined;

const timeOf = (date: Date) =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Slack-style due copy: relative when overdue, otherwise the day and time. */
export function dueLabel(at: number, now: number) {
  if (at <= now)
    return t("v1wf.rem.overdueAgo", { time: relativeTimestamp(at, now) });
  return dueDateLabel(at, now);
}

function dueDay(at: number, now: number) {
  const due = new Date(at * 1000);
  const today = new Date(now * 1000);
  const days = Math.round(
    (new Date(due).setHours(0, 0, 0, 0) -
      new Date(today).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  const time = timeOf(due);
  if (days === 0) return { kind: "today", time } as const;
  if (days === 1) return { kind: "tomorrow", time } as const;
  if (days === -1) return { kind: "yesterday", time } as const;
  const day =
    days > 1 && days < 7
      ? due.toLocaleDateString([], { weekday: "long" })
      : due.toLocaleDateString([], {
          month: "short",
          day: "numeric",
          ...(due.getFullYear() !== today.getFullYear()
            ? { year: "numeric" }
            : {}),
        });
  return { kind: "day", day, time } as const;
}

/** The short due copy on a reminder's snooze button. */
export function dueShortLabel(at: number, now: number) {
  const due = dueDay(at, now);
  switch (due.kind) {
    case "today":
      return t("v1wf.rem.dueToday", { time: due.time });
    case "tomorrow":
      return t("v1wf.rem.dueTomorrow", { time: due.time });
    case "yesterday":
      return t("v1wf.rem.dueYesterday", { time: due.time });
    default:
      return t("v1wf.rem.dueDay", { day: due.day, time: due.time });
  }
}

/** Original scheduled day and time, including dates that are already overdue. */
export function dueDateLabel(at: number, now: number) {
  const due = dueDay(at, now);
  switch (due.kind) {
    case "today":
      return t("v1wf.rem.todayAt", { time: due.time });
    case "tomorrow":
      return t("v1wf.rem.tomorrowAt", { time: due.time });
    case "yesterday":
      return t("v1wf.rem.yesterdayAt", { time: due.time });
    default:
      return t("v1wf.rem.dayAt", { day: due.day, time: due.time });
  }
}

/** Where a snooze preset lands: its time, with a short weekday unless today. */
export function presetHint(at: number, now: number) {
  const due = new Date(at * 1000);
  return due.toDateString() === new Date(now * 1000).toDateString()
    ? timeOf(due)
    : `${due.toLocaleDateString([], { weekday: "short" })} ${timeOf(due)}`;
}
