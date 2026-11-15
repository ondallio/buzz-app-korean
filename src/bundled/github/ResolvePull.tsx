import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RelayData } from "../../features/relay/service";
import { useChannelList } from "../../features/relay/react";
import type { RelaySession } from "../../features/relay/session";
import { useAgentChoices } from "../../features/agents/use-choices";
import { Button } from "../../shared/design-system/ui/Button";
import { Select } from "../../shared/design-system/ui/Select";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import type { PullChecklist } from "./pull";
import styles from "./GitHub.module.css";
import { t, useLanguage } from "../../shared/i18n";

type Resolution = "failures" | "conflicts";
export function ResolvePull({
  relay,
  channelId,
  rootId,
  url,
  pull,
  action,
}: {
  relay: RelayData;
  channelId: string;
  rootId?: string | undefined;
  url: string;
  pull: PullChecklist;
  action: Resolution;
}) {
  const state = useSyncExternalStore(relay.subscribe, relay.snapshot);
  return state.status === "ready" ? (
    <SessionResolve
      key={`${state.generation}:${url}:${pull.head}:${action}`}
      session={state.session}
      channelId={channelId}
      rootId={rootId}
      url={url}
      pull={pull}
      action={action}
    />
  ) : null;
}

function SessionResolve({
  session,
  channelId,
  rootId,
  url,
  pull,
  action,
}: {
  session: RelaySession;
  channelId: string;
  rootId: string | undefined;
  url: string;
  pull: PullChecklist;
  action: Resolution;
}) {
  useLanguage();
  const list = useChannelList(session.channels);
  const choices = useAgentChoices(session, true, true);
  const channel = list.channels.find((item) => item.id === channelId);
  const agents = choices.selectable.filter((agent) =>
    channel?.members?.includes(agent.pubkey),
  );
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const resolveButton = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const running = useRef(false);
  const alive = useRef(true);
  const notify = useToastNotification();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const recipient = agents.some((agent) => agent.pubkey === selected)
    ? selected
    : choices.complete && agents.length === 1
      ? agents[0]?.pubkey
      : undefined;
  useEffect(() => {
    if (
      !busy &&
      choices.error &&
      !recipient &&
      document.activeElement === resolveButton.current
    )
      retryButton.current?.focus();
  }, [busy, choices.error, recipient]);
  const applicable =
    action === "conflicts"
      ? pull.merge === "DIRTY"
      : pull.checks.state === "failure" ||
        pull.checks.checks?.some((check) =>
          ["failing", "cancelled"].includes(check.category),
        );
  if (
    !channel ||
    channel.archived ||
    channel.readOnly ||
    !["open", "draft"].includes(pull.state) ||
    !applicable ||
    (choices.complete && agents.length === 0)
  )
    return null;
  async function send() {
    if (running.current || sent || !recipient) return;
    running.current = true;
    setBusy(true);
    try {
      const fresh = await session.channelWrites.refreshMembership(channelId);
      await session.agentChoices.refresh();
      if (!alive.current) return;
      const current = session.agentChoices.snapshot();
      const available = current.selectable.filter((agent) =>
        fresh.members?.includes(agent.pubkey),
      );
      if (
        fresh.archived ||
        fresh.readOnly ||
        !available.some((agent) => agent.pubkey === recipient) ||
        (!selected && (!current.complete || available.length !== 1))
      )
        throw new Error(t("v1wf.gh.agentsChanged"));
      const content = `[Resolve ${action}](${url})`;
      if (rootId && fresh.channelType !== "solo")
        session.messages.reply(channelId, rootId, content, [recipient]);
      else session.messages.send(channelId, content, [recipient]);
      setSent(true);
    } catch (error) {
      if (alive.current)
        notify(
          error instanceof Error
            ? error.message
            : t("v1wf.gh.sendRequestFailed"),
          "error",
        );
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <span className={styles.resolutionAction}>
      {choices.error && (
        <span role="alert">
          {choices.error}{" "}
          <Button
            ref={retryButton}
            size="sm"
            loading={choices.pending}
            onClick={() =>
              void session.agentChoices
                .refresh()
                .catch((error: unknown) =>
                  notify(
                    error instanceof Error
                      ? error.message
                      : t("v1wf.gh.loadAgentsFailed"),
                    "error",
                  ),
                )
            }
          >
            {t("v1wf.gh.retryAgents")}
          </Button>
        </span>
      )}
      {(agents.length > 1 || (!choices.complete && agents.length > 0)) && (
        <Select
          label={t("v1wf.gh.agent")}
          variant="inline"
          size="sm"
          value={selected}
          placeholder={t("v1wf.gh.chooseAgent")}
          disabled={busy || sent}
          groups={[
            {
              label: t("v1wf.gh.chatAgents"),
              options: agents.map((agent) => ({
                value: agent.pubkey,
                label: agent.name,
              })),
            },
          ]}
          onValueChange={setSelected}
        />
      )}
      <Button
        ref={resolveButton}
        size="sm"
        focusableWhenDisabled={busy || !!choices.error}
        loading={busy}
        disabled={!recipient || sent}
        title={
          !recipient
            ? choices.pending
              ? t("v1wf.gh.loadingChatAgents")
              : t("v1wf.gh.chooseAvailableAgent")
            : t("v1wf.gh.sendResolution")
        }
        onClick={() => void send()}
      >
        {sent ? t("v1wf.gh.requested") : t(`v1wf.gh.resolve.${action}`)}
      </Button>
    </span>
  );
}
