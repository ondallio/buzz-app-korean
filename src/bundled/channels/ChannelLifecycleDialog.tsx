import { t, useLanguage } from "../../shared/i18n";
import {
  localMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { TranslatedMessage } from "../../shared/i18n/Message";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import type { ChannelLifecycleCapability } from "../../features/relay/channel-lifecycle";
import type { ChannelLifecycleAction } from "../../features/relay/channel-lifecycle-protocol";
import { Dialog, type DialogProps } from "../../shared/design-system/ui/Dialog";
import {
  ToastNotice,
  useToastNotification,
} from "../../shared/design-system/ui/Toast";

export type LifecycleNoun = "channel" | "chat";

/** Solo chats are channels on the relay; people should read them as chats. */
export const lifecycleNoun = (
  channel: Readonly<{ channelType?: string | undefined }> | undefined,
): LifecycleNoun => (channel?.channelType === "solo" ? "chat" : "channel");

/** Complete display-message keys; canonical action/noun values stay untranslated. */
export function lifecycleMessageKeys(
  action: ChannelLifecycleAction,
  noun: LifecycleNoun,
) {
  const prefix =
    action === "hide"
      ? "channelsMenus.lifecycle.hide"
      : (`channelsMenus.lifecycle.${noun}.${action}` as const);
  return {
    title: `${prefix}.title`,
    pending: `${prefix}.pending`,
    success: `${prefix}.success`,
    failure: `${prefix}.failure`,
    namedTitle: `${prefix}.namedTitle`,
    detail: `${prefix}.detail`,
  } as const;
}

// Enter confirms unarchive and hide. Archive affects everyone, so it starts on
// Cancel while retaining the action's prominent treatment.
const reversible = new Set<ChannelLifecycleAction>(["unarchive", "hide"]);

export function ChannelLifecycleDialog({
  channelId,
  channelName,
  noun = "channel",
  action,
  lifecycle,
  close,
  completed,
  onSubmit,
  failed,
  finalFocus,
  confirmed = false,
  undo,
  autoJoin = false,
}: {
  channelId: string;
  channelName: string;
  noun?: LifecycleNoun;
  action: ChannelLifecycleAction;
  lifecycle: ChannelLifecycleCapability;
  close(): void;
  completed(): void;
  onSubmit?(): void;
  finalFocus?: DialogProps["finalFocus"];
  failed?(title: DisplayMessage, message: string): void;
  /** Already chosen without a dialog, as Undo is: run it on mount. */
  confirmed?: boolean;
  /** Offered from an immediate archive's result toast. */
  undo?(): void;
  /** A starter channel: the relay keeps the flag while archived. */
  autoJoin?: boolean;
}) {
  useLanguage();
  const callbacks = useRef({ completed, failed });
  useLayoutEffect(() => {
    callbacks.current = { completed, failed };
  });
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const confirms = reversible.has(action);
  const copy = lifecycleMessageKeys(action, noun);
  // The switch is hidden while archived, and Unarchive applies the flag again.
  const description =
    action === "archive" && autoJoin
      ? t(`channelsMenus.lifecycle.${noun}.archive.starterDetail`)
      : t(copy.detail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notify = useToastNotification();
  const operation = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    return () => {
      operation.current?.abort();
    };
  }, []);
  // Archiving a chat is undoable from its result toast, so it skips
  // confirmation; channels archive for everyone and still confirm. Undo was
  // chosen from that toast, so it runs at once too.
  // Deferring the start lets a development StrictMode remount cancel it.
  const immediate = confirmed || (action === "archive" && noun === "chat");
  // biome-ignore lint/correctness/useExhaustiveDependencies: start once per mounted archive request.
  useEffect(() => {
    if (!immediate) return;
    const timer = setTimeout(() => void submit());
    return () => clearTimeout(timer);
  }, []);
  // Without a confirmation to dismiss, a fast archive needs no progress
  // feedback: the result toast follows. Announce only a slow write.
  const [slow, setSlow] = useState(!immediate);
  useEffect(() => {
    if (!immediate || !busy) return;
    const timer = setTimeout(() => setSlow(true), 1000);
    return () => clearTimeout(timer);
  }, [immediate, busy]);
  const submit = async () => {
    if (operation.current || error) return;
    const controller = new AbortController();
    operation.current = controller;
    onSubmit?.();
    setBusy(true);
    setError("");
    try {
      await lifecycle.run(action, channelId, controller.signal);
      if (!controller.signal.aborted) {
        notify(
          <TranslatedMessage
            value={localMessage(copy.success, { name: channelName })}
          />,
          "success",
          immediate && action === "archive" && undo
            ? {
                label: (
                  <TranslatedMessage
                    value={localMessage("channelsMenus.undo")}
                  />
                ),
                onClick: undo,
                timeout: 3000,
              }
            : undefined,
        );
        callbacks.current.completed();
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        if (callbacks.current.failed)
          callbacks.current.failed(localMessage(copy.failure), message);
        else setError(message);
      }
    } finally {
      operation.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  // Keep the owner mounted while closing the modal, so shared focus restoration
  // runs and the caller's duplicate gate remains held until the result settles.
  return (
    <>
      {((busy && slow) || error) && (
        <ToastNotice
          title={busy ? t(copy.pending) : t(copy.failure)}
          description={busy ? channelName : error}
          tone={busy ? "info" : "error"}
          {...(!busy && { onDismiss: close })}
        />
      )}
      <Dialog
        size="compact"
        open={!immediate && !busy && !error}
        dismissOnOutsideClick
        initialFocus={confirms ? confirm : cancel}
        // Cancellation remains sidebar-owned; submission returns to the trigger.
        finalFocus={busy || error ? finalFocus : false}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={
          action === "delete"
            ? t("channelsMenus.deleteNamed", { name: channelName })
            : t(copy.namedTitle, { name: channelName })
        }
        description={description}
        actions={
          <>
            <Button ref={cancel} type="button" onClick={close}>
              {t("channelsMenus.cancel")}
            </Button>
            <Button
              type="button"
              ref={confirm}
              variant={
                action === "delete"
                  ? "destructive"
                  : action === "archive" || confirms
                    ? "prominent"
                    : "subtle"
              }
              onClick={() => void submit()}
            >
              {t(copy.title)}
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </>
  );
}
