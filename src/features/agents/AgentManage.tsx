import { t, useLanguage } from "../../shared/i18n";
// Owner actions on an agent that every surface showing it offers: the
// Agents Build view and the profile panel.
import { useRef, useState, type ReactNode } from "react";
import { TrashIcon } from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import type { Agent, Agents } from "./service";

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const hostOf = (origin: string) => origin.replace(/^https:\/\//, "");

/** Whether the agent shown here is also in another of the owner's
 * communities that it isn't leaving, so it can be removed from this one
 * alone, or again after a Remove that didn't finish. */
export const inSeveral = (agents: Agents, agent: Agent) =>
  agent.place === "here" &&
  agents
    .memberships(agent.pubkey)
    .some((membership) => membership.key !== agent.key && !membership.deleting);

/** One field list for every surface explaining shared settings. */
export const sharedAgentSettings =
  "Name, type and settings, including instructions, model and workspace, are shared across communities.";

/** What adding the same agent to another community shares and what it keeps
 * there, as every place that adds one says it. */
export const sameAgent = (many = false) =>
  many ? t("v1agent.manage.sameAgents") : t("v1agent.manage.sameAgent");

/** Delete, after a confirmation that says what it does. One that cannot
 * finish keeps the dialog open with what is left; the agent stays listed.
 * A community Delete cannot reach can then be given up on. */
export function AgentDelete({
  agents,
  agent,
  onRemoved,
  trigger,
}: {
  agents: Agents;
  agent: Agent;
  onRemoved(): void;
  trigger?: (open: () => void) => ReactNode;
}) {
  useLanguage();
  const cancel = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  // Forgot where it couldn't reach, so Delete is what is left to press.
  const [forgot, setForgot] = useState(false);
  const memberships =
    agent.place === "here" ? agents.memberships(agent.pubkey) : [];
  const several = memberships.length > 1;
  // Only a Delete that started can be given up on where it can't reach.
  const unreachable = memberships.filter(
    (membership) => membership.deleting && !membership.connected,
  );
  const remove = async () => {
    setRemoving(true);
    setError("");
    setForgot(false);
    try {
      await agents.remove(agent.key);
      setConfirming(false);
      onRemoved();
    } catch (reason) {
      setError(message(reason));
      setRemoving(false);
    }
  };
  const forget = async (key: string) => {
    setRemoving(true);
    setError("");
    try {
      await agents.forget(key);
      if (agents.memberships(agent.pubkey).length) {
        setForgot(true);
        setRemoving(false);
      } else {
        setConfirming(false);
        onRemoved();
      }
    } catch (reason) {
      setError(message(reason));
      setRemoving(false);
    }
  };
  return (
    <>
      {trigger ? (
        trigger(() => setConfirming(true))
      ) : (
        <Button
          size="compact"
          variant="ghost"
          onClick={() => setConfirming(true)}
        >
          <TrashIcon size={14} aria-hidden="true" />{" "}
          {t("agentsBrowse.deleteAgent")}
        </Button>
      )}
      <Dialog
        size="compact"
        open={confirming}
        initialFocus={cancel}
        onOpenChange={setConfirming}
        title={t("v1agent.manage.deleteTitle", { name: agent.name })}
        description={
          agent.place === "hosted"
            ? t("v1agent.manage.deleteHosted")
            : several
              ? t("v1agent.manage.deleteSeveral")
              : t("v1agent.manage.deleteLocal")
        }
        preventClose={removing}
        actions={
          <>
            <Button
              ref={cancel}
              onClick={() => setConfirming(false)}
              disabled={removing}
            >
              {t("channelForms.cancel")}
            </Button>
            <Button
              variant="destructive"
              loading={removing}
              onClick={() => void remove()}
            >
              {t("v1agent.manage.delete")}
            </Button>
          </>
        }
      >
        {several || error || unreachable.length || forgot ? (
          <div className="flex flex-col gap-3">
            {several && (
              <ul
                aria-label={t("v1agent.manage.communities")}
                className="m-0 flex list-none flex-col gap-1 p-0"
              >
                {memberships.map((membership) => (
                  <li
                    key={membership.key}
                    className="flex items-center justify-between gap-2 text-body-sm"
                  >
                    <span className="truncate">
                      {hostOf(membership.origin)}
                      {!membership.connected && (
                        <span className="text-secondary">
                          {" "}
                          · {t("v1agent.manage.notConnected")}
                        </span>
                      )}
                    </span>
                    {unreachable.includes(membership) && (
                      <Button
                        size="compact"
                        variant="outline"
                        aria-label={t("v1agent.manage.forgetIn", {
                          community: hostOf(membership.origin),
                        })}
                        disabled={removing}
                        onClick={() => void forget(membership.key)}
                      >
                        {t("v1agent.manage.forget")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {error ? (
              <p role="alert" className="m-0 text-body-sm text-danger">
                {error}
              </p>
            ) : null}
            {unreachable.length > 0 && (
              <p className="m-0 text-body-sm text-secondary">
                {t("v1agent.manage.forgetHint")}
              </p>
            )}
            {forgot &&
              !unreachable.length &&
              // A Delete marks every membership; a Remove only its own.
              memberships.every((membership) => membership.deleting) && (
                <p className="m-0 text-body-sm text-secondary">
                  {t("v1agent.manage.deleteAgain")}
                </p>
              )}
            {!several && unreachable[0] && (
              <div>
                <Button
                  size="compact"
                  // Its last key goes with it.
                  variant="destructive"
                  disabled={removing}
                  onClick={() => void forget(unreachable[0]?.key ?? "")}
                >
                  {t("v1agent.manage.forgetIt")}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

/** Takes the agent out of the community shown, after a confirmation, and
 * keeps it in its others. Offer it only while it is in another: see
 * `inSeveral`. */
export function AgentRemoveHere({
  agents,
  agent,
  onRemoved,
  trigger,
}: {
  agents: Agents;
  agent: Agent;
  onRemoved(): void;
  trigger: (open: () => void) => ReactNode;
}) {
  useLanguage();
  const cancel = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const place = agent.relay.replace(/^wss:\/\//, "");
  const leave = async () => {
    setRemoving(true);
    setError("");
    try {
      await agents.leave(agent.key);
      setConfirming(false);
      onRemoved();
    } catch (reason) {
      setError(message(reason));
      setRemoving(false);
    }
  };
  return (
    <>
      {trigger(() => setConfirming(true))}
      <Dialog
        size="compact"
        open={confirming}
        initialFocus={cancel}
        onOpenChange={setConfirming}
        title={t("v1agent.manage.removeTitle", { name: agent.name, place })}
        description={t("v1agent.manage.removeDescription")}
        preventClose={removing}
        actions={
          <>
            <Button
              ref={cancel}
              onClick={() => setConfirming(false)}
              disabled={removing}
            >
              {t("channelForms.cancel")}
            </Button>
            <Button
              variant="destructive"
              loading={removing}
              onClick={() => void leave()}
            >
              {t("v1agent.manage.remove")}
            </Button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="m-0 text-body-sm text-danger">
            {error}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}

/** Checks again, for an imported agent, that it is not archived in its
 * community, which import could not confirm. */
export function AgentArchiveRetry({
  agents,
  agent,
}: {
  agents: Pick<Agents, "unarchive">;
  agent: Agent;
}) {
  useLanguage();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState("");
  if (!agent.archiveUnchecked && !result) return null;
  const retry = async () => {
    setChecking(true);
    setResult("");
    try {
      setResult((await agents.unarchive(agent.key)) ?? "");
    } catch (reason) {
      setResult(
        t("v1agent.manage.archiveCheckFailed", { reason: message(reason) }),
      );
    } finally {
      setChecking(false);
    }
  };
  return (
    <PreferenceRow
      title={t("v1agent.manage.archiveState")}
      subtitle={result || t("v1agent.manage.archiveUnchecked")}
      trailing={
        agent.archiveUnchecked ? (
          <Button
            size="compact"
            loading={checking}
            onClick={() => void retry()}
          >
            {t("v1agent.history.retry")}
          </Button>
        ) : undefined
      }
    />
  );
}
