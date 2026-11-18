import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DotsThreeIcon, RobotIcon } from "../../../shared/design-system/icons";
import { Avatar } from "../../../shared/design-system/ui/Avatar";
import type { Agent } from "../../../features/agents/service";
import { Button } from "../../../shared/design-system/ui/Button";
import { IconButton } from "../../../shared/design-system/ui/IconButton";
import {
  MenuRoot,
  MenuTrigger,
  MenuPopup,
  MenuItem,
} from "../../../shared/design-system/ui/Menu";
import { useToastNotification } from "../../../shared/design-system/ui/Toast";
import { EmptyState } from "../../../shared/design-system/ui/EmptyState";
import { InlineHeader } from "../../../shared/design-system/ui/Header";
import { writeClipboardText } from "../../../shared/clipboard";
import { ManagementRow } from "../ManagementRow";
import { ManagementSection } from "../ManagementSection";
import agentsHero from "../assets/agents-hero.png";
import type { OverviewObserver } from "../overview";
import { sessionTarget, type BuilderlabSession } from "../session";
import type { AgentClient, RemoteAgent } from "./client";
import { t, useLanguage } from "../../../shared/i18n";

export function RemoteAgents({
  client,
  session,
  active,
  onOverview,
  showHeading = true,
  openAgents,
  savedAgents = [],
  openAgent,
  signIn,
}: {
  client: AgentClient;
  session: BuilderlabSession;
  /** Sign-in for `session` when the account controls beside this section are
   * another server's. */
  signIn?: ReactNode;
  active(): boolean;
  onOverview?: OverviewObserver | undefined;
  showHeading?: boolean;
  openAgents?: (() => void) | undefined;
  savedAgents?: readonly Pick<Agent, "pubkey" | "picture">[];
  openAgent?: ((pubkey: string) => void) | undefined;
}) {
  useLanguage();
  const login = useSyncExternalStore(session.subscribe, session.snapshot);
  useLayoutEffect(() => {
    if (
      active() &&
      (login.status !== "signed-in" || !login.account?.canUseRemoteAgents)
    )
      onOverview?.({
        kind: login.status === "signed-in" ? "unavailable" : "empty",
      });
  }, [active, onOverview, login.status, login.account?.canUseRemoteAgents]);
  if (login.status === "signed-in" && !login.account?.canUseRemoteAgents)
    return (
      <AgentSection>
        {showHeading ? (
          <InlineHeader
            title={t("v1id.blab.remoteAgents")}
            subtitle={t("fubuilderlab.ra.unavailable")}
          />
        ) : (
          <p className="text-body-sm text-secondary">
            {t("fubuilderlab.ra.unavailable")}
          </p>
        )}
      </AgentSection>
    );
  // A sign-in in progress or being checked shows its state in the account
  // notice beside this section, so this section says nothing yet; a sign-in
  // of its own stays mounted here with its status and Cancel.
  if (login.status === "pending" && !signIn) return null;
  return login.status === "signed-in" ? (
    <AgentList
      // Another server's list may belong to the same subject.
      key={`${sessionTarget(session)}:${login.account?.subject}`}
      client={client}
      active={active}
      onOverview={onOverview}
      showHeading={showHeading}
      openAgents={openAgents}
      savedAgents={savedAgents}
      openAgent={openAgent}
    />
  ) : (
    <AgentSection>
      {login.status !== "pending" && (
        <p className="text-body-sm text-secondary">
          {session.providerName
            ? t("fubuilderlab.ra.signInTo", { provider: session.providerName })
            : t("fubuilderlab.ra.signIn")}
        </p>
      )}
      {signIn}
    </AgentSection>
  );
}

