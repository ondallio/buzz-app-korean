import { t, useLanguage } from "../../shared/i18n";
import { useSyncExternalStore } from "react";
import { useWorkflowAgentMentions } from "../../bundled/workflows/useWorkflowAgentMentions";
import type { MentionRefusal } from "../agents/owner-attestation";
import type { RelaySession } from "../relay/session";
import styles from "./Messages.module.css";

const noSubscribe = () => () => {};

export function agentDeclineText(name: string, ownerOnly: boolean) {
  return t(
    ownerOnly ? "v105msg.decline.ownerOnly" : "v105msg.decline.notDirected",
    { name },
  );
}

/** Why this device's agents didn't act on this message. Local and owner-only:
 * the decisions are this app's, and nothing is published. */
export function AgentDeclineNotes({
  session,
  scope,
  channelId,
  messageId,
}: {
  session: Pick<RelaySession, "agentActivity" | "agentChoices">;
  scope: string;
  channelId: string;
  messageId: string;
}) {
  const read = () =>
    JSON.stringify(
      (session.agentActivity?.snapshot().declined ?? [])
        .filter(
          (row) => row.channelId === channelId && row.messageId === messageId,
        )
        .map((row) => [row.agent, row.refusal]),
    );
  const declined = JSON.parse(
    useSyncExternalStore(
      session.agentActivity?.subscribe ?? noSubscribe,
      read,
      read,
    ),
  ) as [string, MentionRefusal][];
  return declined.length ? (
    <Notes session={session} scope={scope} agents={declined.map(([a]) => a)} />
  ) : null;
}

/** Mounted only when there is a note, so the relay-info read happens only then. */
function Notes({
  session,
  scope,
  agents,
}: {
  session: Pick<RelaySession, "agentChoices">;
  scope: string;
  agents: string[];
}) {
  useLanguage();
  const ownerOnly = useWorkflowAgentMentions(scope) === "owner";
  // Test and preview sessions may have no choices store.
  const readChoices = () => session.agentChoices?.snapshot();
  const choices = useSyncExternalStore(
    session.agentChoices?.subscribe ?? noSubscribe,
    readChoices,
    readChoices,
  );
  return agents.map((agent) => {
    const name =
      choices?.identities.find((choice) => choice.pubkey === agent)?.name ??
      t("v105msg.decline.yourAgent");
    return (
      <p key={agent} role="status" className={styles.agentNote}>
        {agentDeclineText(name, ownerOnly)}
      </p>
    );
  });
}
