import { t } from "../../shared/i18n";
import { resolveForward, type ResolvedForward } from "./resolve-forward";
import type { RelaySession } from "../relay/session";
import type { OutboxRecovery } from "../relay/outbox";
import { ownSolo } from "../solo/labels";
import { archivedMention } from "./mention-admission";
import type { FollowUpMessage } from "./follow-up-storage";
import { signMessageTokens } from "./message-tokens";

/** Recreated after restart; no composer closures or old membership authority. */
export function followUpMessage(
  session: RelaySession,
  message: FollowUpMessage,
  source?: Pick<ResolvedForward, "row" | "name">,
) {
  return {
    ready() {
      const choices = session.agentChoices.snapshot();
      return (
        choices.complete !== false ||
        message.recipients.every((key) =>
          choices.selectable.some((agent) => agent.pubkey === key),
        )
      );
    },
    async beforeRelease() {
      if (message.forward)
        source = await resolveForward(
          session,
          message.forward,
          new AbortController().signal,
        );
      const channel = await session.channelWrites.refreshMembership(
        message.channelId,
      );
      if (message.recipients.some((key) => !channel.members?.includes(key)))
        throw new Error(t("v1msg.queue.recipientLeft"));
    },
    publish(recovery?: OutboxRecovery) {
      const channel = session.channels
        .list()
        .channels.find((row) => row.id === message.channelId);
      if (!channel || channel.archived || channel.readOnly)
        throw new Error(t("v1msg.queue.chatUnavailable"));
      if (
        !ownSolo(channel, session.viewer) ||
        message.recipients.some(
          (key) =>
            archivedMention(session, key) ||
            !session.agentChoices
              .snapshot()
              .selectable.some((agent) => agent.pubkey === key),
        )
      )
        throw new Error(t("v1msg.queue.soloUnavailable"));
      if (message.forward) {
        if (!source) throw new Error(t("v105msg.queue.reloadForward"));
        const resolved = source;
        const send = () =>
          session.messages.forward(
            message.channelId,
            resolved.row,
            resolved.name,
            message.text,
            recovery,
            {
              mentions: message.recipients,
              attachments: message.attachments,
              references: message.references,
              picks: message.picks,
            },
          );
        return message.tokens?.length
          ? signMessageTokens(message.tokens, send)
          : send();
      }
      if (message.tokens?.length)
        return signMessageTokens(message.tokens, () =>
          session.messages.send(
            message.channelId,
            message.text,
            message.recipients,
            message.attachments,
            recovery,
            message.references,
            message.picks,
          ),
        );
      if (
        !recovery &&
        !message.references.length &&
        !Object.keys(message.picks).length
      )
        return session.messages.send(
          message.channelId,
          message.text,
          message.recipients,
          message.attachments,
        );
      return session.messages.send(
        message.channelId,
        message.text,
        message.recipients,
        message.attachments,
        recovery,
        message.references,
        message.picks,
      );
    },
  };
}
