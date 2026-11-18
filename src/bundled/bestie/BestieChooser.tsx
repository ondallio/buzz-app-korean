import { useState } from "react";
import type { Agents } from "../../features/agents/service";
import { useAgentChoices } from "../../features/agents/use-choices";
import { useAgents } from "../../features/agents/react";
import { useNamesRevision } from "../../features/identity-names/react";
import { matchPerson } from "../../features/search/person-match";
import { avatarMedia } from "../../shared/avatar-source";
import { publicKeyLabels } from "../../shared/identity/public-key";
import type { RelaySession } from "../../features/relay/session";
import { chooseDefaultAgent } from "../../features/solo/default-agent";
import { BestieIcon } from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { ChoiceRow } from "../../shared/design-system/ui/ChoiceRow";
import { Combobox } from "../../shared/design-system/ui/Combobox";
import { t, useLanguage } from "../../shared/i18n";
import { AgentCreateDialog } from "../agents/AgentCreateDialog";
import { RemoteBestieConfirm, remoteAgent } from "../agents/BestieChoice";
import { rememberFirstAgent } from "./FirstAgentWelcome";
import { EmptyBestieAvatar } from "./EmptyBestieAvatar";

const message = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);

/** The one Bestie selection owner, shared by first setup and stale-choice recovery. */
export function BestieChooser({
  session,
  scope,
  community,
  agents,
  title,
  description,
}: {
  session: RelaySession;
  scope: string;
  community?: string | undefined;
  agents: Agents;
  title?: string;
  description?: string;
}) {
  useLanguage();
  const chooseInstruction = t("fubestie.chooser.instruction");
  const choices = useAgentChoices(session, true, true);
  useNamesRevision(session.names, true);
  const { types } = useAgents(agents);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [firstCreation, setFirstCreation] = useState(false);
  const [selected, setSelected] = useState("");
  const [created, setCreated] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [remote, setRemote] = useState<{
    pubkey: string;
    keepsCreated: boolean;
  }>();
  const dismissRemote = () => {
    setRemote(undefined);
    setSelected("");
    setCreated("");
    setError("");
  };
  const choose = async (
    pubkey: string,
    keepsCreated = false,
    confirmedRemote = false,
  ) => {
    if (saving) return;
    if (!keepsCreated) setCreated("");
    if (
      !session.agentChoices
        .snapshot()
        .selectable.some((agent) => agent.pubkey === pubkey)
    ) {
      setSelected("");
      setError(t("fubestie.chooser.agentGone"));
      return;
    }
    if (!confirmedRemote && remoteAgent(agents.find(pubkey)?.place)) {
      setError("");
      setRemote({ pubkey, keepsCreated });
      return;
    }
    setSelected(pubkey);
    setSaving(true);
    setError("");
    try {
      await chooseDefaultAgent(session, scope, pubkey);
      setCreated("");
      setRemote(undefined);
    } catch (reason) {
      setSelected("");
      setError(message(reason));
    } finally {
      setSaving(false);
    }
  };
  const retry = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      await session.agentChoices.refresh(true, { fresh: true });
      if (created) await choose(created, true);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setRefreshing(false);
    }
  };
  const available = choices.selectable;
  const keys = available.map((agent) => agent.pubkey);
  const names = session.names?.scope(keys);
  const keyLabels = publicKeyLabels(keys);
  const items = available.map((agent) => ({
    ...agent,
    label: names?.(agent.pubkey)?.name ?? agent.managedName ?? agent.name,
    keyLabel: keyLabels.get(agent.pubkey),
  }));
  const pending =
    choices.pending ||
    choices.archives.status === "idle" ||
    choices.archives.status === "loading";
  const shownError = error || choices.error || choices.archives.error;
  const firstAgent =
    choices.complete &&
    ["ready", "unavailable"].includes(choices.archives.status) &&
    !available.length &&
    !pending &&
    !shownError &&
    !created &&
    !refreshing;
  return (
    <>
      <EmptyState
        icon={firstAgent ? <EmptyBestieAvatar /> : <BestieIcon />}
        title={
          title ??
          (firstAgent
            ? t("fubestie.chooser.firstTitle")
            : t("fubestie.chooser.title"))
        }
        description={
          description ??
          (firstAgent
            ? t("fubestie.chooser.firstDescription")
            : t("fubestie.chooser.description"))
        }
        action={
          <div className="flex w-full max-w-sm flex-col items-center gap-3">
            {!firstAgent && !available.length && !pending && (
              <p className="m-0 text-body-sm text-secondary">
                {chooseInstruction}
              </p>
            )}
            {(available.length > 0 || pending) && (
              <Combobox.Root
                items={items}
                value={items.find((agent) => agent.pubkey === selected) ?? null}
                itemToStringLabel={(agent) => agent.label}
                itemToStringValue={(agent) => agent.pubkey}
                isItemEqualToValue={(a, b) => a.pubkey === b.pubkey}
                filter={(agent, query) =>
                  !!matchPerson(agent.label, query) ||
                  !!matchPerson(agent.managedName ?? agent.name, query)
                }
                inputValue={search}
                onInputValueChange={setSearch}
                onOpenChange={(open) => {
                  if (open) setSearch("");
                }}
                autoHighlight
                disabled={saving || refreshing || !available.length}
                onValueChange={(agent) => {
                  if (agent) void choose(agent.pubkey);
                }}
              >
                <Combobox.Trigger
                  label={chooseInstruction}
                  disabled={saving || refreshing || !available.length}
                >
                  {items.find((agent) => agent.pubkey === selected)?.label ??
                    (pending && !available.length
                      ? t("fubestie.chooser.loadingAgents")
                      : t("fubestie.chooser.placeholder"))}
                </Combobox.Trigger>
                <Combobox.Popup
                  search
                  size="compact"
                  side="bottom"
                  collisionAvoidance={{ side: "none", align: "shift" }}
                  empty={t("fubestie.chooser.noMatches")}
                >
                  <Combobox.List>
                    {(agent: (typeof items)[number]) => (
                      <Combobox.Item
                        key={agent.pubkey}
                        value={agent}
                        aria-label={`${agent.label} ${agent.keyLabel ?? ""}`.trim()}
                      >
                        <ChoiceRow
                          label={agent.label}
                          description={agent.keyLabel}
                          leading={
                            <Avatar
                              alt=""
                              fallback={agent.label}
                              src={avatarMedia(agent.avatar, session.media)}
                              size="large"
                              shape="squircle"
                            />
                          }
                        />
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Root>
            )}
            {!firstAgent && !available.length && !pending && !shownError && (
              <p className="m-0 text-body-sm text-muted" role="status">
                {t("fubestie.chooser.noneEligible")}
              </p>
            )}
            {saving && (
              <p className="m-0 text-body-sm text-muted" role="status">
                {t("fubestie.chooser.saving")}
              </p>
            )}
            {shownError && !remote && (
              <p className="m-0 text-body-sm text-danger" role="alert">
                {shownError}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant={available.length ? "outline" : "prominent"}
                size={available.length ? "sm" : "md"}
                disabled={saving || refreshing}
                onClick={() => {
                  setFirstCreation(
                    firstAgent && !choices.identities.length && !title,
                  );
                  setCreating(true);
                }}
              >
                {firstAgent
                  ? t("fubestie.chooser.createAn")
                  : t("fubestie.chooser.create")}
              </Button>
              {(choices.error || choices.archives.error || created) && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={refreshing}
                  disabled={saving || refreshing}
                  onClick={() => void retry()}
                >
                  {t("fubestie.tryAgain")}
                </Button>
              )}
            </div>
          </div>
        }
      />
      {remote && (
        <RemoteBestieConfirm
          name={
            items.find((agent) => agent.pubkey === remote.pubkey)?.label ??
            t("v105agent.bestie.thisAgent")
          }
          pending={saving}
          error={error}
          onClose={dismissRemote}
          onConfirm={() =>
            void choose(remote.pubkey, remote.keepsCreated, true)
          }
        />
      )}
      {creating && (
        <AgentCreateDialog
          agents={agents}
          types={types}
          community={community}
          onClose={() => setCreating(false)}
          onCreated={(agent) => {
            if (firstCreation) rememberFirstAgent(scope, agent.pubkey);
            setCreating(false);
            setCreated(agent.pubkey);
            setRefreshing(true);
            setError("");
            void session.agentChoices
              .refresh(true, { fresh: true })
              .then(() => choose(agent.pubkey, true))
              .catch((reason) => setError(message(reason)))
              .finally(() => setRefreshing(false));
          }}
        />
      )}
    </>
  );
}
