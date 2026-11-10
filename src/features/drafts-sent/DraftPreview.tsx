import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { t, useLanguage } from "../../shared/i18n";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ConversationChannel,
  ConversationComposer,
  ConversationThread,
  ConversationTimeline,
  useConversation,
} from "../conversation/Conversation";
import type { ConversationHostServices } from "../conversation/ConversationHost";
import type { ConversationExtensions } from "../conversation/contracts";
import {
  attachmentDraftCount,
  subscribeAttachmentDraftCounts,
} from "../messages/attachment-draft";
import { ChannelJoinNotice } from "../messages/ChannelJoinNotice";
import { MessageEditScope } from "../messages/MessageEditScope";
import { mentionDraft } from "../messages/mention-draft";
import type { RelaySession } from "../relay/session";
import type { ChannelSummary } from "../relay/contracts";
import { useChannelWindow } from "../relay/react";
import { readView, viewRevision } from "../../shared/view-state";
import { writeClipboardText } from "../../shared/clipboard";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import {
  PanelHeader,
  PanelHeaderLabel,
} from "../../shared/design-system/ui/PanelHeader";
import { LoadingRegion } from "../../shared/design-system/ui/LoadingRegion";
import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  ChatCircleIcon,
  XIcon,
} from "../../shared/design-system/icons";
import type { Entry } from "./model";
import styles from "./DraftsSent.module.css";

