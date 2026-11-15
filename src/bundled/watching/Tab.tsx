import * as React from "react";
import { attentionOf, type WatchObject } from "../../features/agents/attention";
import { relayOrigin } from "../../features/communities/destination";
import { relayPartition } from "../../features/relay/partition";
import {
  LightningIcon,
  CaretRightIcon,
} from "../../shared/design-system/icons";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { AttentionStatus } from "./AttentionStatus";
import { Switch as SharedSwitch } from "../../shared/design-system/ui/Switch";
import type { Context } from "../../plugins/author";
import type { Agent } from "./model";
import type { RelaySession } from "../../features/relay/session";
import { InstructionsMarkdown, OpenLink } from "./InstructionsMarkdown";
import { title, heading, type Channel } from "./presentation";
import { problem, useAction } from "./actions";
import { AttentionSonar } from "./AttentionSonar";
import { AttentionEmptyState } from "./AttentionEmptyState";
import { createWatchComponents } from "./WatchRow";
export { heading, describe } from "./presentation";
import "./AttentionPage.css";
import { t, useLanguage } from "../../shared/i18n";

const button = { variant: "ghost" as const, size: "sm" as const };
/** The watches of an Interest that this app skipped, such as ones over the
 * limit. They still belong to it. */
const skippedWatches = (agent: Agent, id: string) =>
  Object.values(agent.skipped ?? {}).filter(
    (object) =>
      (object.value as { interest_id?: unknown } | null)?.interest_id === id,
  );
