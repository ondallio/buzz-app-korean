import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { t, useLanguage } from "../../shared/i18n";
import { Button } from "../../shared/design-system/ui/Button";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { RelaySession } from "../../features/relay/session";
import styles from "./Channels.module.css";

type UnreadSnapshot = ReturnType<RelaySession["unread"]["snapshot"]>;

/** What the channel's row shows: opening it quiets the row (`row`) while
 * its messages and threads stay unread elsewhere. */
const shown = (snapshot: UnreadSnapshot) => snapshot.row ?? snapshot;

/** Bold tracks ordinary backlog; protected attention has its own dot. */
export function ordinaryUnread(
  snapshot: UnreadSnapshot,
  dm: boolean,
  muted = false,
) {
  const { observedCount, attentionCount } = shown(snapshot);
  const count = observedCount ?? 0;
  return (
    snapshot.manual !== "none" ||
    (!muted && (dm ? count > 0 : count > (attentionCount ?? 0)))
  );
}

/** Observe only confirmed preferences; optimistic menu intents do not quiet unread. */
export function useConfirmedMute(session: RelaySession, channelId: string) {
  const get = useCallback(() => {
    const snapshot = session.sidebarPreferences.snapshot();
    return !snapshot.cached && !!snapshot.data?.muted.includes(channelId);
  }, [session, channelId]);
  return useSyncExternalStore(session.sidebarPreferences.subscribe, get, get);
}

/** Unread evidence for one channel's badge. */
export function useUnreadState(
  session: RelaySession,
  channelId: string,
  dm: boolean,
) {
  const target = useMemo(
    () => ({ kind: "channel" as const, channelId }),
    [channelId],
  );
  const subscribe = useCallback(
    (listener: () => void) => session.unread.subscribe(target, listener),
    [session, target],
  );
  const get = useCallback(
    () => session.unread.snapshot(target),
    [session, target],
  );
  const subscribeActivity = useCallback(
    (listener: () => void) =>
      session.unread.subscribeActivity(channelId, listener),
    [session, channelId],
  );
  const getActivity = useCallback(
    () => session.unread.activity(channelId),
    [session, channelId],
  );
  const snapshot = useSyncExternalStore(subscribe, get, get);
  const activity = useSyncExternalStore(
    subscribeActivity,
    getActivity,
    getActivity,
  );
  const muted = useConfirmedMute(session, channelId);
  const { observedCount: count, attentionCount } = shown(snapshot);
  const manual = snapshot.manual !== "none";
  const unread =
    manual || ((count ?? 0) > 0 && (dm || !muted || (attentionCount ?? 0) > 0));
  const ordinary = ordinaryUnread(snapshot, dm, muted);
  const threadCount = snapshot.row?.threadCount ?? activity.items?.length ?? 0;
  return {
    snapshot,
    activity,
    count,
    attentionCount,
    manual,
    unread,
    ordinary,
    threadCount,
    muted,
  };
}

