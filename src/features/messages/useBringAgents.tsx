import { t, useLanguage } from "../../shared/i18n";
import { useRef, useState } from "react";
import type { ComposerSession } from "./composer-session";
import { canAddMembers } from "../channel-members/members";
import { communityHost } from "./community-host";
import type { Agent, Agents } from "../agents/service";
import { sameAgent } from "../agents/AgentManage";
import { splitPartition } from "../relay/partition";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Button } from "../../shared/design-system/ui/Button";

const sentence = (text: string) => text.replace(/\.?$/, ".");
const named = (agents: readonly Agent[]) =>
  agents.map((agent) => agent.name).join(", ");

type Pending = {
  agents: readonly Agent[];
  signal: AbortSignal;
  current(): boolean;
  finish(added: readonly string[] | null): void;
  /** What a retry must not repeat, and what the owner is told afterwards. */
  progress: { joined: Set<string>; added: Set<string>; notes: string[] };
  /** Everything is done but some details did not carry over; sending is next. */
  reviewed?: true;
  busy: boolean;
  error?: string;
};

/**
 * One consent decision before a send brings the owner's agents from their other
 * communities into this one. Declining or closing sends nothing; the draft and
 * its mention stay. Resolves with the keys added to the channel, or null.
 */
export function useBringAgents(
  session: ComposerSession,
  agents: Agents | undefined,
  channelId: string,
  restoreFocus: () => void,
) {
  useLanguage();
  const [pending, setPending] = useState<Pending>();
  const working = useRef(false);
  const safeAction = useRef<HTMLButtonElement>(null);
  // Read only while it asks, not on every render of the composer.
  const channel =
    pending &&
    session.channels.list().channels.find((item) => item.id === channelId);
  const canAdd = !!channel && canAddMembers(session, channel);
  const here =
    (pending &&
      communityHost(splitPartition(session.scope)?.communityOrigin ?? "")) ??
    t("v1msg.bring.thisCommunity");
  async function bring() {
    if (!pending || !agents || working.current) return;
    working.current = true;
    const request = pending;
    const { joined, added, notes } = request.progress;
    const check = () => {
      request.signal.throwIfAborted();
      if (!request.current()) throw new Error(t("v1msg.draftChanged"));
    };
    setPending({ ...request, busy: true });
    try {
      for (const agent of request.agents) {
        check();
        if (!joined.has(agent.pubkey)) {
          // Another window may have brought it meanwhile.
          if (agents.find(agent.pubkey)?.place !== "here")
            notes.push(...(await agents.join(agent.key)).notes);
          joined.add(agent.pubkey);
        }
      }
      check();
      // Requested together, so they go to the relay together.
      const results = await Promise.allSettled(
        canAdd
          ? request.agents
              .filter((agent) => !added.has(agent.pubkey))
              .map((agent) =>
                session.memberAdditions
                  .add(channelId, agent.pubkey)
                  .then(() => added.add(agent.pubkey)),
              )
          : [],
      );
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
      check();
      if (notes.length) setPending({ ...request, busy: false, reviewed: true });
      else request.finish([...added]);
    } catch (reason) {
      if (!request.signal.aborted)
        setPending({
          ...request,
          busy: false,
          error: sentence(
            reason instanceof Error ? reason.message : String(reason),
          ),
        });
    } finally {
      working.current = false;
    }
  }
  const many = (pending?.agents.length ?? 0) > 1;
  const brought =
    pending?.agents.filter((agent) =>
      pending.progress.joined.has(agent.pubkey),
    ) ?? [];
  return {
    prepare(
      people: readonly Agent[],
      signal: AbortSignal,
      current: () => boolean,
    ) {
      signal.throwIfAborted();
      return new Promise<readonly string[] | null>((resolve) => {
        const finish = (added: readonly string[] | null) => {
          signal.removeEventListener("abort", abort);
          setPending(undefined);
          resolve(added);
        };
        const abort = () => finish(null);
        signal.addEventListener("abort", abort, { once: true });
        setPending({
          agents: people,
          signal,
          current,
          finish,
          progress: { joined: new Set(), added: new Set(), notes: [] },
          busy: false,
        });
      });
    },
    dialog: (
      <Dialog
        size="compact"
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) pending?.finish(null);
        }}
        title={
          pending &&
          (pending.reviewed
            ? many
              ? t("v1msg.bring.inPlaceMany", {
                  names: named(pending.agents),
                  place: here,
                })
              : t("v1msg.bring.inPlaceOne", {
                  name: named(pending.agents),
                  place: here,
                })
            : t("v1msg.bring.title", {
                names: named(pending.agents),
                place: here,
              }))
        }
        description={
          pending && describe(pending.agents, canAdd, !!pending.reviewed)
        }
        preventClose={!!pending?.busy}
        // Bringing an agent changes who is in the channel, so Enter starts on
        // declining while Bring and Send retain their action styling.
        initialFocus={safeAction}
        finalFocus={() => {
          restoreFocus();
          return false;
        }}
        actions={
          <>
            <Button
              ref={safeAction}
              type="button"
              disabled={pending?.busy}
              onClick={() => pending?.finish(null)}
            >
              {pending?.reviewed
                ? t("v1msg.bring.dontSend")
                : t("v1msg.bring.dontBring")}
            </Button>
            <Button
              type="button"
              variant="prominent"
              // Keeps its label and focus, so Enter goes on to Send.
              loading={!!pending?.busy}
              onClick={() =>
                pending?.reviewed
                  ? pending.finish([...pending.progress.added])
                  : void bring()
              }
            >
              {pending?.reviewed
                ? t("messageActions.queue.send")
                : many
                  ? t("v1msg.bring.confirmMany")
                  : t("v1msg.bring.confirmOne")}
            </Button>
          </>
        }
      >
        {pending?.progress.notes.length ? (
          <p role="status">{pending.progress.notes.join(" ")}</p>
        ) : null}
        {pending?.error ? (
          <p role="alert">
            {t("v1msg.bring.errorKept", { error: pending.error })}
            {brought.length
              ? ` ${
                  brought.length > 1
                    ? t("v1msg.bring.nowInMany", {
                        names: named(brought),
                        place: here,
                      })
                    : t("v1msg.bring.nowInOne", {
                        name: named(brought),
                        place: here,
                      })
                }`
              : ""}
          </p>
        ) : null}
      </Dialog>
    ),
  };
}

function describe(
  agents: readonly Agent[],
  canAdd: boolean,
  reviewed: boolean,
) {
  const many = agents.length > 1;
  if (reviewed)
    return many ? t("v1msg.bring.reviewedMany") : t("v1msg.bring.reviewedOne");
  const other = [
    ...new Set(
      agents.map(
        (agent) =>
          communityHost(agent.relay) ?? t("v1msg.bring.otherCommunity"),
      ),
    ),
  ].join(", ");
  const intro = many
    ? t("v1msg.bring.describeMany", { place: other, details: sameAgent(true) })
    : t("v1msg.bring.describeOne", {
        name: agents[0]?.name ?? "",
        place: other,
        details: sameAgent(),
      });
  if (canAdd) return intro;
  return `${intro} ${
    many ? t("v1msg.bring.cannotAddMany") : t("v1msg.bring.cannotAddOne")
  }`;
}