export function DraftPreview({
  entry,
  mode = "draft",
  title,
  channel,
  loading = false,
  session,
  host,
  extensions,
  autoFocus,
  onClose,
  onOpen,
  onSaved,
}: {
  entry: Entry;
  mode?: "draft" | "sent";
  title: string;
  channel: ChannelSummary | undefined;
  loading?: boolean;
  session: RelaySession;
  host: ConversationHostServices;
  extensions?: ConversationExtensions | undefined;
  autoFocus: boolean;
  onClose(): void;
  onOpen(): void;
  onSaved(restoreFocus: boolean): void;
}) {
  useLanguage();
  const region = useRef<HTMLElement>(null);
  const [sent, setSent] = useState<string>();
  const sending = useRef<string | undefined>(undefined);
  const [received, setReceived] = useState<string>();
  const attachmentCount = useSyncExternalStore(
    useCallback(
      (notify) => subscribeAttachmentDraftCounts(session, notify),
      [session],
    ),
    () => attachmentDraftCount(session, `${session.scope}:${entry.id}`),
  );
  // Receipts include fast echoes already retired from the pending outbox.
  // Observe delivery only; the composer still owns saving and recovery.
  useEffect(() => {
    let live = true;
    const stop = session.outbox?.observeSend((event) => () => {
      if (live && sending.current === event.id) setReceived(event.id);
    });
    return () => {
      live = false;
      stop?.();
    };
  }, [session]);
  const [cleaned, setCleaned] = useState<{
    revision: string | null | undefined;
  }>();
  useEffect(() => {
    if (
      mode === "draft" &&
      cleaned &&
      sent &&
      received === sent &&
      attachmentCount === 0 &&
      viewRevision(session.scope, entry.id) === cleaned.revision
    )
      onSaved(
        document.activeElement === document.body ||
          !!region.current?.contains(document.activeElement),
      );
  }, [
    cleaned,
    sent,
    received,
    session,
    entry.id,
    onSaved,
    mode,
    attachmentCount,
  ]);
  const sentMessage = (id: string) => {
    sending.current = id;
    setSent(id);
  };
  const draftSaved = () =>
    setCleaned({ revision: viewRevision(session.scope, entry.id) });
  const close = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const [copyStatus, setCopyStatus] = useState<DisplayMessage>("");
  const waiting =
    loading ||
    !!channel?.cached ||
    !!channel?.pending ||
    (!!channel && !channel.members);
  const writable =
    channel &&
    !channel.cached &&
    !channel.pending &&
    !channel.archived &&
    !channel.readOnly &&
    !!session.viewer &&
    channel.members?.includes(session.viewer);
  const readable =
    channel &&
    (channel.readOnly || channel.members?.includes(session.viewer ?? ""));
  useEffect(() => {
    const narrow = !!back.current?.getClientRects().length;
    // Sent never autofocuses its composer; a narrow open hides the list row.
    if (autoFocus && writable && (mode === "draft" || !narrow)) return;
    if (region.current?.contains(document.activeElement)) return;
    (narrow ? back.current : close.current)?.focus();
  }, [autoFocus, writable, mode]);
  async function copy() {
    try {
      const text = mentionDraft(readView(session.scope, entry.id, "")).text;
      if (!text) {
        setCopyStatus(localMessage("draftsSent.preview.copyEmpty"));
        return;
      }
      await writeClipboardText(text);
      setCopyStatus(localMessage("draftsSent.preview.copied"));
    } catch {
      setCopyStatus(localMessage("draftsSent.preview.copyFailed"));
    }
  }
  return (
    <section
      ref={region}
      className={styles.draftPreview}
      aria-label={t(
        mode === "draft"
          ? "draftsSent.preview.draftRegion"
          : "draftsSent.preview.sentRegion",
        { title },
      )}
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          event.shiftKey ||
          event.nativeEvent.isComposing ||
          event.nativeEvent.keyCode === 229 ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        event.stopPropagation();
        onClose();
      }}
    >
      <PanelHeader
        navigation={
          <span className={styles.draftBack}>
            <IconButton
              ref={back}
              size="sm"
              aria-label={t(
                mode === "draft"
                  ? "draftsSent.preview.backDraft"
                  : "draftsSent.preview.backSent",
              )}
              icon={<ArrowLeftIcon size="1rem" />}
              onClick={onClose}
            />
          </span>
        }
        title={
          <PanelHeaderLabel
            title={
              entry.threadRootId
                ? t("draftsSent.places.threadTitle", { title })
                : title
            }
          />
        }
        actions={
          <>
            <IconButton
              size="sm"
              aria-label={t("draftsSent.preview.open")}
              title={t("draftsSent.preview.open")}
              icon={<ArrowSquareOutIcon size="1rem" />}
              onClick={onOpen}
              disabled={!channel || channel.cached || channel.pending}
            />
            <span className={styles.draftClose}>
              <IconButton
                ref={close}
                size="sm"
                aria-label={
                  mode === "draft"
                    ? t("draftsSent.preview.closeDraft")
                    : t("draftsSent.preview.closeSent")
                }
                icon={<XIcon size="1rem" />}
                onClick={onClose}
              />
            </span>
          </>
        }
      />
      {waiting ? (
        <LoadingRegion pending label={t("draftsSent.preview.loading")}>
          {null}
        </LoadingRegion>
      ) : channel && (writable || (mode === "sent" && readable)) ? (
        <ConversationChannel
          session={session}
          scope={session.scope}
          channel={channel}
          host={host}
          extensions={extensions}
          threadId={entry.threadRootId}
          active={false}
        >
          {entry.threadRootId ? (
            <ConversationThread
              messageId={mode === "sent" ? entry.id : entry.threadRootId}
              revealSelected={mode === "sent"}
              revealFocus={false}
              requireReadyRoot={mode === "draft"}
              autoFocus={autoFocus && mode === "draft"}
              onDraftSaved={draftSaved}
              onSend={sentMessage}
              active={mode === "sent"}
            />
          ) : (
            <DraftChannel
              title={title}
              target={mode === "sent" ? entry : undefined}
              channel={channel}
              writable={!!writable}
              autoFocus={autoFocus && mode === "draft"}
              onSaved={draftSaved}
              onSend={sentMessage}
            />
          )}
        </ConversationChannel>
      ) : (
        <div className={styles.draftUnavailable}>
          <p className="text-body-sm text-subtle">
            {mode === "sent"
              ? t("draftsSent.preview.replyUnavailable")
              : channel
                ? t("draftsSent.preview.postUnavailable", { title })
                : t("draftsSent.preview.draftUnavailable")}
          </p>
          {mode === "draft" && (
            <Button size="sm" onClick={() => void copy()}>
              {t("draftsSent.preview.copy")}
            </Button>
          )}
          <p role="status" className="text-body-sm text-subtle">
            {resolveMessage(copyStatus)}
          </p>
        </div>
      )}
    </section>
  );
}