export function UnreadBadge({
  session,
  channelId,
  dm = false,
  label,
  labelUnread = "ordinary",
  preserveUnread = false,
}: {
  session: RelaySession;
  channelId: string;
  dm?: boolean;
  label?: ReactNode;
  /** Solo labels emphasize every unread message, so attention adds no dot. */
  labelUnread?: "ordinary" | "all";
  /** Preserve observed evidence for Solo destinations with their own labels. */
  preserveUnread?: boolean;
}) {
  useLanguage();
  const {
    snapshot,
    activity,
    count,
    manual,
    attentionCount,
    unread: quietUnread,
    ordinary,
    threadCount,
    muted,
  } = useUnreadState(session, channelId, dm);
  const unread =
    labelUnread === "all" || preserveUnread
      ? manual || (count ?? 0) > 0
      : quietUnread;
  const hideUnreadDots = muted && labelUnread === "ordinary" && !preserveUnread;
  if (!unread && !threadCount && label === undefined) return null;
  const priority = dm || (attentionCount ?? 0) > 0;
  const showUnreadDot =
    !hideUnreadDots &&
    priority &&
    threadCount === 0 &&
    labelUnread === "ordinary";
  const unreadLabel = manual
    ? t(
        snapshot.manual === "local-only"
          ? "unreadBadge.manualLocal"
          : "unreadBadge.manual",
      )
    : t(
        snapshot.freshness === "stale"
          ? "unreadBadge.observedStale"
          : "unreadBadge.observed",
        { count: count ?? String(count) },
      );
  const mentionCount = activity.mentions?.length ?? 0;
  const mentionOnlyLabel = t(
    `unreadBadge.mention.${mentionCount === 1 ? "one" : "many"}.${activity.freshness === "stale" ? "stale" : "observed"}`,
    { count: mentionCount },
  );
  // Mentions share the thread dot. Without a thread they have only the
  // aria-hidden priority dot, or none when muted, so name them on their own.
  const activityLabel = mentionCount
    ? t(
        `unreadBadge.activity.${mentionCount === 1 ? "oneMention" : "manyMentions"}.${threadCount === 1 ? "oneThread" : "manyThreads"}.${activity.freshness === "stale" ? "stale" : "observed"}`,
        { mentions: mentionCount, threads: threadCount },
      )
    : t(
        `unreadBadge.thread.${threadCount === 1 ? "one" : "many"}.${activity.freshness === "stale" ? "stale" : "observed"}`,
        { count: threadCount },
      );
  return (
    <>
      {label !== undefined && (
        <span
          data-channel-unread-title={
            (labelUnread === "all" ? unread : ordinary) || undefined
          }
        >
          {label}
        </span>
      )}
      {unread && (
        <span
          className={styles.unreadState}
          data-channel-unread=""
          data-channel-muted={muted || undefined}
          data-priority={priority}
          role="img"
          aria-label={unreadLabel}
        />
      )}
      {showUnreadDot && (
        <span
          className={styles.priorityDot}
          data-channel-priority=""
          data-indicator-layer="unread"
          aria-hidden="true"
        />
      )}
      {mentionCount > 0 && threadCount === 0 && (
        <span className="sr-only">{mentionOnlyLabel}</span>
      )}
      {threadCount > 0 &&
        (hideUnreadDots ? (
          <span className="sr-only">{activityLabel}</span>
        ) : (
          <span
            className={styles.threadActivityDot}
            data-channel-activity=""
            data-channel-muted={muted || undefined}
            role="img"
            aria-label={activityLabel}
            title={activityLabel}
          />
        ))}
    </>
  );
}
export function UnreadOptions({
  session,
  channelId,
}: {
  session: RelaySession;
  channelId?: string | undefined;
}) {
  useLanguage();
  const sync = useSyncExternalStore(
    session.unread.subscribeSync,
    session.unread.sync,
    session.unread.sync,
  );
  const [error, setError] = useState<DisplayMessage>();
  const run = (operation: Promise<unknown>) => {
    setError(undefined);
    void operation.catch((cause) =>
      setError(
        cause instanceof Error
          ? cause.message
          : localMessage("unreadOptions.operationFailed"),
      ),
    );
  };
  const displayedError = resolveMessage(error);
  return (
    <>
      {channelId && (
        <Button
          type="button"
          onClick={() =>
            run(session.unread.markUnreadLocal({ kind: "channel", channelId }))
          }
        >
          {t("unreadOptions.markLocal")}
        </Button>
      )}
      {channelId && sync.capability === "frontier-sync" && (
        <Button
          type="button"
          onClick={() => {
            const last = session.channels
              .window(channelId)
              .rows.filter((row) => !row.membership && !row.huddle)
              .at(-1);
            if (last)
              run(
                session.unread.markThrough(
                  { kind: "channel", channelId },
                  last.id,
                ),
              );
            else setError(localMessage("unreadOptions.loadVerified"));
          }}
        >
          {t("unreadOptions.markThrough")}
        </Button>
      )}
      {displayedError && <p role="alert">{displayedError}</p>}
      <details>
        <summary>{t("unreadOptions.status")}</summary>
        <p>{t("unreadOptions.guidance")}</p>
        <p>
          {t("unreadOptions.sync", {
            capability: sync.capability,
            status: sync.status,
          })}
        </p>
        {sync.error && <p role="alert">{sync.error}</p>}
        <Button type="button" onClick={() => run(session.unread.refresh())}>
          {t("unreadOptions.refresh")}
        </Button>
        {sync.capability === "frontier-sync" && (
          <Button type="button" onClick={() => run(session.unread.retrySync())}>
            {t("unreadOptions.retry")}
          </Button>
        )}
      </details>
    </>
  );
}