/** Uses the host’s controls and surface roles. */
export function createAttentionComponents({
  agents,
  relay,
  navigation,
}: Pick<Context, "agents" | "relay" | "navigation">) {
  const { Subscription, Destination, Message, Entry } = createWatchComponents({
    agents,
    navigation,
  });
  const none = () => () => {};
  const noChannels: { channels: readonly Channel[] } = { channels: [] };
  const emptyChannels = () => noChannels;
  function Switch({
    label,
    tooltip,
    checked,
    disabled,
    onClick,
  }: {
    label: string;
    tooltip?: string;
    checked: boolean;
    disabled: boolean;
    onClick(): void;
  }) {
    return (
      <SharedSwitch
        aria-label={label}
        title={tooltip || label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onClick}
      />
    );
  }
  function InterestStatus({
    agent,
    slug,
    label,
    hasWatches,
    returnFocus,
  }: {
    agent: Agent;
    slug: string;
    label: string;
    hasWatches: boolean;
    returnFocus: React.RefObject<HTMLElement | null>;
  }) {
    const trigger = React.useRef<HTMLButtonElement>(null);
    const cancel = React.useRef<HTMLButtonElement>(null);
    const popup = React.useRef<HTMLDivElement>(null);
    const [confirming, setConfirming] = React.useState(false);
    const action = useAction();
    const remove = () =>
      action.run(async () => {
        const focused = document.activeElement;
        const expected = agent.attention[slug];
        if (!expected) throw new Error("This interest no longer exists.");
        const id = slug.slice("interest/".length);
        const watches = Object.values(agent.attention).filter(
          (object) =>
            object.value.type !== "interest" && object.value.interest_id === id,
        );
        // A watch skipped here, such as one over the limit, still belongs to
        // this Interest and could run once there is room for it.
        const skipped = skippedWatches(agent, id);
        await agents.save(agent.key, {
          attentionExpected: Object.fromEntries([
            ...watches.map((watch) => [watch.slug, watch]),
            [slug, expected],
          ]),
          attention: Object.fromEntries([
            ...[...watches, ...skipped].map((watch) => [watch.slug, null]),
            [slug, null],
          ]),
        });
        setConfirming(false);
        if (
          !trigger.current?.isConnected &&
          (document.activeElement === document.body ||
            document.activeElement === focused)
        )
          returnFocus.current?.focus();
      });
    React.useLayoutEffect(
      () => () => {
        if (
          trigger.current === document.activeElement ||
          popup.current?.contains(document.activeElement)
        )
          returnFocus.current?.focus();
      },
      [returnFocus],
    );
    return (
      <>
        <div className="attention-actions">
          <AttentionStatus
            name={label}
            heading={t("v1wf.watch.interest")}
            triggerRef={trigger}
            popupRef={popup}
            deleteConfirms={hasWatches}
            returnFocus={returnFocus}
            label={t("v1wf.watch.interestStatusFor", { label })}
            active={
              agent.attention[slug]?.value.type === "interest" &&
              agent.attention[slug]?.value.paused !== true
            }
            pending={action.pending}
            onChange={(active) =>
              void action.run(async () => {
                const expected = agent.attention[slug];
                const value = expected?.value;
                if (!expected || value?.type !== "interest")
                  throw new Error(t("v1wf.watch.interestGone"));
                await agents.save(agent.key, {
                  attentionExpected: { [slug]: expected },
                  attention: { [slug]: { ...value, paused: !active } },
                });
              })
            }
            onDelete={() => (hasWatches ? setConfirming(true) : void remove())}
          />
        </div>
        {confirming && (
          <AlertDialog
            title={t("v1wf.watch.deleteNamed", { label })}
            description={t("v1wf.watch.deleteInterestDescription")}
            pending={action.pending}
            initialFocus={cancel}
            finalFocus={() =>
              trigger.current?.isConnected
                ? trigger.current
                : (returnFocus.current ?? false)
            }
            onClose={() => setConfirming(false)}
            actions={
              <>
                <Button
                  ref={cancel}
                  disabled={action.pending}
                  onClick={() => setConfirming(false)}
                >
                  {t("v1wf.watch.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  loading={action.pending}
                  onClick={() => void remove()}
                >
                  {t("v1wf.watch.delete")}
                </Button>
              </>
            }
          >
            {problem(action.error)}
          </AlertDialog>
        )}
        {!confirming && problem(action.error)}
      </>
    );
  }
  function Instructions({ instructions }: { instructions: string }) {
    const firstLine =
      instructions.split("\n").find((line) => line.trim()) || "";
    return (
      <details className="attention-instructions">
        <summary className="attention-disclosure text-body-sm text-subtle">
          <span className="attention-disclosure-icon">
            <LightningIcon size={16} aria-hidden={true} />
          </span>
          <span className="attention-instructions-preview">
            {
              heading(
                instructions
                  .split("\n")
                  .find((line) => line.trim() && !/^#+\s/.test(line)) ||
                  firstLine,
              ).text
            }
          </span>
          <CaretRightIcon size={16} aria-hidden={true} />
        </summary>
        <InstructionsMarkdown text={instructions} />
      </details>
    );
  }
  function Interest({
    object,
    subscriptions,
    agent,
    name,
    find,
    scope,
    session,
    returnFocus,
  }: {
    object: Agent["attention"][string];
    subscriptions: readonly WatchObject[];
    agent: Agent;
    name(id: string): string;
    find(id: string): Channel | undefined;
    scope?: string | undefined;
    session?: RelaySession | undefined;
    returnFocus: React.RefObject<HTMLElement | null>;
  }) {
    const id = object.slug.slice("interest/".length);
    const interest = object.value;
    const instructions =
      interest?.type === "interest"
        ? interest.instructions
        : t("v1wf.watch.noInstructions");
    const firstLine =
      instructions.split("\n").find((line) => line.trim()) || "";
    const label =
      (interest?.type === "interest" && interest.title) ||
      (/^#+\s/.test(firstLine) ? heading(firstLine).text : title(id));
    return (
      <SettingsGroup layout="cards">
        <section
          className="attention-interest"
          aria-label={t("v1wf.watch.interestNamed", { label })}
        >
          <div className="attention-interest-head">
            <h4 className="text-label">{label}</h4>
            <InterestStatus
              agent={agent}
              slug={object.slug}
              label={label}
              hasWatches={
                subscriptions.length > 0 || skippedWatches(agent, id).length > 0
              }
              returnFocus={returnFocus}
            />
          </div>
          {interest?.type === "interest" && interest.summary && (
            <p className="attention-interest-summary text-body-sm text-subtle">
              {interest.summary}
            </p>
          )}
          {subscriptions.length > 0 && (
            <div className="attention-column-headings text-caption text-subtle">
              <h5 className="text-caption">{t("v1wf.watch.triggers")}</h5>
              <span>{t("v1wf.watch.sources")}</span>
              <span>{t("v1wf.watch.respondsIn")}</span>
              <span>{t("v1wf.watch.status")}</span>
            </div>
          )}
          {!subscriptions.length && (
            <h5 className="attention-section-label text-caption text-subtle">
              {t("v1wf.watch.triggers")}
            </h5>
          )}
          {!subscriptions.length && (
            <p className="text-body-sm text-subtle">
              {t("v1wf.watch.noWatches")}
            </p>
          )}
          <ul
            className="attention-list"
            aria-label={t("v1wf.watch.watchesOf", { label })}
          >
            {subscriptions.map((object) => (
              <Subscription
                key={object.slug}
                agent={agent}
                slug={object.slug}
                watch={object.value}
                name={name}
                find={find}
                scope={scope}
                session={session}
                returnFocus={returnFocus}
              />
            ))}
          </ul>
          <h5 className="attention-section-label text-caption text-subtle">
            {t("v1wf.watch.instructions")}
          </h5>
          <Instructions instructions={instructions} />
        </section>
      </SettingsGroup>
    );
  }
  function AgentPanel({
    agent,
    channels,
    scope,
    session,
    returnFocus,
  }: {
    agent: Agent;
    channels: readonly Channel[];
    scope?: string | undefined;
    session?: RelaySession | undefined;
    returnFocus: React.RefObject<HTMLElement | null>;
  }) {
    const action = useAction();
    const find = (id: string) => channels.find((channel) => channel.id === id);
    const name = (id: string) =>
      find(id)?.name ?? t("v1wf.watch.channelFallback", { id: id.slice(0, 8) });
    const { interests, watches, orphans } = attentionOf(agent.attention);
    const skipped = Object.values(agent.skipped ?? {});
    const empty =
      !interests.length &&
      !watches.length &&
      !orphans.length &&
      !skipped.length;
    return (
      <div className="attention-agent">
        <SettingsGroup layout="cards">
          <section
            className="attention-setting"
            aria-label={t("v1wf.watch.settings")}
          >
            {!empty && (
              <AttentionSonar name={agent.name} picture={agent.picture} />
            )}
            <PreferenceRow
              title={t("v1wf.watch.attention")}
              subtitle={t("v1wf.watch.settingsSubtitle", { name: agent.name })}
            />
          </section>
        </SettingsGroup>
        {problem(action.error)}
        {skipped.map((object) => (
          <section key={object.slug} className="attention-card">
            <h4 className="text-label-sm">{object.slug}</h4>
            <p className="text-body-sm text-danger">{object.problem}</p>
            <Button
              {...button}
              type="button"
              disabled={action.pending}
              onClick={() =>
                void action.run(() =>
                  agents.save(agent.key, {
                    attention: { [object.slug]: null },
                  }),
                )
              }
            >
              {t("v1wf.watch.removeUnreadable", { slug: object.slug })}
            </Button>
          </section>
        ))}
        {interests.map((object) => (
          <Interest
            key={object.slug}
            object={object}
            agent={agent}
            name={name}
            find={find}
            scope={scope}
            session={session}
            returnFocus={returnFocus}
            subscriptions={watches.filter(
              (watch) =>
                watch.value.interest_id ===
                object.slug.slice("interest/".length),
            )}
          />
        ))}
        {orphans.length > 0 && (
          <section
            className="attention-interest"
            aria-label={t("v1wf.watch.stray")}
          >
            <h4 className="text-label">{t("v1wf.watch.stray")}</h4>
            <p className="text-body-sm text-subtle">
              {t("v1wf.watch.strayDescription")}
            </p>
            {orphans.map((object) => (
              <div key={object.slug} className="attention-agent-head">
                <span className="text-body-sm">{object.slug}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={action.pending}
                  onClick={() =>
                    void action.run(() =>
                      agents.save(agent.key, {
                        attention: { [object.slug]: null },
                      }),
                    )
                  }
                >
                  {t("v1wf.watch.deleteSlug", { slug: object.slug })}
                </Button>
              </div>
            ))}
          </section>
        )}
        {empty && (
          <AttentionEmptyState name={agent.name} picture={agent.picture} />
        )}
      </div>
    );
  }
  function WatchingTab({
    agent: { key },
    open,
    canOpen,
  }: {
    agent: { key: string };
    open?: ((target: string) => boolean) | undefined;
    canOpen?: ((target: string) => boolean) | undefined;
  }) {
    useLanguage();
    const page = React.useRef<HTMLElement>(null);
    const snapshot = React.useSyncExternalStore(
      agents.subscribe,
      agents.snapshot,
      agents.snapshot,
    );
    const connection = React.useSyncExternalStore(
      relay.subscribe,
      relay.snapshot,
      relay.snapshot,
    );
    const queries =
      connection.status === "ready" ? connection.session.channels : undefined;
    React.useEffect(() => queries?.ensureList(), [queries]);
    const channels = React.useSyncExternalStore<{
      channels: readonly Channel[];
    }>(
      queries?.subscribeList ?? none,
      queries?.list ?? emptyChannels,
      queries?.list ?? emptyChannels,
    ).channels;
    const agent = snapshot.running.find((agent) => agent.key === key);
    const here = (() => {
      try {
        return (
          !!agent &&
          relayPartition(relayOrigin(agent.relay), agent.owner) ===
            connection.scope
        );
      } catch {
        return false;
      }
    })();
    return (
      <section
        data-buzz-ui=""
        className="attention-page"
        aria-label={t("v1wf.watch.attention")}
        ref={page}
        tabIndex={-1}
      >
        <div className="attention-content">
          {agent &&
            here &&
            snapshot.classifier !== "available" &&
            Object.values(agent.attention).some(
              ({ value }) => value.type === "event" && value.classifier,
            ) && (
              <p className="text-body-sm text-secondary">
                {t("v1wf.watch.noClassifier")}
              </p>
            )}
          {agent && here ? (
            <OpenLink.Provider value={open && canOpen && { open, canOpen }}>
              <AgentPanel
                agent={agent}
                returnFocus={page}
                channels={channels}
                scope={connection.scope}
                session={connection.session}
              />
            </OpenLink.Provider>
          ) : (
            <p
              className="text-body-sm text-secondary"
              role={snapshot.status === "loading" ? "status" : undefined}
            >
              {!connection.scope
                ? t("v1wf.watch.chooseCommunity")
                : snapshot.status === "loading"
                  ? t("v1wf.watch.loading")
                  : agent
                    ? t("v1wf.watch.otherCommunity")
                    : t("v1wf.watch.notRunning")}
            </p>
          )}
        </div>
      </section>
    );
  }
  return {
    WatchingTab,
    AgentPanel,
    Interest,
    Instructions,
    Subscription,
    Destination,
    Message,
    Entry,
    InterestStatus,
    Switch,
  };
}

export function createTab(
  context: Pick<Context, "agents" | "relay" | "navigation">,
) {
  return createAttentionComponents(context).WatchingTab;
}