function AgentList({
  client,
  active,
  onOverview,
  showHeading,
  openAgents,
  savedAgents,
  openAgent,
}: {
  client: AgentClient;
  active(): boolean;
  onOverview?: OverviewObserver | undefined;
  showHeading: boolean;
  openAgents?: (() => void) | undefined;
  savedAgents: readonly Pick<Agent, "pubkey" | "picture">[];
  openAgent?: ((pubkey: string) => void) | undefined;
}) {
  useLanguage();
  const [agents, setAgents] = useState<readonly RemoteAgent[]>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const refresh = useRef(() => {});
  useLayoutEffect(() => {
    if (!active() || !onOverview) return;
    onOverview(
      loading
        ? { kind: "pending" }
        : agents
          ? agents.length
            ? {
                kind: "filled",
                items: agents.map((agent) => ({
                  key: agent.id,
                  label: agent.name,
                  ...(agentState(agent) === "needs-setup"
                    ? { note: t("fubuilderlab.ra.needsSetup") }
                    : {}),
                })),
              }
            : { kind: "empty" }
          : { kind: "failed" },
    );
  }, [active, onOverview, agents, loading]);
  useEffect(() => {
    let request: AbortController | undefined;
    let loaded = false;
    setLoading(true);
    setAgents(undefined);
    setError(undefined);
    const load = (quiet: boolean) => {
      if (!activeRef.current()) return;
      if (request) {
        if (quiet) return;
        request.abort();
      }
      const controller = new AbortController();
      request = controller;
      const current = () => !controller.signal.aborted && activeRef.current();
      // A retry keeps its failure visible; only the initial read uses loading.
      if (!quiet) setRetrying(true);
      void client
        .list(controller.signal)
        .then(
          (rows) => {
            if (current()) {
              loaded = true;
              setAgents(rows);
              setError(undefined);
              setLoading(false);
              setRetrying(false);
            }
          },
          (reason) => {
            if (current()) {
              if (!quiet || !loaded)
                setError(
                  reason instanceof Error
                    ? reason.message
                    : t("fubuilderlab.ra.loadFailed"),
                );
              setLoading(false);
              setRetrying(false);
            }
          },
        )
        .finally(() => {
          if (request === controller) request = undefined;
        });
    };
    refresh.current = () => load(false);
    const focus = () => load(true);
    load(false);
    window.addEventListener("focus", focus);
    return () => {
      request?.abort();
      refresh.current = () => {};
      window.removeEventListener("focus", focus);
    };
  }, [client]);
  return (
    <section
      data-buzz-ui=""
      className="flex flex-col gap-3"
      aria-label={t("v1id.blab.remoteAgents")}
    >
      {showHeading && <InlineHeader title={t("v1id.blab.remoteAgents")} />}
      <AgentSection>
        {loading && (
          <p role="status" className="text-body-sm text-secondary">
            {t("mentionPicker.loadingAgents")}
          </p>
        )}
        {error && (
          <div role="alert">
            <EmptyState
              icon={<RobotIcon />}
              title={t("fubuilderlab.ra.loadFailedTitle")}
              description={error}
              action={
                <Button
                  variant="subtle"
                  loading={retrying}
                  onClick={() => refresh.current()}
                >
                  {t("identity.failure.retry")}
                </Button>
              }
            />
          </div>
        )}
        {agents?.length === 0 && (
          <EmptyState
            icon={<RobotIcon />}
            title={t("fubuilderlab.ra.emptyTitle")}
            description={t("fubuilderlab.ra.emptyDescription")}
            action={
              openAgents && (
                <Button
                  variant="prominent"
                  onClick={() => {
                    if (active()) openAgents();
                  }}
                >
                  {t("fubuilderlab.ra.openAgents")}
                </Button>
              )
            }
            level={4}
          />
        )}
        {agents && agents.length > 0 && (
          <ul
            className="m-0 list-none p-0"
            aria-label={t("fubuilderlab.ra.yourAgents")}
          >
            {agents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                active={active}
                saved={savedAgents.find(
                  ({ pubkey }) => pubkey === agent.pubkey,
                )}
                openAgent={openAgent}
              />
            ))}
          </ul>
        )}
      </AgentSection>
    </section>
  );
}

function AgentSection({ children }: { children: ReactNode }) {
  return (
    <ManagementSection hero={agentsHero} facts={[]}>
      {children}
    </ManagementSection>
  );
}

function AgentRow({
  agent,
  active,
  saved,
  openAgent,
}: {
  agent: RemoteAgent;
  active(): boolean;
  saved?: Pick<Agent, "pubkey" | "picture"> | undefined;
  openAgent?: ((pubkey: string) => void) | undefined;
}) {
  useLanguage();
  const notify = useToastNotification();
  const state = agentStateLabel(agentState(agent));
  const copy = async () => {
    if (!active()) return;
    try {
      await writeClipboardText(agent.pubkey);
      if (active()) notify(t("fubuilderlab.ra.keyCopied"), "success");
    } catch {
      if (active()) notify(t("fubuilderlab.ra.copyKeyFailed"), "error");
    }
  };
  return (
    <li>
      <ManagementRow
        icon={
          <Avatar
            src={saved?.picture}
            alt=""
            fallback={agent.name}
            fallbackContent={<RobotIcon size={20} />}
            size="fill"
            shape="squircle"
          />
        }
        title={agent.name}
        onOpen={
          saved && openAgent
            ? () => {
                if (active()) openAgent(agent.pubkey);
              }
            : undefined
        }
        detail={
          <>
            {agent.modelId ?? t("fubuilderlab.ra.noModel")} · {state}
          </>
        }
        status={saved ? t("fubuilderlab.ra.inAgents") : undefined}
        actions={
          <MenuRoot>
            <MenuTrigger
              render={
                <IconButton
                  variant="bare"
                  size="sm"
                  shape="row-end"
                  aria-label={t("fubuilderlab.moreActions", {
                    name: agent.name,
                  })}
                  icon={<DotsThreeIcon size={18} />}
                />
              }
            />
            <MenuPopup
              align="end"
              aria-label={t("fubuilderlab.moreActions", { name: agent.name })}
            >
              {saved && openAgent && (
                <MenuItem
                  onClick={() => {
                    if (active()) openAgent(agent.pubkey);
                  }}
                >
                  {t("fubuilderlab.ra.viewAgent")}
                </MenuItem>
              )}
              <MenuItem onClick={() => void copy()}>
                {t("fubuilderlab.ra.copyKey")}
              </MenuItem>
            </MenuPopup>
          </MenuRoot>
        }
      />
    </li>
  );
}

type AgentState = "revoked" | "unknown" | "configured" | "needs-setup";

function agentState(agent: RemoteAgent): AgentState {
  return agent.status === "Revoked"
    ? "revoked"
    : agent.status === "Unknown"
      ? "unknown"
      : agent.status === "Active" && agent.modelSelectionStatus === "valid"
        ? "configured"
        : "needs-setup";
}

function agentStateLabel(state: AgentState) {
  switch (state) {
    case "revoked":
      return t("fubuilderlab.ra.revoked");
    case "unknown":
      return t("fubuilderlab.ra.unknown");
    case "configured":
      return t("fubuilderlab.ra.configured");
    case "needs-setup":
      return t("fubuilderlab.ra.needsSetup");
  }
}
