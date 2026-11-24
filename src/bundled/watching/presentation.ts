import {
  timerSpent,
  timerState,
  type TimerState,
} from "../../features/agents/attention";
import { formatItemTimestamp } from "../../shared/datetime";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import {
  ChatCircleIcon,
  LockIcon,
  HashIcon,
} from "../../shared/design-system/icons";
import type { Watch } from "./model";
import { t } from "../../shared/i18n";
export const title = (id: string) =>
  id
    .replace(/^interest\//, "")
    .replace(
      /-(?:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|[a-f0-9]{32,64})$/i,
      "",
    )
    .replace(/[-_]+/g, " ");
export const recentMessages = (output: string) =>
  output.replace(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) · ([^\n]+)\n/gm,
    (_header, timestamp: string, author: string) =>
      `${relativeTimestamp(Date.parse(timestamp) / 1000)}${/^[a-f0-9]{64}$/i.test(author) ? "" : ` · ${author}`}\n`,
  );
export function heading(value: string) {
  return {
    text: value
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^#+\s*/, "")
      .replace(/\*\*|__|`/g, "")
      .trim(),
    url: /\]\((https:\/\/[^)\s]+)\)/.exec(value)?.[1],
  };
}
export function describe(
  watch: Watch,
  now = Date.now() / 1000,
  saved?: TimerState,
  /** Its Interest is paused, so the runner skips it. */
  paused = false,
) {
  if (watch.type === "timer") {
    // The runner's saved state while it describes this schedule: after a late
    // run, an edit or a rearm, only it knows when the timer runs next.
    const state = timerState(watch, saved, now);
    const spent = timerSpent(watch, state, now);
    const interval =
      watch.interval_secs % 3600 === 0
        ? `${watch.interval_secs / 3600}h`
        : watch.interval_secs % 60 === 0
          ? `${watch.interval_secs / 60}m`
          : `${watch.interval_secs}s`;
    // `watch_rearm` accepts times past what Date can hold, which cannot be
    // formatted; such a run never comes.
    const when = (at: number) =>
      Number.isNaN(new Date(at * 1000).getTime())
        ? undefined
        : formatItemTimestamp(at, { withTime: true, nowSeconds: now });
    // A run due at or after the deadline never starts; nor does a paused one.
    const fires = watch.expires_at === null || state.nextDue < watch.expires_at;
    const runnable = watch.enabled && !paused && !spent && fires;
    // The runner keeps a missed run's deadline while its Interest is busy or
    // its channel is not joined, so a past deadline reads as overdue.
    const nextAt = when(state.nextDue);
    const overdue = runnable && state.nextDue <= now;
    const next =
      nextAt &&
      (overdue ? t("v106ch.watch.overdueSince", { time: nextAt }) : nextAt);
    // A one-shot shows the runner's deadline until it runs, since an interval
    // edit keeps that deadline, then its configured time as a record.
    const once = spent
      ? when(watch.armed_at + watch.interval_secs)
      : fires
        ? next
        : t("v106ch.watch.expiresBeforeRun");
    const repeating =
      watch.max_occurrences === null
        ? t("v1wf.watch.every", { interval })
        : t("v1wf.watch.everyRuns", {
            interval,
            runs: watch.max_occurrences,
          });
    const schedule =
      watch.max_occurrences === 1
        ? t("v106ch.watch.once", {
            when: once ?? t("v106ch.watch.dateOutOfRange"),
          })
        : `${repeating}${
            runnable && next
              ? ` · ${overdue ? next : t("v106ch.watch.next", { time: next })}`
              : ""
          }`;
    return { title: schedule, spent };
  }
  if (watch.type === "source")
    return {
      title: watch.name || watch.provider,
    };
  return {
    title: watch.name || t("v1wf.watch.messages"),
  };
}
export type Channel = {
  id: string;
  name: string;
  channelType?: string;
  private?: true;
};
/** Matches the sidebar: chats and DMs, private channels, then ordinary channels. */
export const channelIcon = (channel?: Channel) =>
  channel?.channelType === "solo" || channel?.channelType === "dm"
    ? ChatCircleIcon
    : channel?.private
      ? LockIcon
      : HashIcon;
