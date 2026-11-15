import { t, useLanguage } from "../../shared/i18n";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ExternalApps } from "./external-connection";
import {
  externalMcpEnabled,
  fullAgentAccess,
  legacyRequest,
} from "./external-connection";
import type { Agents } from "./service";
import type { Communities } from "../communities/service";
import type { RelayData } from "../relay/service";
import type { RelaySession } from "../relay/session";
import { useAgentChoices } from "./use-choices";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Button } from "../../shared/design-system/ui/Button";
import { Select } from "../../shared/design-system/ui/Select";
import { ToastNotice } from "../../shared/design-system/ui/Toast";

type ConsentProps = { connection: ExternalApps; communities: Communities };
export function ExternalAuthorizationDialog({
  connection,
  agents,
  communities,
  relay,
}: ConsentProps & { agents: Agents; relay: RelayData }) {
  useLanguage();
  const state = useSyncExternalStore(connection.subscribe, connection.snapshot);
  const client = useSyncExternalStore(
    communities.subscribe,
    communities.snapshot,
  );
  const transport = useSyncExternalStore(relay.subscribe, relay.snapshot);
  const pending = state.pending;
  useEffect(() => {
    if (pending && client.viewer !== pending.viewer)
      void connection.deny().catch(() => {});
  }, [pending, client.viewer, connection]);
  return (
    <>
      {pending &&
        (!fullAgentAccess(pending.request.scope) ? (
          <ConsentDialog connection={connection} communities={communities}>
            <p role="status" className="m-0 text-body-sm text-secondary">
              {t("v1agent.authorize.legacy")}
            </p>
          </ConsentDialog>
        ) : transport.status === "ready" &&
          client.viewer === pending.viewer &&
          externalMcpEnabled(client.selected) ? (
          <ReadyConsent
            key={transport.scope}
            session={transport.session}
            agents={agents}
            connection={connection}
            communities={communities}
          />
        ) : (
          <ConsentDialog connection={connection} communities={communities}>
            <p role="status" className="m-0 text-body-sm text-secondary">
              {externalMcpEnabled(client.selected)
                ? t("v1agent.authorize.selectConnected")
                : t("v1agent.authorize.notEnabled")}
            </p>
          </ConsentDialog>
        ))}
      {state.error && (
        <ToastNotice
          title={t("v1agent.authorize.failed")}
          description={
            state.error === legacyRequest
              ? t("v1agent.authorize.legacy")
              : state.error
          }
          onDismiss={connection.clearError}
        />
      )}
    </>
  );
}
function ConsentDialog({
  connection,
  communities,
  actions,
  children,
}: ConsentProps & { actions?: ReactNode; children: ReactNode }) {
  useLanguage();
  const state = useSyncExternalStore(connection.subscribe, connection.snapshot);
  const client = useSyncExternalStore(
    communities.subscribe,
    communities.snapshot,
  );
  const request = state.pending?.request;
  const deny = (
    <Button
      variant="outline"
      onClick={() => void connection.deny().catch(() => {})}
    >
      {t("v1agent.authorize.deny")}
    </Button>
  );
  return (
    <Dialog
      open={!!request}
      title={t("v1agent.authorize.title")}
      description={
        request
          ? t("v1agent.authorize.requests", { client: request.client })
          : undefined
      }
      size="compact"
      actions={actions ?? deny}
      onOpenChange={(open) => {
        if (!open) void connection.deny().catch(() => {});
      }}
    >
      {request && (
        <div className="grid gap-4">
          <p className="m-0 text-body-sm text-secondary">
            {t("v1agent.authorize.nameNote")}
          </p>
          {state.grant && state.grant.phase !== "ended" && (
            <p className="m-0 text-body-sm text-secondary">
              {t("v1agent.authorize.replaces", { client: state.grant.client })}
            </p>
          )}
          <Select
            label={t("v1agent.authorize.community")}
            variant="field"
            value={client.selected ?? ""}
            placeholder={t("v1agent.authorize.selectCommunity")}
            groups={[
              {
                label: t("v1agent.authorize.yourCommunities"),
                options: client.memberships.map((membership) => ({
                  value: membership.id,
                  label: membership.name,
                  disabled: !externalMcpEnabled(membership.id),
                  description: externalMcpEnabled(membership.id)
                    ? undefined
                    : t("v1agent.authorize.notEnabledHere"),
                })),
              },
            ]}
            onValueChange={(id) => communities.select(id)}
          />
          {fullAgentAccess(request.scope) && (
            <p className="m-0 text-body-sm text-secondary">
              {t("v1agent.authorize.fullAccess")}
              {request.version === 2 && ` ${t("v1agent.authorize.renewal")}`}
            </p>
          )}
          {children}
          {!state.available && (
            <p role="alert" className="m-0 text-body-sm text-danger">
              {t("v1agent.authorize.enableAgents")}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
function ReadyConsent({
  session,
  agents,
  connection,
  communities,
}: ConsentProps & { session: RelaySession; agents: Agents }) {
  useLanguage();
  const choices = useAgentChoices(session, false, true);
  const inventory = useSyncExternalStore(agents.subscribe, agents.snapshot);
  const availability = useSyncExternalStore(agents.subscribe, () =>
    JSON.stringify(
      agents
        .snapshot()
        .agents.filter((agent) => agents.canConnectExternal(agent.key))
        .map((agent) => agent.key),
    ),
  );
  const available = new Set<string>(JSON.parse(availability));
  const state = useSyncExternalStore(connection.subscribe, connection.snapshot);
  const [selected, setSelected] = useState("");
  const eligible = inventory.agents.filter(
    (agent) =>
      agent.place === "here" &&
      !agent.deleting &&
      !agent.protection &&
      choices.selectable.some((choice) => choice.pubkey === agent.pubkey),
  );
  const usable = eligible.filter((agent) => available.has(agent.key));
  const chosen = selected
    ? usable.find((agent) => agent.key === selected)
    : usable.length === 1
      ? usable[0]
      : undefined;
  return (
    <ConsentDialog
      connection={connection}
      communities={communities}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => void connection.deny().catch(() => {})}
          >
            {t("v1agent.authorize.deny")}
          </Button>
          <Button
            disabled={!chosen || !state.available}
            onClick={() => {
              if (chosen && agents.canConnectExternal(chosen.key))
                void connection.approve(chosen.key);
            }}
          >
            {t("v1agent.authorize.authorize")}
          </Button>
        </>
      }
    >
      <Select
        label={t("agentsDetails.agent")}
        variant="field"
        placeholder={t("v1agent.authorize.selectAgent")}
        value={chosen?.key ?? ""}
        groups={[
          {
            label: t("v1agent.authorize.agentsHere"),
            options: eligible.map((agent) => ({
              value: agent.key,
              label: agent.name,
              disabled: !available.has(agent.key),
              description: available.has(agent.key)
                ? undefined
                : t("v1agent.authorize.unavailableHere"),
            })),
          },
        ]}
        onValueChange={setSelected}
      />
      {usable.length < eligible.length && (
        <p className="m-0 text-body-sm text-secondary">
          {t("v1agent.authorize.enableRuntime")}
        </p>
      )}
      {!eligible.length && (
        <p className="m-0 text-body-sm text-secondary">
          {t("v1agent.authorize.noEligible")}
        </p>
      )}
    </ConsentDialog>
  );
}
