import { interestPaused } from "../../features/agents/attention";
import * as React from "react";
import type { Context } from "../../plugins/author";
import type { Agent, Watch } from "./model";
import type { RelaySession } from "../../features/relay/session";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import { sourceCompleted } from "../../features/agents/attention";
import {
  ChatCircleIcon,
  GearIcon,
  HashIcon,
  ClockIcon,
  TerminalWindowIcon,
  CodeIcon,
  ArrowSquareOutIcon,
  CaretRightIcon,
  CircleIcon,
} from "../../shared/design-system/icons";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPopup,
} from "../../shared/design-system/ui/Popover";
import {
  MenuRoot,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuGroup,
  MenuGroupLabel,
  MenuSeparator,
  MenuNote,
} from "../../shared/design-system/ui/Menu";
import { ActivityExpansion } from "../../features/messages/ActivityExpansion";
import {
  title,
  heading,
  describe,
  channelIcon,
  type Channel,
} from "./presentation";
import { problem, useAction } from "./actions";
import { createAttentionActivity } from "./Activity";
import { t, useLanguage } from "../../shared/i18n";
export function createWatchComponents({
  agents,
  navigation,
}: Pick<Context, "agents" | "navigation">) {
  const h = React.createElement;
  const activity = createAttentionActivity(navigation);
  const { Destination, WatchActivity } = activity;
  function Subscription({
    agent,
    slug,
    watch,
    name,
    find,
    scope,
    session,
    returnFocus,
  }: {
    agent: Agent;
    slug: string;
    watch: Watch;
    name(id: string): string;
    find(id: string): Channel | undefined;
    scope?: string | undefined;
    session?: RelaySession | undefined;
    returnFocus: React.RefObject<HTMLElement | null>;
  }) {
    useLanguage();
    const row = React.useRef<HTMLLIElement>(null);
    const popup = React.useRef<HTMLDivElement>(null);
    React.useLayoutEffect(
      () => () => {
        if (
          row.current?.contains(document.activeElement) ||
          popup.current?.contains(document.activeElement)
        )
          returnFocus.current?.focus();
      },
      [returnFocus],
    );
    const [open, setOpen] = React.useState(false);
    const action = useAction();
    const trigger = React.useRef<HTMLButtonElement>(null);
    const cancel = React.useRef<HTMLButtonElement>(null);
    // The watch as the open dialog reviewed it; a watch changed meanwhile
    // is refused rather than deleted unseen.
    const [confirming, setConfirming] =
      React.useState<Agent["attention"][string]>();
    const remove = (expected: Agent["attention"][string]) =>
      action.run(async () => {
        await agents.save(agent.key, {
          attentionExpected: { [slug]: expected },
          attention: { [slug]: null },
        });
        setConfirming(undefined);
      });
    const detailsId = React.useId();
    const history = agent.attentionHistory?.[slug];
    const command =
      watch.type === "source" && watch.provider === "attention/command";
    const timer = agent.timers[slug];
    const description = describe(
      watch,
      Date.now() / 1000,
      watch.type === "timer" && timer?.armedAt === watch.armed_at
        ? timer.used
        : undefined,
    );
    // Timers have no name; a nameless watch is labelled by its Interest.
    const ownName = "name" in watch && watch.name;
    const label = heading(ownName || title(watch.interest_id ?? slug.slice(6)));
    const completed = sourceCompleted(agent.sourceRuns, agent.attention[slug]);
    const state =
      watch.enabled &&
      !interestPaused(agent.attention, watch.interest_id) &&
      !completed &&
      !description.spent
        ? "Active"
        : "Paused";
    const section = (label: string, content: React.ReactNode) => (
      <dl key={label} className="attention-expanded-meta text-body-sm">
        <div>
          <dt className="text-subtle">{label}</dt>
          <dd>{content}</dd>
        </div>
      </dl>
    );
    const shown =
      watch.type === "source"
        ? agents.presentWatch(watch, label.text)
        : undefined;
    const {
      type,
      icon: TypeIcon,
      target,
    } = (() => {
      switch (watch.type) {
        case "event":
          return {
            type: t("v1wf.watch.messages"),
            icon: ChatCircleIcon,
            target:
              watch.channels === "all"
                ? t("v1wf.watch.allJoined")
                : watch.channels.map(name).join(", "),
          };
        case "timer":
          return {
            type: t("v1wf.watch.schedule"),
            icon: ClockIcon,
            target: description.title,
          };
        case "source": {
          const command = watch.provider === "attention/command";
          const commandTitle =
            command && Array.isArray(watch.config.command)
              ? watch.name ||
                watch.config.command
                  .slice(0, 2)
                  .map((part, index) =>
                    index ? part : String(part).split(/[\\/]/).pop(),
                  )
                  .join(" ")
              : label.text;
          return {
            type: command
              ? t("v1wf.watch.command")
              : (shown?.type ?? t("v1wf.watch.function")),
            icon: command ? TerminalWindowIcon : (shown?.icon ?? CodeIcon),
            target: shown?.target || commandTitle,
          };
        }
      }
    })();
    const technicalFilters =
      watch.type === "event" &&
      Boolean(
        watch.authors?.length ||
          watch.exclude_authors?.length ||
          Object.keys(watch.tags ?? {}).length ||
          watch.kinds?.length !== 1 ||
          watch.kinds[0] !== 9,
      );
    const destination = t("v1wf.watch.independentTurn");
    return (
      <li
        ref={row}
        className="attention-card"
        data-expanded={open || undefined}
        data-disabled={!watch.enabled || undefined}
        data-paused={
          completed || description.spent || !watch.enabled ? "" : undefined
        }
      >
        <div className="attention-table-row">
          <button
            className="attention-heading"
            type="button"
            aria-label={t("v1wf.watch.detailsFor", { label: label.text })}
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen(!open)}
          >
            <TypeIcon size={16} aria-hidden={true} />
            <span
              className="attention-title text-body-sm text-primary"
              title={watch.type === "timer" ? description.title : label.text}
            >
              {watch.type === "timer" ? description.title : label.text}
            </span>
          </button>
          {watch.type !== "timer" && (
            <div className="attention-reference">
              <div className="attention-reference-item">
                <PopoverRoot>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        size="xs"
                        style={{
                          paddingInlineStart: "var(--space-2)",
                        }}
                        aria-label={t("v1wf.watch.sourceDetailsFor", {
                          label: label.text,
                        })}
                      >
                        <span className="attention-pill-icon">
                          {h(watch.type === "event" ? HashIcon : TypeIcon, {
                            size: 12,
                            "aria-hidden": true,
                          })}
                        </span>
                        <span className="attention-reference-label">
                          {watch.type === "event"
                            ? watch.channels === "all"
                              ? t("v1wf.watch.allChannels")
                              : watch.channels.length === 1
                                ? name(watch.channels[0] ?? "")
                                : t("v1wf.watch.channelCount", {
                                    count: watch.channels.length,
                                  })
                            : (shown?.target ?? type)}
                        </span>
                      </Button>
                    }
                  />
                  <PopoverPopup
                    align="end"
                    aria-label={t("v1wf.watch.sourceDetailsFor", {
                      label: label.text,
                    })}
                    finalFocus={() =>
                      row.current?.isConnected
                        ? true
                        : (returnFocus.current ?? false)
                    }
                  >
                    <div className="attention-popover-content">
                      {watch.type === "event" ? (
                        <dl className="attention-expanded-meta attention-channel-table text-body-sm">
                          <div>
                            <dt className="text-subtle">
                              {t("v1wf.watch.watches")}
                            </dt>
                            <dd>
                              {watch.channels === "all"
                                ? t("v1wf.watch.allJoined")
                                : watch.channels.map((channel) => (
                                    <div
                                      key={channel}
                                      className="attention-destination-label"
                                    >
                                      {h(channelIcon(find(channel)), {
                                        size: 16,
                                        "aria-hidden": true,
                                      })}
                                      {name(channel)}
                                    </div>
                                  ))}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-subtle">
                              {t("v1wf.watch.deliversToLabel")}
                            </dt>
                            <dd>
                              {watch.channel
                                ? watch.root
                                  ? t("v1wf.watch.thread", {
                                      name: name(watch.channel),
                                    })
                                  : name(watch.channel)
                                : t("v1wf.watch.independentTurn")}
                            </dd>
                          </div>
                        </dl>
                      ) : watch.provider === "attention/command" ? (
                        <pre className="attention-command text-mono">
                          {Array.isArray(watch.config.command)
                            ? watch.config.command.join(" ")
                            : label.text}
                        </pre>
                      ) : (
                        <dl className="attention-expanded-meta attention-channel-table text-body-sm">
                          <div>
                            <dt className="text-caption text-subtle">{type}</dt>
                            <dd>{target}</dd>
                          </div>
                        </dl>
                      )}
                      {shown?.link && (
                        <Button
                          variant="link"
                          size="inline"
                          nativeButton={false}
                          role="link"
                          aria-label={t("v1wf.watch.openTarget", { target })}
                          render={(props) => (
                            <a
                              {...props}
                              href={shown.link?.href}
                              target="_blank"
                              rel="noreferrer"
                            />
                          )}
                        >
                          <ArrowSquareOutIcon size={16} aria-hidden={true} />
                          {shown.link.title}
                        </Button>
                      )}
                      {shown?.details && h(shown.details)}
                    </div>
                  </PopoverPopup>
                </PopoverRoot>
              </div>
            </div>
          )}
          <div className="attention-destination">
            {watch.channel ? (
              <Destination
                channel={watch.channel}
                root={watch.root}
                name={name(watch.channel)}
                scope={scope}
                summary={find(watch.channel)}
                prefix=""
                compact={true}
              />
            ) : (
              <span className="text-caption text-subtle">
                {t("v1wf.watch.independentTurn")}
              </span>
            )}
          </div>
          <div className="attention-status">
            <MenuRoot>
              <MenuTrigger
                render={
                  <Button
                    ref={trigger}
                    variant="subtle"
                    size="xs"
                    style={{ paddingInlineStart: "var(--space-2)" }}
                    aria-label={t("v1wf.watch.watchStatusFor", {
                      label: label.text,
                    })}
                  >
                    <span className="attention-pill-icon">
                      <CircleIcon
                        data-accent={state === "Active" ? "citrus" : undefined}
                        data-color-mode={
                          state === "Active" ? "light" : undefined
                        }
                        size={12}
                        aria-hidden={true}
                        fill="currentColor"
                        strokeWidth={0}
                        style={
                          state === "Active"
                            ? { color: "var(--affordance-accent-prominent)" }
                            : undefined
                        }
                        className={
                          state === "Active" ? undefined : "text-subtle"
                        }
                      />
                    </span>
                    <span>
                      {state === "Active"
                        ? t("v1wf.watch.active")
                        : t("v1wf.watch.paused")}
                    </span>
                  </Button>
                }
              />
              <MenuPopup
                size="compact"
                align="end"
                ref={popup}
                aria-label={t("v1wf.watch.watchStatusFor", {
                  label: label.text,
                })}
                finalFocus={() =>
                  row.current?.isConnected
                    ? true
                    : (returnFocus.current ?? false)
                }
              >
                <MenuGroup>
                  <MenuGroupLabel>{t("v1wf.watch.trigger")}</MenuGroupLabel>
                  <MenuItem
                    disabled={
                      action.pending ||
                      (watch.type === "timer" && !watch.enabled)
                    }
                    closeOnClick={false}
                    onClick={() =>
                      void action.run(async () => {
                        const expected = agent.attention[slug];
                        if (!expected)
                          throw new Error(t("v1wf.watch.watchGone"));
                        return agents.save(agent.key, {
                          watchEnabled: {
                            [slug]: { enabled: !watch.enabled, expected },
                          },
                        });
                      })
                    }
                  >
                    {watch.enabled
                      ? t("v1wf.watch.pause")
                      : t("v1wf.watch.resume")}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    tone="danger"
                    disabled={action.pending}
                    aria-label={t("v1wf.watch.deleteLabel", {
                      label: label.text,
                    })}
                    onClick={() => {
                      // Pause/Resume share this action; a refused Pause's
                      // error must not open inside the dialog.
                      action.reset();
                      setConfirming(agent.attention[slug]);
                    }}
                  >
                    {t("v1wf.watch.delete")}
                  </MenuItem>
                  {interestPaused(agent.attention, watch.interest_id) && (
                    <MenuNote>{t("v1wf.watch.interestPaused")}</MenuNote>
                  )}
                  {watch.type === "timer" && !watch.enabled && (
                    <MenuNote>
                      {t("v1wf.watch.askTimer", { name: agent.name })}
                    </MenuNote>
                  )}
                </MenuGroup>
              </MenuPopup>
            </MenuRoot>
          </div>
        </div>
        {confirming && (
          <AlertDialog
            // A nameless watch shares its Interest's label, and the Interest's
            // own dialog is a few pixels away, so name the kind instead.
            title={
              ownName
                ? t("v1wf.watch.deleteNamed", { label: label.text })
                : watch.type === "timer"
                  ? t("v1wf.watch.deleteTimer")
                  : t("v1wf.watch.deleteWatch")
            }
            description={
              watch.type === "timer"
                ? t("v1wf.watch.deleteTimerDescription")
                : t("v1wf.watch.deleteWatchDescription")
            }
            pending={action.pending}
            initialFocus={cancel}
            finalFocus={() =>
              trigger.current?.isConnected
                ? trigger.current
                : (returnFocus.current ?? false)
            }
            onClose={() => setConfirming(undefined)}
            actions={
              <>
                <Button
                  ref={cancel}
                  disabled={action.pending}
                  onClick={() => setConfirming(undefined)}
                >
                  {t("v1wf.watch.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  loading={action.pending}
                  onClick={() => void remove(confirming)}
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
        <ActivityExpansion open={open} className="attention-expansion">
          <div id={detailsId} className="attention-details">
            <details className="attention-watch-details">
              <summary
                className="attention-disclosure text-body-sm text-subtle"
                aria-label={t("v1wf.watch.watchDetailsFor", {
                  label: label.text,
                })}
              >
                <span className="attention-disclosure-icon">
                  <GearIcon size={16} aria-hidden={true} />
                </span>
                <span className="whitespace-nowrap">
                  {t("v1wf.watch.watchDetails")}
                </span>
                <span className="attention-detail-preview">{`${type} · ${watch.type === "event" ? (watch.classifier ? t("v1wf.watch.filteredMessages") : t("v1wf.watch.allMessages")) : watch.type === "timer" ? description.title : target}`}</span>
                <CaretRightIcon size={16} aria-hidden={true} />
              </summary>
              <div className="attention-configuration">
                <dl className="attention-expanded-meta text-body-sm">
                  <div>
                    <dt className="text-subtle">{t("v1wf.watch.source")}</dt>
                    <dd>{type}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">{t("v1wf.watch.runsIn")}</dt>
                    <dd>
                      {watch.channel ? (
                        <Destination
                          channel={watch.channel}
                          root={watch.root}
                          name={name(watch.channel)}
                          scope={scope}
                          summary={find(watch.channel)}
                          prefix=""
                        />
                      ) : (
                        destination
                      )}
                    </dd>
                  </div>
                  {history?.lastWokeAt && (
                    <div>
                      <dt className="text-subtle">
                        {t("v1wf.watch.lastWoke")}
                      </dt>
                      <dd>{relativeTimestamp(history.lastWokeAt)}</dd>
                    </div>
                  )}
                </dl>
                {watch.type === "source" &&
                watch.provider === "attention/command"
                  ? section(
                      t("v1wf.watch.command"),
                      <pre className="text-caption text-standard">
                        <code>
                          {Array.isArray(watch.config.command)
                            ? watch.config.command.join(" ")
                            : label.text}
                        </code>
                      </pre>,
                    )
                  : section(
                      t("v1wf.watch.trigger"),
                      watch.type === "source"
                        ? label.text
                        : watch.type === "event"
                          ? t(
                              watch.classifier
                                ? "v1wf.watch.newMessagesFiltered"
                                : "v1wf.watch.newMessagesIn",
                              {
                                channels:
                                  watch.channels === "all"
                                    ? t("v1wf.watch.allJoinedLower")
                                    : watch.channels.map(name).join(", "),
                              },
                            )
                          : `${description.title}. ${watch.prompt}`,
                    )}
                {!shown?.details && label.url && (
                  <a
                    href={label.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-body-sm"
                  >
                    {t("v1wf.watch.openTarget", { target: label.text })}
                  </a>
                )}
                {watch.type === "event" &&
                  (technicalFilters ||
                    watch.classifier ||
                    watch.is_reply !== undefined) &&
                  section(
                    t("v1wf.watch.filters"),
                    <div className="text-body-sm">
                      {watch.is_reply !== undefined && (
                        <p>
                          {watch.is_reply
                            ? t("v1wf.watch.repliesOnly")
                            : t("v1wf.watch.topLevelOnly")}
                        </p>
                      )}
                      {Object.entries(watch.classifier?.questions ?? {}).map(
                        ([id, question]) => (
                          <p key={id}>{question.question}</p>
                        ),
                      )}
                      {technicalFilters && (
                        <details>
                          <summary
                            className={
                              "attention-disclosure text-body-sm text-subtle"
                            }
                          >
                            {t("v1wf.watch.technicalFilters")}
                            <CaretRightIcon size={16} aria-hidden={true} />
                          </summary>
                          <pre className="text-caption text-standard">
                            {JSON.stringify(
                              {
                                kinds: watch.kinds ?? "all",
                                authors: watch.authors,
                                exclude_authors: watch.exclude_authors,
                                tags: watch.tags,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      )}
                    </div>,
                  )}
              </div>
            </details>
            <WatchActivity
              history={history}
              label={label.text}
              session={session}
              scope={scope}
              command={command}
              messages={watch.type === "event"}
            />
          </div>
        </ActivityExpansion>
      </li>
    );
  }

  return { Subscription, ...activity };
}
