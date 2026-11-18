import { t, useLanguage } from "../../shared/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatFullTimestamp,
  formatItemTimestamp,
} from "../../shared/datetime";
import { useClockFormat } from "../../shared/clock-preference";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import type { RelayEvent } from "../relay/events";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Button } from "../../shared/design-system/ui/Button";
import {
  artifactOp,
  type Expected,
  type SnapshotRead,
} from "./agent-config-artifacts";
import {
  emptyHistory,
  type Gap,
  HISTORY_LIMIT,
  HISTORY_MAX_OFFSET,
  type History,
  lineDiff,
  loadOlder,
  recalledHistory,
  rememberHistory,
  revertTemplate,
  revisionProblem,
  type SettingsCheck,
  segments,
  settingsDiff,
} from "./agent-config-history";
import styles from "./AgentConfigHistory.module.css";

const gapText = (gap: Gap) =>
  gap === "unloaded"
    ? t("v1agent.history.unloaded")
    : gap === "capped"
      ? t("v1agent.history.capped", { limit: HISTORY_LIMIT })
      : gap === "failed"
        ? t("v1agent.history.failed")
        : t("v1agent.history.unavailable");

/** The text a person edits, for the line diff. */
function text(expected: Expected, event: RelayEvent) {
  try {
    const value = JSON.parse(event.content) as Record<string, unknown>;
    const field = expected.type === "buzz.team" ? "instructions" : "text";
    return typeof value[field] === "string" ? value[field] : "";
  } catch {
    return "";
  }
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const unconfirmed = (detail: string) =>
  t("v1agent.history.unconfirmed", { detail });

/** What a revert's send came to: accepted, definitely not saved, or maybe. */
export type RevertOutcome =
  | Readonly<{ status: "accepted" }>
  | Readonly<{ status: "refused" | "uncertain"; message: string }>;

export function AgentConfigHistory({
  expected,
  head,
  version,
  read,
  settings,
  onRevert,
  title: titleOverride,
  onHistoryChange,
  selected,
  onSelect,
}: {
  selected?: string | undefined;
  onSelect?: ((id?: string) => void) | undefined;
  expected: Expected;
  /** The current head from the config store; revert builds on it. */
  head: RelayEvent | undefined;
  /** Changes whenever history changes without a new head, as when an older
   * revision is redacted; history then reloads. */
  version?: number;
  read: SnapshotRead;
  /** Required to validate, and so to revert, `buzz.agent.settings`. */
  settings?: SettingsCheck;
  /** Signs and sends the revert; resolves to what the relay said. */
  onRevert(template: ReturnType<typeof revertTemplate>): Promise<RevertOutcome>;
  /** Names the section, as which side of the config it shows. */
  title?: string;
  /** Reports loaded counts without a separate history read. */
  onHistoryChange?: (history: History) => void;
}) {
  useLanguage();
  const title = titleOverride ?? t("v1agent.history.title");
  const [history, setHistory] = useState<History>(
    () => recalledHistory(read, expected, head, version) ?? emptyHistory,
  );
  const [loading, setLoading] = useState(false);
  const [localSelection, setLocalSelection] = useState<string>();
  const open = onSelect ? selected : localSelection;
  const setOpen = onSelect ?? setLocalSelection;
  const [reverting, setReverting] = useState<string>();
  const [failure, setFailure] = useState<{ id: string; text: string }>();
  useEffect(() => onHistoryChange?.(history), [history, onHistoryChange]);
  const live = useRef(history);
  live.current = history;
  const signal = useRef<AbortController>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only artifact identity and revision identifiers invalidate a read.
  const more = useCallback(async () => {
    signal.current ??= new AbortController();
    const controller = signal.current;
    setLoading(true);
    const next = await loadOlder(
      read,
      expected.channel,
      expected.d,
      live.current,
      controller.signal,
    );
    if (controller.signal.aborted) return;
    live.current = next;
    rememberHistory(read, expected, head, version, next);
    setHistory(next);
    setLoading(false);
  }, [read, expected.channel, expected.d, head?.id, version]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: A new head or a history change reloads history from the newest page.
  useEffect(() => {
    const remembered = recalledHistory(read, expected, head, version);
    const initial = remembered ?? emptyHistory;
    setHistory(initial);
    live.current = initial;
    if (!remembered) void more();
    return () => {
      signal.current?.abort();
      signal.current = undefined;
    };
  }, [more, head?.id, version]);

  /** A refusal or an invalid snapshot is definite: nothing changed. A send
   * that fails without a refusal may still have been saved. */
  const revert = async (target: RelayEvent) => {
    if (!head) return;
    const fail = (text: string) => setFailure({ id: target.id, text });
    setFailure(undefined);
    let template: ReturnType<typeof revertTemplate>;
    try {
      template = revertTemplate(expected, head, target, settings);
    } catch (error) {
      return fail(t("v1agent.history.notReverted", { reason: message(error) }));
    }
    setReverting(target.id);
    try {
      const delivery = await onRevert(template);
      if (delivery.status === "refused")
        fail(t("v1agent.history.notReverted", { reason: delivery.message }));
      else if (delivery.status === "uncertain")
        fail(unconfirmed(delivery.message));
      else setOpen(undefined);
    } catch (error) {
      fail(unconfirmed(message(error)));
    } finally {
      setReverting(undefined);
    }
  };

  const gapAction = (gap: Gap) =>
    gap === "unloaded" || gap === "failed" ? (
      <Button size="inline" variant="subtle" loading={loading} onClick={more}>
        {gap === "failed"
          ? t("v1agent.history.retry")
          : t("v1agent.history.loadOlder")}
      </Button>
    ) : null;

  const changes = (event: RelayEvent, before: RelayEvent | undefined) => {
    const problem = revisionProblem(expected, event, settings);
    if (problem)
      return (
        <p className="text-body-sm">
          {t("v1agent.history.invalid", { problem })}
        </p>
      );
    if (before && revisionProblem(expected, before, settings))
      return (
        <p className="text-body-sm">{t("v1agent.history.previousInvalid")}</p>
      );
    if (!before && artifactOp(event) !== "create")
      return (
        <p className="text-body-sm">{t("v1agent.history.previousUnloaded")}</p>
      );
    if (expected.type === "buzz.agent.settings") {
      const fields = settingsDiff(before?.content ?? "", event.content);
      return fields.length ? (
        <ul className={styles.diff} aria-label={t("v1agent.history.changes")}>
          {fields.map(({ field, before, after }) => (
            <li key={field}>
              {field}: {JSON.stringify(before) ?? "—"} →{" "}
              {JSON.stringify(after) ?? "—"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm">{t("v1agent.history.noChanges")}</p>
      );
    }
    return (
      // biome-ignore lint/a11y/useSemanticElements: The diff keeps preformatted lines and needs keyboard access.
      <pre
        className={styles.diff}
        role="region"
        aria-label={t("v1agent.history.changes")}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The scroll owner must support keyboard panning.
        tabIndex={0}
      >
        {lineDiff(
          before ? text(expected, before) : "",
          text(expected, event),
        ).map((line, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Lines have no identity beyond position.
            key={index}
            className={
              line.type === "added"
                ? styles.added
                : line.type === "removed"
                  ? styles.removed
                  : undefined
            }
          >
            {line.type === "added"
              ? "+ "
              : line.type === "removed"
                ? "− "
                : "  "}
            {line.text}
          </div>
        ))}
      </pre>
    );
  };

  const all = segments(history);
  const segment = all.find((part) =>
    part.revisions.some(({ id }) => id === open),
  );
  const index = segment?.revisions.findIndex(({ id }) => id === open) ?? -1;
  const event = segment?.revisions[index];
  const current = !!event && event.id === head?.id;
  const deleted = event && artifactOp(event) === "delete";
  const restorable =
    event &&
    head &&
    !current &&
    !deleted &&
    !revisionProblem(expected, event, settings);
  return (
    <section className="contents" aria-label={title}>
      {!history.revisions.length &&
        !history.failed &&
        !loading &&
        history.next > 0 && (
          <p className="text-body-sm">
            {t("v1agent.history.noRevisions", { title })}
          </p>
        )}
      {!history.revisions.length && history.failed && (
        <div className={styles.gap}>
          <span className={styles.label}>{gapText("failed")}</span>
          {gapAction("failed")}
        </div>
      )}
      {all.map((segment) =>
        segment.gap ? (
          <div className={styles.gap} key={segment.revisions[0]?.id}>
            <span className={`text-caption ${styles.label}`}>
              {title}: {gapText(segment.gap)}
            </span>
            {gapAction(segment.gap)}
          </div>
        ) : null,
      )}
      <Dialog
        open={!!open}
        onOpenChange={(next) => {
          if (!next) setOpen(undefined);
        }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t("v1agent.history.versionTitle", { title })}</span>{" "}
            {current && (
              <span className={`${styles.currentBadge} text-label-sm`}>
                {t("v1agent.history.current")}
              </span>
            )}
          </span>
        }
        description={
          event
            ? `${artifactOp(event)} · ${new Date(event.created_at * 1000).toLocaleString()}`
            : undefined
        }
        size="default"
        footerGap="compact"
        chromeSpacing="padded"
        preventClose={reverting !== undefined}
        actions={
          restorable && (
            <Button
              variant="prominent"
              loading={reverting !== undefined}
              onClick={() => void revert(event)}
            >
              {artifactOp(head) === "delete"
                ? t("v1agent.history.restore")
                : t("v1agent.history.revert")}
            </Button>
          )
        }
      >
        <div className="grid gap-2">
          {event ? (
            deleted ? (
              <p className="m-0 text-body-sm">{t("v1agent.history.removed")}</p>
            ) : (
              changes(event, segment?.revisions[index + 1])
            )
          ) : (
            <p className="m-0 text-body-sm">
              {loading
                ? t("v1agent.history.loadingVersion")
                : t("v1agent.history.notLoaded")}
            </p>
          )}
          {!event &&
            !loading &&
            (history.failed
              ? gapAction("failed")
              : !history.done && history.next <= HISTORY_MAX_OFFSET
                ? gapAction("unloaded")
                : null)}
          {event && failure?.id === event.id && (
            <p className={`text-body-sm ${styles.failure}`} role="alert">
              {failure.text}
            </p>
          )}
        </div>
      </Dialog>
    </section>
  );
}

/** A compact version target in the combined feed. */
export function AgentConfigVersionRow({
  event,
  head,
  expected,
  settings,
  label,
  onSelect,
}: {
  event: RelayEvent;
  head: RelayEvent | undefined;
  expected: Expected;
  settings?: SettingsCheck | undefined;
  label?: string;
  onSelect(): void;
}) {
  useClockFormat();
  useLanguage();
  const operation = artifactOp(event);
  const invalid =
    operation !== "delete" && revisionProblem(expected, event, settings);
  const nowSeconds = Date.now() / 1000;
  const timestamp =
    nowSeconds - event.created_at < 7 * 24 * 60 * 60
      ? relativeTimestamp(event.created_at, nowSeconds)
      : formatItemTimestamp(event.created_at, { nowSeconds });
  return (
    <li className={styles.row}>
      <Button
        size="inline"
        variant="plain"
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
        }}
        aria-haspopup="dialog"
        onClick={onSelect}
      >
        <span className="flex w-full min-w-0 items-center justify-between gap-3 text-body text-left">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">
              {label ?? t("v1agent.history.version")}
              {operation === "delete"
                ? ` · ${t("v1agent.history.deleted")}`
                : ""}
              {operation === "restore"
                ? ` · ${t("v1agent.history.restored")}`
                : ""}
              {operation === "move" ? ` · ${t("v1agent.history.moved")}` : ""}
              {event.id === head?.id && (
                <>
                  {" "}
                  <span className="sr-only">
                    · {t("v1agent.history.current")}
                  </span>
                </>
              )}
              {invalid ? ` · ${t("v1agent.history.notValid")}` : ""}
            </span>
            {event.id === head?.id && (
              <span
                className={styles.current}
                title={t("v1agent.history.currentVersion")}
                aria-hidden="true"
              />
            )}
          </span>{" "}
          <time
            className="shrink-0 whitespace-nowrap text-right text-secondary"
            dateTime={new Date(event.created_at * 1000).toISOString()}
            title={formatFullTimestamp(event.created_at)}
          >
            {timestamp}
          </time>
        </span>
      </Button>
    </li>
  );
}