/** Borrows the shared channel reader, returning it to live history on exit. */
function DraftChannel({
  title,
  target,
  channel,
  writable,
  autoFocus,
  onSaved,
  onSend,
}: {
  title: string;
  target?: Entry | undefined;
  channel: ChannelSummary;
  writable: boolean;
  autoFocus: boolean;
  onSaved(): void;
  onSend(id: string): void;
}) {
  useLanguage();
  const { session, channelId } = useConversation();
  const channelWindow = useChannelWindow(session.channels, channelId);
  const [seekError, setSeekError] = useState(false);
  const [noticeHeight, setNoticeHeight] = useState(0);
  const [outgoing, setOutgoing] = useState<string>();
  const [reveal, setReveal] = useState<{
    messageId: string;
    signal: AbortSignal;
    focus: false;
  }>();
  useEffect(() => {
    if (!target) return;
    if (channelWindow.status !== "ready" || channelWindow.refreshing) return;
    const request = new AbortController();
    setSeekError(false);
    setReveal({
      messageId: outgoing ?? target.id,
      signal: request.signal,
      focus: false,
    });
    if (outgoing) {
      session.channels.attach?.(channelId);
      return () => request.abort();
    }
    void session.channels
      .seek?.(channelId, target.createdAt ?? 0, request.signal)
      .then(() => {
        if (!request.signal.aborted)
          setSeekError(
            !session.channels
              .window(channelId)
              .rows.some((row) => row.id === target.id),
          );
      })
      .catch(() => {
        if (!request.signal.aborted) setSeekError(true);
      });
    return () => {
      request.abort();
      session.channels.attach?.(channelId);
    };
  }, [
    session,
    channelId,
    target,
    outgoing,
    channelWindow.status,
    channelWindow.refreshing,
  ]);
  useEffect(() => {
    if (!target) session.channels.refresh?.(channelId);
  }, [session, channelId, target]);
  useEffect(() => {
    if (channelWindow.status === "idle") session.channels.ensure(channelId);
  }, [session, channelId, channelWindow.status]);
  return (
    <MessageEditScope>
      <div className={styles.draftConversation}>
        <div className={styles.draftHistory} data-reading-surface="">
          {seekError && (
            <p role="status" className={styles.sectionCopy}>
              {t("draftsSent.preview.seekFailed")}
            </p>
          )}
          {!!channelWindow.rows.length && (
            <ConversationTimeline
              window={channelWindow}
              transient
              inlineTarget={reveal}
            />
          )}
          {channelWindow.status === "error" || channelWindow.error ? (
            <div className={styles.draftUnavailable}>
              <p role="alert" className="text-body-sm">
                {channelWindow.error ?? t("draftsSent.preview.loadFailed")}
              </p>
              <Button
                size="sm"
                onClick={() => session.channels.refresh?.(channelId)}
              >
                {t("draftsSent.preview.retry")}
              </Button>
            </div>
          ) : (
            !channelWindow.rows.length &&
            (channelWindow.status === "ready" ? (
              <EmptyState
                icon={<ChatCircleIcon />}
                title={t("draftsSent.preview.noMessages")}
                description={t("draftsSent.preview.startConversation")}
              />
            ) : (
              <LoadingRegion pending label={t("draftsSent.preview.loading")}>
                {null}
              </LoadingRegion>
            ))
          )}
        </div>
        {!writable && (
          <div
            className={styles.channelNotice}
            style={{ height: noticeHeight }}
          >
            <ChannelJoinNotice
              channelId={channelId}
              ready={
                channelWindow.status === "ready" || !!channelWindow.rows.length
              }
              archived={!!channel.archived}
              guest={channel.viewerRole === "guest"}
              joinRole={channel.joinRole}
              place={channel.channelType === "solo" ? "chat" : "channel"}
              lifecycle={session.channelLifecycle}
              joinable={
                !!channel.readOnly &&
                (channel.channelType === "stream" ||
                  channel.channelType === "forum" ||
                  (channel.channelType === "solo" &&
                    channel.joinRole === "guest"))
              }
              onJoin={() => {}}
              onHeightChange={setNoticeHeight}
            />
          </div>
        )}
        {writable && (
          <ConversationComposer
            label={t("draftsSent.preview.composer", { title })}
            autoFocus={autoFocus}
            onDraftSaved={onSaved}
            onSend={(id) => {
              setOutgoing(id);
              onSend(id);
            }}
          />
        )}
      </div>
    </MessageEditScope>
  );
}
