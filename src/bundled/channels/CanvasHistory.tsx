import { t, useLanguage } from "../../shared/i18n";
import {
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  CanvasHistoryCursor,
  CanvasHistoryPage,
  ChannelCanvas,
} from "../../features/channel-templates/capability";
import {
  LIVE_CANVAS_BYTES,
  LIVE_CANVAS_LIMIT,
} from "../../features/channel-templates/model";
import type { RelayEvent } from "../../features/relay/events";
import type { ProfileQueries } from "../../features/relay/profile-directory";
import { useProfileGeneration } from "../../features/relay/react";
import { selectProfiles } from "../../features/relay/profile-selection";
import { publicKeyLabels } from "../../shared/identity/public-key";
import { Checkbox } from "../../shared/design-system/ui/Checkbox";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { LoadingRegion } from "../../shared/design-system/ui/LoadingRegion";
import { Field } from "../../shared/design-system/ui/Field";
import { Radio, RadioGroup } from "../../shared/design-system/ui/RadioGroup";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { CanvasDiff } from "./CanvasDiff";
import styles from "./ChannelTemplates.module.css";

export function CanvasHistory({
  canvas,
  channelId,
  profiles: queries,
  head,
  busy,
  loaded,
  dirty,
  refreshHead,
  retryHead,
  comparisonRef,
  retryRef,
  restore,
  readOnly = false,
}: {
  canvas: ChannelCanvas;
  channelId: string;
  profiles: ProfileQueries;
  head: RelayEvent | undefined;
  busy: boolean;
  /** `head` is loaded and the latest read of it succeeded. */
  loaded: boolean;
  dirty: boolean;
  readOnly?: boolean;
  refreshHead(): Promise<void>;
  /** Retries a failed head read from `retryRef`, which keeps focus. */
  retryHead(): void;
  comparisonRef?: Ref<HTMLDivElement>;
  retryRef?: Ref<HTMLButtonElement>;
  restore(revision: RelayEvent): Promise<void>;
}) {
  useLanguage();
  const [page, setPage] = useState<CanvasHistoryPage>();
  const [selected, setSelected] = useState<RelayEvent>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [full, setFull] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  const proceed = useRef<HTMLButtonElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const attempted = useRef(false);
  const rows = useRef<HTMLDivElement>(null);
  const focusRevision = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (focusRevision.current && page) {
      rows.current
        ?.querySelector<HTMLElement>(
          `[data-revision="${focusRevision.current}"]`,
        )
        ?.focus();
      focusRevision.current = undefined;
    }
  }, [page]);
  const keys = (page?.revisions ?? [])
    .map((event) => event.pubkey)
    .sort()
    .join(":");
  const ids = useMemo(() => [...new Set(keys ? keys.split(":") : [])], [keys]);
  const selection = useMemo(() => selectProfiles(queries, ids), [queries, ids]);
  const profiles = useSyncExternalStore(
    selection.subscribe,
    selection.snapshot,
    selection.snapshot,
  );
  const labels = publicKeyLabels(ids);
  // History stays mounted read-only after the channel is lost. Its loaded
  // authors may be known only from that channel, so a purge while it is
  // read-only must not read them back.
  const purges = useProfileGeneration(queries);
  const writableGeneration = useRef(purges);
  if (!readOnly) writableGeneration.current = purges;
  const profileGeneration = writableGeneration.current;
  useEffect(() => {
    void profileGeneration;
    void queries.ensure(ids, "background").catch(() => {});
  }, [queries, ids, profileGeneration]);
  const load = useCallback(
    async (cursor?: CanvasHistoryCursor) => {
      const current = ++generation.current;
      setLoading(true);
      setError("");
      try {
        const result = await canvas.history(channelId, cursor);
        if (current !== generation.current) return;
        setPage((previous) => ({
          ...result,
          revisions: cursor
            ? [...(previous?.revisions ?? []), ...result.revisions]
            : result.revisions,
        }));
        if (cursor)
          focusRevision.current =
            result.revisions[0]?.id ??
            rows.current?.querySelector<HTMLElement>('[aria-checked="true"]')
              ?.dataset.revision;
        if (!cursor)
          setSelected(
            (previous) =>
              result.revisions.find((row) => row.id === previous?.id) ??
              result.revisions[0],
          );
        setNotice(
          result.revisions.length
            ? t("v1shell.canvas.revisionsLoaded", {
                count: result.revisions.length,
              })
            : t("v1shell.canvas.noMoreRevisions"),
        );
      } catch (reason) {
        if (current === generation.current) setError(String(reason));
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [canvas, channelId],
  );
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
    // This panel is keyed by the owning channel/session and mounted lazily.
  }, [load]);
  // A head read that has failed stays failed through its retry, so Retry
  // keeps its place and focus until a read lands.
  const [headFailed, setHeadFailed] = useState(false);
  if (loaded ? headFailed : !busy && !headFailed) setHeadFailed(!loaded);
  const headContent = head?.content ?? "";
  const fullContent = (note?: string) => (
    <>
      {note && <p>{note}</p>}
      <Textarea
        aria-label={t("v1shell.canvas.revisionMarkdown")}
        variant="code"
        rows={10}
        readOnly
        value={selected?.content ?? ""}
      />
    </>
  );
  const tooLarge =
    selected &&
    new TextEncoder().encode(selected.content).length > LIVE_CANVAS_BYTES;
  const apply = async () => {
    if (!selected || readOnly) return;
    const current = ++generation.current;
    attempted.current = true;
    try {
      await restore(selected);
      if (current !== generation.current) return;
      setNotice(t("v1shell.canvas.restored"));
    } catch (reason) {
      if (current !== generation.current) return;
      setError(reason instanceof Error ? reason.message : String(reason));
    }
    setConfirm(false);
    setLoading(true);
    // Even an error can follow an accepted publication. Reconcile without
    // clearing its outcome or automatically retrying the write.
    try {
      const result = await canvas.history(channelId);
      if (current !== generation.current) return;
      setPage(result);
      setSelected(
        (previous) =>
          result.revisions.find((row) => row.id === previous?.id) ??
          result.revisions[0],
      );
    } catch (reason) {
      if (current === generation.current)
        setError(
          (previous) =>
            `${previous ? `${previous} ` : ""}${t("v1shell.canvas.historyRefreshFailed", { error: String(reason) })}`,
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  return (
    <div className={styles.stack}>
      <div className={styles.actions}>
        <Button
          ref={refreshButton}
          loading={loading || busy}
          onClick={() => {
            void refreshHead();
            void load();
          }}
        >
          {t("v1shell.canvas.refreshHistory")}
        </Button>
        <span role="status">
          {loading ? t("v1shell.canvas.loadingHistory") : notice}
        </span>
      </div>
      {page && !page.revisions.length && (
        <p>{t("v1shell.canvas.noRevisions")}</p>
      )}
      {page && page.revisions.length > 0 && (
        <>
          <div ref={rows} className={styles.choices}>
            <Field label={t("v1shell.canvas.savedRevisions")}>
              <RadioGroup
                value={selected?.id ?? ""}
                disabled={busy}
                onValueChange={(id) =>
                  setSelected(page.revisions.find((row) => row.id === id))
                }
              >
                {page.revisions.map((event) => (
                  <Radio
                    key={event.id}
                    value={event.id}
                    data-revision={event.id}
                    label={
                      <>
                        <time
                          dateTime={new Date(
                            event.created_at * 1000,
                          ).toISOString()}
                        >
                          {new Date(event.created_at * 1000).toLocaleString()}
                        </time>
                        {event.id === head?.id
                          ? t("v1shell.canvas.currentSuffix")
                          : ""}
                      </>
                    }
                    description={`${profiles.get(event.pubkey)?.name ?? labels.get(event.pubkey)} · ${event.id.slice(0, 8)}`}
                  />
                ))}
              </RadioGroup>
            </Field>
          </div>
          {page.next && (
            <Button
              disabled={busy}
              loading={loading}
              onClick={() => void load(page.next)}
            >
              {t("v1shell.canvas.loadOlder")}
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {selected && (
        <>
          <Checkbox
            label={t("v1shell.canvas.showFull")}
            checked={full}
            onCheckedChange={setFull}
          />
          <div ref={comparisonRef} tabIndex={-1}>
            {!loaded ? (
              <LoadingRegion
                pending={busy}
                label={t("v1shell.canvas.readingCurrent")}
                feedback={
                  headFailed ? (
                    <div className={styles.actions}>
                      <p role="alert">{t("v1shell.canvas.readFailed")}</p>
                      <Button ref={retryRef} loading={busy} onClick={retryHead}>
                        {t("channelForms.retry")}
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                {fullContent()}
              </LoadingRegion>
            ) : full ? (
              fullContent()
            ) : selected.id === head?.id || selected.content === headContent ? (
              <p>{t("v1shell.canvas.sameAsCurrent")}</p>
            ) : (
              <CanvasDiff
                current={headContent}
                revision={selected.content}
                fallback={fullContent}
              />
            )}
          </div>
          {!selected.content && <p>{t("v1shell.canvas.versionEmpty")}</p>}
          {tooLarge && (
            <p>
              {t("v1shell.canvas.tooLarge", {
                limit: LIVE_CANVAS_LIMIT,
              })}
            </p>
          )}
          <div className={styles.actions}>
            <Button
              ref={restoreButton}
              variant="prominent"
              disabled={
                readOnly ||
                !loaded ||
                busy ||
                loading ||
                !canvas.available ||
                selected.id === head?.id ||
                !!tooLarge
              }
              onClick={() => {
                setError("");
                attempted.current = false;
                setConfirm(true);
              }}
            >
              {t("v1shell.canvas.restoreThis")}
            </Button>
          </div>
        </>
      )}
      <Dialog
        size="compact"
        open={confirm}
        onOpenChange={setConfirm}
        title={t("v1shell.canvas.restoreTitle")}
        description={t("v1shell.canvas.restoreDescription")}
        initialFocus={proceed}
        finalFocus={() =>
          attempted.current ? refreshButton.current : restoreButton.current
        }
        preventClose={busy}
        dismissOnOutsideClick
        actions={
          <>
            <Button disabled={busy} onClick={() => setConfirm(false)}>
              {t("channelForms.cancel")}
            </Button>
            <Button
              ref={proceed}
              variant="prominent"
              loading={busy}
              disabled={readOnly}
              onClick={() => void apply()}
            >
              {t("v1shell.canvas.restoreVersion")}
            </Button>
          </>
        }
      >
        {dirty && <p>{t("v1shell.canvas.draftKeptRestore")}</p>}
      </Dialog>
    </div>
  );
}
