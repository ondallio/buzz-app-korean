import { t, useLanguage } from "../../shared/i18n";
import { useRef, useState } from "react";
import type { ComposerSession } from "./composer-session";
import { canAddMembers } from "../channel-members/members";
import type { MentionRecipient } from "./mention-draft";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Button } from "../../shared/design-system/ui/Button";

type Pending = {
  people: readonly MentionRecipient[];
  signal: AbortSignal;
  current(): boolean;
  finish(references: readonly string[] | null): void;
  busy: boolean;
  error?: string;
};

/** One consent decision for a captured send. The session owns durable additions. */
export function useNonmemberMentions(
  session: ComposerSession,
  channelId: string,
  restoreFocus: () => void,
) {
  useLanguage();
  const [pending, setPending] = useState<Pending>();
  const adding = useRef(false);
  // Mentioning someone outside the channel usually means you want them here,
  // so Enter right after Send invites. Escape and Close keep the draft unsent.
  const inviteAction = useRef<HTMLButtonElement>(null);
  const channel = session.channels
    .list()
    .channels.find((item) => item.id === channelId);
  const canAdd = !!channel && canAddMembers(session, channel);
  async function add() {
    if (!pending || adding.current || !canAdd) return;
    adding.current = true;
    const request = pending;
    const check = () => {
      request.signal.throwIfAborted();
      if (!request.current()) throw new Error(t("v1msg.draftChanged"));
    };
    setPending({ ...request, busy: true });
    try {
      check();
      // Requested together, so they go to the relay together.
      const failed = (
        await Promise.allSettled(
          request.people.map((person) =>
            session.memberAdditions.add(channelId, person.pubkey),
          ),
        )
      ).find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
      check();
      request.finish([]);
    } catch (reason) {
      if (!request.signal.aborted)
        setPending({
          ...request,
          busy: false,
          error: reason instanceof Error ? reason.message : String(reason),
        });
    } finally {
      adding.current = false;
    }
  }
  return {
    prepare(
      people: readonly MentionRecipient[],
      signal: AbortSignal,
      current: () => boolean,
    ) {
      signal.throwIfAborted();
      return new Promise<readonly string[] | null>((resolve) => {
        const finish = (references: readonly string[] | null) => {
          signal.removeEventListener("abort", abort);
          setPending(undefined);
          resolve(references);
        };
        const abort = () => finish(null);
        signal.addEventListener("abort", abort, { once: true });
        setPending({ people, signal, current, finish, busy: false });
      });
    },
    dialog: (
      <Dialog
        size="compact"
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) pending?.finish(null);
        }}
        title={t("v1msg.nonmember.title")}
        description={pending && describe(pending.people, canAdd)}
        preventClose={!!pending?.busy}
        initialFocus={canAdd ? inviteAction : undefined}
        finalFocus={() => {
          restoreFocus();
          return false;
        }}
        actions={
          <>
            <Button
              type="button"
              disabled={pending?.busy}
              onClick={() =>
                pending?.finish(pending.people.map((person) => person.pubkey))
              }
            >
              {canAdd
                ? t("v1msg.nonmember.doNothing")
                : t("v1msg.nonmember.sendAnyway")}
            </Button>
            {canAdd && (
              <Button
                ref={inviteAction}
                type="button"
                variant="prominent"
                disabled={pending?.busy}
                onClick={() => void add()}
              >
                {pending?.busy
                  ? t("v1msg.nonmember.inviting")
                  : t("v1msg.nonmember.invite")}
              </Button>
            )}
          </>
        }
      >
        {pending?.error ? (
          <p role="alert">
            {t("v1msg.nonmember.error", { error: pending.error })}
          </p>
        ) : null}
      </Dialog>
    ),
  };
}

/** Match block/buzz desktop: name the people, then the available outcome. */
function describe(people: readonly MentionRecipient[], canAdd: boolean) {
  const names = people.map((person) => person.name).join(", ");
  return `${
    people.length === 1
      ? t("v1msg.nonmember.notInOne", { names })
      : t("v1msg.nonmember.notInMany", { names })
  } ${
    canAdd ? t("v1msg.nonmember.canInvite") : t("v1msg.nonmember.cannotInvite")
  }`;
}
