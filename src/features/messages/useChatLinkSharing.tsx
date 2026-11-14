import { t, useLanguage } from "../../shared/i18n";
import { useRef, useState } from "react";
import type { RelaySession } from "../relay/session";
import type {
  ChannelDetails,
  ChannelDetailsDraft,
} from "../relay/channel-details-protocol";
import { chatShareDestination, shareSoloChatAccess } from "../solo/share";
import { ownSolo, soloShareDisclosure } from "../solo/labels";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";

type Pending = {
  sources: readonly [ChannelDetails, ...ChannelDetails[]];
  signal: AbortSignal;
  check(): void;
  finish(send: boolean): void;
  attempts: Map<string, ChannelDetailsDraft>;
  destination: string;
  busy: boolean;
  error?: string;
  checkRequired?: boolean;
};

/** Confirm community reading; the composer owns sending its original message once. */
export function useChatLinkSharing(
  session: RelaySession | undefined,
  channelId: string,
  restoreFocus: () => void,
) {
  useLanguage();
  const [pending, setPending] = useState<Pending>();
  const privateCount =
    pending?.sources.filter((base) => base.visibility === "private").length ??
    0;
  const running = useRef(false);
  const proceed = useRef<HTMLButtonElement>(null);
  async function share() {
    if (!session || !pending || running.current) return;
    const request = pending;
    running.current = true;
    setPending({ ...request, busy: true });
    let checking: ChannelDetails | undefined;
    try {
      for (const base of request.sources) {
        checking = base;
        await shareSoloChatAccess(session, base.channelId, {
          signal: request.signal,
          confirmed: base,
          attempts: request.attempts,
          check: request.check,
        });
      }
      request.check();
      request.finish(true);
    } catch (reason) {
      if (request.signal.aborted) return;
      const checkRequired = request.sources.some(({ channelId: id }) => {
        const attempt = session.channelDetails.snapshot(id);
        return (
          attempt?.status === "unconfirmed" &&
          attempt.draft === request.attempts.get(id)
        );
      });
      if (checking && !checkRequired) {
        try {
          const options = {
            signal: request.signal,
            attempts: request.attempts,
            check: request.check,
          };
          const fresh = await shareSoloChatAccess(
            session,
            checking.channelId,
            options,
          );
          if (fresh && fresh.version !== checking.version) {
            const sources: ChannelDetails[] = [];
            for (const { channelId: id } of request.sources) {
              const base =
                id === fresh.channelId
                  ? fresh
                  : await shareSoloChatAccess(session, id, options);
              if (base) sources.push(base);
            }
            request.check();
            const [first, ...rest] = sources;
            if (first) {
              const { error: _, checkRequired: __, ...current } = request;
              setPending({
                ...current,
                sources: [first, ...rest],
                busy: false,
              });
              return;
            }
          }
        } catch {
          // Keep the original failure if current consent cannot be read safely.
        }
      }
      if (request.signal.aborted) return;
      setPending({
        ...request,
        busy: false,
        error: reason instanceof Error ? reason.message : String(reason),
        checkRequired,
      });
    } finally {
      running.current = false;
    }
  }
  return {
    async prepare(
      sources: readonly string[],
      signal: AbortSignal,
      current: () => boolean,
    ): Promise<boolean> {
      signal.throwIfAborted();
      if (!session) return true;
      const list = session.channels.list().channels;
      const destination = list.find((channel) => channel.id === channelId);
      if (!chatShareDestination(destination)) return true;
      const check = () => {
        signal.throwIfAborted();
        if (!current()) throw new Error(t("v1msg.draftChanged"));
      };
      const attempts = new Map<string, ChannelDetailsDraft>();
      const confirmingChats: ChannelDetails[] = [];
      for (const id of new Set(sources)) {
        if (
          !ownSolo(
            list.find((channel) => channel.id === id),
            session.viewer,
          )
        )
          continue;
        const base = await shareSoloChatAccess(session, id, {
          signal,
          attempts,
          check,
        });
        if (base) confirmingChats.push(base);
      }
      check();
      const [first, ...rest] = confirmingChats;
      if (!first) return true;
      return new Promise((resolve) => {
        let settled = false;
        const finish = (send: boolean) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", abort);
          setPending(undefined);
          resolve(send);
        };
        const abort = () => finish(false);
        signal.addEventListener("abort", abort, { once: true });
        setPending({
          sources: [first, ...rest],
          signal,
          check,
          finish,
          attempts,
          destination:
            destination?.channelType === "dm"
              ? t("v1msg.share.thisDm")
              : `#${destination?.name ?? t("v1msg.share.channel")}`,
          busy: false,
        });
      });
    },
    dialog: pending && (
      <AlertDialog
        key={pending.sources.map((base) => base.version).join(":")}
        title={
          pending.sources.length > 1
            ? t("v1msg.share.titleMany")
            : t("v1msg.share.titleOne")
        }
        description={
          <>
            {privateCount === pending.sources.length
              ? pending.sources.length > 1
                ? t("v1msg.share.changeMany", {
                    destination: pending.destination,
                  })
                : t("v1msg.share.changeOne", {
                    destination: pending.destination,
                  })
              : `${
                  privateCount
                    ? t("v1msg.share.mixed")
                    : pending.sources.length > 1
                      ? t("v1msg.share.alreadyMany")
                      : t("v1msg.share.alreadyOne")
                } ${
                  pending.sources.length > 1
                    ? t("v1msg.share.sendLinksMany", {
                        destination: pending.destination,
                      })
                    : t("v1msg.share.sendLinksOne", {
                        destination: pending.destination,
                      })
                }`}{" "}
            <span className="mt-3 block">
              {soloShareDisclosure(pending.sources.length > 1)}
              {pending.sources.length > 1
                ? ` ${t("v1msg.share.appliesTo", {
                    names: pending.sources.map((base) => base.name).join(", "),
                  })}`
                : ""}
            </span>
          </>
        }
        onClose={() => pending.finish(false)}
        pending={pending.busy}
        initialFocus={proceed}
        finalFocus={() => {
          restoreFocus();
          return false;
        }}
        actions={
          <>
            <Button
              disabled={pending.busy}
              onClick={() => pending.finish(false)}
            >
              {t("messages.cancel")}
            </Button>
            <Button
              ref={proceed}
              variant="prominent"
              loading={pending.busy}
              onClick={() => void share()}
            >
              {pending.checkRequired
                ? t("v1msg.share.checkAndSend")
                : pending.error
                  ? t("v1msg.share.retryAndSend")
                  : t("v1msg.share.share")}
            </Button>
          </>
        }
      >
        {pending.error && (
          <p role="alert">{t("v1msg.share.error", { error: pending.error })}</p>
        )}
      </AlertDialog>
    ),
  };
}
