import { t, useLanguage } from "../../shared/i18n";
import { ResolvePull } from "./ResolvePull";
import type { PullChecklist as Checklist } from "./pull";
import { Button } from "../../shared/design-system/ui/Button";
import { Tabs } from "../../shared/design-system/ui/Tabs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowSquareOutIcon,
  GitPullRequestIcon,
  GitHubIssueIcon,
  GitCommitIcon,
  FolderSimpleIcon,
  GithubLogoIcon,
} from "../../shared/design-system/icons/index";
import type { PluginModule } from "../../plugins/api";
import type { PanelProps } from "../../features/panels/service";
import { parseGitHubReference, type GitHubReference } from "./references";
import {
  gitHubCli,
  gitHubDiff,
  GitHubError,
  type GitHubCli,
  type GitHubDiff,
} from "./gh";
import { loadGitHubObject, readable, type GitHubObject } from "./object";
import { PublicChecklist, PullChecklist } from "./PullChecklist";
import styles from "./GitHub.module.css";
import inlineStyles from "../../shared/InlineReference.module.css";
import { GitHubBody } from "./GitHubBody";
import {
  formattingLocale,
  languagePreference,
} from "../../shared/i18n/language";
import { rich } from "../../shared/i18n/rich";
import { clockHourCycle, useClockFormat } from "../../shared/clock-preference";
import type { RelaySession } from "../../features/relay/session";
import { ownSolo } from "../../features/solo/labels";
import { createSoloPulls, writeLink, type SoloPulls } from "./solo-pull";
import {
  createPullStates,
  PANEL_REFRESH_MS,
  type PullDetails,
  type PullStates,
} from "./pull-states";
import { addPullStateTool } from "./pull-state-tool";
import { isRetryableRead, retryRead } from "../../features/relay/read-retry";
import { stateIcons } from "./pull-state-view";
import { PullLink } from "./PullLink";
import {
  SoloPullIcon,
  SoloPullLink,
  SoloPullMenu,
  SoloPullLauncher,
} from "./SoloPull";
import { watchPulls } from "./watcher";
import { presentPull } from "./attention";
import { SubmitReview } from "./SubmitReview";
import { PullFiles } from "./PullFiles";
import { GitHubSettings } from "./GitHubSettings";
import { openGitHubLinksInBuzz } from "./link-preference";

/** How often an open pull request panel reads GitHub again. */
export const REFRESH_MS = PANEL_REFRESH_MS;

export const inject = ["panels", "host", "conversation", "relay", "agents"];
export const apply: PluginModule["apply"] = (ctx) => {
  const gh = gitHubCli(ctx.host);
  const diff = gitHubDiff(ctx.host);
  // A pull request's state is nobody's community's: one store serves every
  // session's sidebar, every link in messages, the panel and agents, so one
  // shown in several places costs one read.
  const states = createPullStates(gh);
  const pulls = new WeakMap<RelaySession, SoloPulls>();
  const pullsFor = (session: RelaySession) => {
    let found = pulls.get(session);
    if (!found) {
      found = createSoloPulls(session, states);
      pulls.set(session, found);
    }
    return found;
  };
  ctx.panels.register({
    id: "object",
    title: "GitHub",
    channelLauncher: (props) => (
      <SoloPullLauncher {...props} relay={ctx.relay} pullsFor={pullsFor} />
    ),
    deferUntilShown: true,
    matches: (target) =>
      openGitHubLinksInBuzz() && !!parseGitHubReference(target),
    component: (props: PanelProps) => {
      const channelId = props.context?.channelId;
      return (
        <GitHubPanel
          {...props}
          gh={gh}
          diff={diff}
          states={states}
          {...(channelId && {
            resolveActions: (
              url: string,
              pull: Checklist,
              action: "failures" | "conflicts",
            ) => (
              <ResolvePull
                relay={ctx.relay}
                channelId={channelId}
                rootId={props.context?.rootId}
                url={url}
                pull={pull}
                action={action}
              />
            ),
            chatLink: (url: string) => (
              <SoloPullLink
                relay={ctx.relay}
                pullsFor={pullsFor}
                channelId={channelId}
                url={url}
              />
            ),
          })}
        />
      );
    },
  });
  ctx.conversation.registerLink({
    id: "pull",
    title: "Pull request and issue state",
    matches: (url) => {
      const kind = parseGitHubReference(url, { pullSubtargets: true })?.kind;
      return kind === "pull" || kind === "issue";
    },
    // Links claims GitHub at the default band, 0, and a tie falls to the
    // contribution key; only a lower order makes this the pull request and
    // issue renderer whichever plugin registered first. Repositories and
    // commits stay with Links.
    order: -1,
    className: inlineStyles.link,
    component: ({ url }) => <PullLink url={url} states={states} />,
  });
  ctx.conversation.registerChatMenu(({ session, channelId }) => (
    <SoloPullMenu
      session={session}
      pulls={pullsFor(session)}
      channelId={channelId}
    />
  ));
  ctx.conversation.registerChatIcon(({ session, channelId, fallback }) => (
    <SoloPullIcon
      pulls={pullsFor(session)}
      channelId={channelId}
      fallback={fallback}
    />
  ));
  ctx.agents.addTool({
    name: "github_link_pr",
    description:
      "Links a GitHub pull request to this Solo chat, so the owner's sidebar shows its state (draft, checks, merged) in place of the chat's icon. A chat has one; linking another replaces it.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The pull request's https://github.com/… URL",
        },
        unlink: {
          type: "boolean",
          description: "Unlink the chat's pull request instead",
        },
      },
      additionalProperties: false,
    },
    async call(client, context, args) {
      const url =
        args.unlink === true
          ? null
          : typeof args.url === "string"
            ? parseGitHubReference(args.url)
            : undefined;
      if (url !== null && url?.kind !== "pull")
        throw new Error("url must be a GitHub pull request URL");
      const relay = ctx.agents.relay(client.key)?.snapshot();
      const channel = context.channel;
      const session = relay?.status === "ready" ? relay.session : undefined;
      if (!session || !channel)
        throw new Error("github_link_pr needs this conversation's community");
      if (
        !ownSolo(
          session.channels.list().channels.find((item) => item.id === channel),
          session.viewer,
        )
      )
        throw new Error("Only a Solo chat can be linked to a pull request");
      const link = url === null ? null : url.url;
      await writeLink(session, channel, link);
      pullsFor(session).linked(channel, link);
      // The sidebar reads the selected community through its own session.
      const shown = ctx.relay.snapshot();
      if (shown.status === "ready" && shown.scope === relay?.scope)
        pullsFor(shown.session).linked(channel, link);
      return link
        ? `Linked ${link}. The sidebar shows its state for this chat.`
        : "Unlinked this chat's pull request.";
    },
  });
  addPullStateTool(ctx.agents, states);
  // Agents can watch pull requests where the app runs them.
  ctx.inject(["agents", "host", "navigation"], (scope) =>
    watchPulls(scope, states, gh, presentPull(scope.navigation)),
  );
  // One settings destination for the plugin, retaining its existing deep link.
  ctx.inject(["settingsCards"], (scope) => {
    scope.settingsCards.register({
      id: "authors",
      title: "GitHub",
      group: "Plugins",
      icon: GithubLogoIcon,
      component: ({ active }) => <GitHubSettings active={active} gh={gh} />,
    });
  });
};
/** A repository, issue or commit, read when the panel opens. */
function useGitHubObject(
  reference: GitHubReference,
  gh: GitHubCli | undefined,
  enabled: boolean,
) {
  const [loaded, setLoaded] = useState<GitHubObject | string>();
  const live = useRef<AbortController>(undefined);
  const load = useCallback(async () => {
    live.current?.abort();
    const controller = new AbortController();
    live.current = controller;
    try {
      const next = await loadGitHubObject(
        reference,
        AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        gh,
      );
      if (!controller.signal.aborted) setLoaded(next);
    } catch (error) {
      if (!controller.signal.aborted)
        setLoaded(error instanceof Error ? error.message : String(error));
    }
  }, [reference, gh]);
  useEffect(() => {
    if (!enabled) return;
    void load();
    return () => live.current?.abort();
  }, [enabled, load]);
  return { loaded, load };
}

/** A pull request's details from the store, kept current while shown:
 * always the latest the store has. Opening it reads GitHub; that read
 * retries transient failures quietly, and shows an error only while nothing
 * is held. */
function usePullPanel(states: PullStates, url: string, enabled: boolean) {
  const subscribe = useCallback(
    (listener: () => void) =>
      enabled ? states.watch(url, listener, "details") : () => {},
    [states, url, enabled],
  );
  const state = useSyncExternalStore(subscribe, () =>
    enabled ? states.get(url) : undefined,
  );
  const held = typeof state === "object" ? state.details : undefined;
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    // Opening the panel reads GitHub, as it always has.
    retryRead(
      async () => {
        const read = await states.read(url, {
          maxAge: 0,
          level: "details",
          interactive: true,
        });
        if (typeof read.state !== "object" || !read.state.details)
          throw read.error ?? new Error("GitHub did not answer");
        return read;
      },
      controller.signal,
      (failure) =>
        isRetryableRead(failure) ||
        (failure instanceof GitHubError &&
          (failure.type === "INTERNAL" ||
            failure.type === "SERVICE_UNAVAILABLE")),
    ).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(readable(failure).message);
    });
    return () => controller.abort();
  }, [states, url, enabled]);
  const load = useCallback(async () => {
    // What changed is shown once read; a failed read keeps what is shown.
    await states
      .read(url, { maxAge: 0, level: "details", interactive: true })
      .catch(() => {});
  }, [states, url]);
  const loaded: GitHubObject | string | undefined = held ?? error;
  return { loaded, load };
}

const labels = {
  repository: "githubRead.kind.repository",
  pull: "githubRead.kind.pull",
  issue: "githubRead.kind.issue",
  commit: "githubRead.kind.commit",
} as const;
const icons = {
  repository: FolderSimpleIcon,
  pull: GitPullRequestIcon,
  issue: GitHubIssueIcon,
  commit: GitCommitIcon,
};

// These captions belong to the finite UI fields constructed by data/object/pull.
function factCaption(label: string) {
  switch (label) {
    case "Branch":
      return t("githubRead.fact.branch");
    case "Files changed":
      return t("githubRead.fact.files");
    case "Changes":
      return t("githubRead.changes");
    case "Comments":
      return t("githubRead.fact.comments");
    case "Stars":
      return t("githubRead.fact.stars");
    case "Language":
      return t("githubRead.fact.language");
    case "Default branch":
      return t("githubRead.fact.defaultBranch");
    default:
      return label;
  }
}
function stateCaption(state: string) {
  switch (state) {
    case "open":
      return t("githubRead.state.open");
    case "closed":
      return t("githubRead.state.closed");
    case "Draft":
      return t("githubRead.state.draft");
    case "Merged":
      return t("githubRead.state.merged");
    default:
      return state;
  }
}
function countCaption(value: number) {
  return languagePreference() === "en"
    ? String(value)
    : new Intl.NumberFormat(formattingLocale()).format(value);
}
// Keep the canonical elapsed-age ladder; never parse its English output.
function updatedAge(unixSeconds: number, nowSeconds = Date.now() / 1000) {
  const age = Math.max(0, nowSeconds - unixSeconds);
  if (age < 60) return t("githubRead.age.now");
  if (age < 3600) {
    const count = Math.floor(age / 60);
    return t(count === 1 ? "githubRead.age.minute" : "githubRead.age.minutes", {
      count,
    });
  }
  if (age < 86400) {
    const count = Math.floor(age / 3600);
    return t(count === 1 ? "githubRead.age.hour" : "githubRead.age.hours", {
      count,
    });
  }
  if (age < 604800) {
    const count = Math.floor(age / 86400);
    return t(count === 1 ? "githubRead.age.day" : "githubRead.age.days", {
      count,
    });
  }
  return t("githubRead.age.date", {
    date: new Date(unixSeconds * 1000).toLocaleDateString(formattingLocale(), {
      month: "short",
      day: "numeric",
    }),
  });
}
function updatedTitle(value: string) {
  const hourCycle = clockHourCycle();
  return new Date(value).toLocaleString(
    formattingLocale(),
    hourCycle ? { hourCycle } : {},
  );
}

export function GitHubPanel({
  target,
  gh,
  diff,
  states: shared,
  chatLink,
  resolveActions,
}: PanelProps & {
  resolveActions?:
    | ((
        url: string,
        pull: Checklist,
        action: "failures" | "conflicts",
      ) => ReactNode)
    | undefined;
  /** The person's `gh`, where the app can run it. */
  gh?: GitHubCli | undefined;
  diff?: GitHubDiff | undefined;
  /** The plugin's pull request store; a panel alone keeps its own. */
  states?: PullStates | undefined;
  /** Links a pull request to the chat the panel was opened from. */
  chatLink?: ((url: string) => ReactNode) | undefined;
}) {
  useLanguage();
  const [attempt, retry] = useState(0);
  const reference = useMemo(() => parseGitHubReference(target), [target]);
  const own = useMemo(
    () => (shared ? undefined : createPullStates(gh)),
    [shared, gh],
  );
  const states = shared ?? own;
  return reference && states ? (
    <ObjectPanel
      key={`${reference.url}:${attempt}`}
      reference={reference}
      gh={gh}
      diff={diff}
      states={states}
      chatLink={chatLink}
      resolveActions={resolveActions}
      retry={() => retry(attempt + 1)}
    />
  ) : (
    <p className="notice">{t("githubRead.unsupported")}</p>
  );
}

function ObjectPanel({
  reference,
  gh,
  diff,
  states,
  chatLink,
  resolveActions,
  retry,
}: {
  reference: GitHubReference;
  gh: GitHubCli | undefined;
  diff: GitHubDiff | undefined;
  states: PullStates;
  chatLink: ((url: string) => ReactNode) | undefined;
  resolveActions:
    | ((
        url: string,
        pull: Checklist,
        action: "failures" | "conflicts",
      ) => ReactNode)
    | undefined;
  retry(): void;
}) {
  useLanguage();
  useClockFormat();
  const isPull = reference.kind === "pull";
  const pull = usePullPanel(states, reference.url, isPull);
  const [view, setView] = useState<"summary" | "changes">("summary");
  // Files changed stays mounted once shown, so going back to it doesn't read
  // the diff again.
  const [changesShown, setChangesShown] = useState(false);
  const other = useGitHubObject(reference, gh, !isPull);
  const loaded = isPull ? pull.loaded : other.loaded;
  const load = isPull ? pull.load : other.load;
  const link = reference.url;
  const result = typeof loaded === "object" ? loaded.details : loaded;
  const Icon = icons[reference.kind];
  const state = typeof result === "object" ? result.state.toLowerCase() : "";
  const StateIcon =
    reference.kind === "pull" && Object.hasOwn(stateIcons, state)
      ? stateIcons[state as keyof typeof stateIcons]
      : undefined;
  const [owner, repositoryName] = reference.repository.split("/");
  const files =
    diff && gh && typeof loaded === "object" && loaded.checklist
      ? {
          repository: reference.repository,
          base: loaded.checklist.base,
          head: loaded.checklist.head,
          merged:
            loaded.checklist.state === "merged"
              ? Number(reference.label.slice(1))
              : undefined,
          diff,
        }
      : undefined;
  const counts =
    typeof result === "object"
      ? result.facts
          .map(([, value]) => value)
          .find(
            (value): value is { additions: number; deletions: number } =>
              typeof value === "object" && "additions" in value,
          )
      : undefined;
  const showChanges = !!files && view === "changes";
  const title = (
    <h2 className={reference.kind === "pull" ? styles.pullTitle : undefined}>
      {reference.kind === "pull" ? (
        <a
          className={`${inlineStyles.link} ${styles.titleLink}`}
          href={link}
          target="_blank"
          rel="noreferrer"
        >
          {typeof result === "object" ? result.title : t(labels.pull)}{" "}
          <span className={styles.titleNumber}>{reference.label}</span>
        </a>
      ) : (
        typeof result === "object" && result.title
      )}
    </h2>
  );
  return (
    <div className={styles.root}>
      <div className={styles.identity}>
        <span className={styles.icon}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <div>
          {reference.kind === "pull" ? (
            <>
              <div className={styles.repository}>
                <a
                  className={inlineStyles.link}
                  href={`https://github.com/${owner}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {owner}
                </a>
                <span className={styles.repositorySeparator}> / </span>
                <a
                  className={inlineStyles.link}
                  href={`https://github.com/${reference.repository}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {repositoryName}
                </a>
              </div>
              <small>{t(labels[reference.kind])}</small>
            </>
          ) : (
            <>
              <small>{reference.repository}</small>
              <strong>
                {t(labels[reference.kind])} {reference.label}
              </strong>
            </>
          )}
        </div>
        {/* Pull requests someone else opened take reviews. */}
        {gh &&
          typeof loaded === "object" &&
          loaded.checklist &&
          !loaded.checklist.authored && (
            <span className={styles.identityAction}>
              <SubmitReview pull={loaded.checklist} gh={gh} refresh={load} />
            </span>
          )}
      </div>
      {files && (
        <div className={styles.views}>
          <Tabs
            label={t("githubRead.view")}
            variant="segmented"
            size="sm"
            value={view}
            items={[
              { value: "summary", label: t("githubRead.summary") },
              {
                value: "changes",
                label: t("githubRead.changes"),
                trailing: counts && (
                  <span className={styles.tabCounts}>
                    <span className={styles.additions}>
                      +{countCaption(counts.additions)}
                    </span>{" "}
                    <span className={styles.deletions}>
                      −{countCaption(counts.deletions)}
                    </span>
                  </span>
                ),
              },
            ]}
            onValueChange={(next) => {
              setView(next);
              if (next === "changes") setChangesShown(true);
            }}
          />
        </div>
      )}
      {files && changesShown && (
        <div hidden={!showChanges}>
          <PullFiles
            key={`${files.base}...${files.head}:${files.merged}`}
            url={reference.url}
            pull={files}
            diff={files.diff}
          />
        </div>
      )}
      {reference.kind !== "pull" && (
        <a
          className={styles.external}
          href={reference.url}
          target="_blank"
          rel="noreferrer"
        >
          {t("githubRead.external")} <ArrowSquareOutIcon size={14} />
        </a>
      )}
      {!showChanges && (
        <>
          {reference.kind === "pull" && typeof result !== "object" && title}
          {result === undefined ? (
            <p role="status">{t("githubRead.loading")}</p>
          ) : typeof result === "string" ? (
            <div role="alert">
              <p>{result}</p>
              <div className={styles.errorActions}>
                <Button
                  variant="prominent"
                  nativeButton={false}
                  role="link"
                  render={
                    <a
                      className={styles.errorExternal}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <span className={styles.errorActionLabel}>
                    {t("githubRead.errorExternal")}
                  </span>
                </Button>
                <Button type="button" onClick={retry}>
                  {t("githubRead.retry")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {reference.kind === "pull" && title}
              <div className={styles.byline}>
                {result.state && (
                  <span
                    className={styles.state}
                    data-pr-state={
                      reference.kind === "pull"
                        ? result.state.toLowerCase()
                        : undefined
                    }
                  >
                    {StateIcon && <StateIcon size={12} aria-hidden="true" />}
                    {stateCaption(result.state)}
                  </span>
                )}
                {result.author && (
                  <span>
                    {rich("githubRead.author", {
                      author: result.authorUrl ? (
                        <a
                          className={inlineStyles.link}
                          href={result.authorUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {result.author}
                        </a>
                      ) : (
                        result.author
                      ),
                    })}
                  </span>
                )}
              </div>
              {reference.kind !== "pull" && title}
              {(!!result.facts.length || reference.kind === "pull") && (
                <dl className={styles.facts}>
                  {result.facts.map(([label, value]) => (
                    <div key={label}>
                      <dt>{factCaption(label)}</dt>
                      <dd>
                        {typeof value !== "object" ? (
                          typeof value === "number" ? (
                            countCaption(value)
                          ) : (
                            value
                          )
                        ) : "head" in value ? (
                          <>
                            {value.head.url ? (
                              <a
                                className={styles.branch}
                                href={value.head.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {value.head.label}
                              </a>
                            ) : (
                              <span className={styles.branchLabel}>
                                {value.head.label}
                              </span>
                            )}
                            {" → "}
                            {value.base.url ? (
                              <a
                                className={styles.branch}
                                href={value.base.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {value.base.label}
                              </a>
                            ) : (
                              <span className={styles.branchLabel}>
                                {value.base.label}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className={styles.additions}>
                              +{countCaption(value.additions)}
                            </span>
                            {" / "}
                            <span className={styles.deletions}>
                              −{countCaption(value.deletions)}
                            </span>
                          </>
                        )}
                      </dd>
                    </div>
                  ))}
                  {reference.kind === "pull" && (
                    <div>
                      <dt>{t("githubRead.updated")}</dt>
                      <dd>
                        {result.updatedAt ? (
                          <time
                            dateTime={result.updatedAt}
                            title={updatedTitle(result.updatedAt)}
                          >
                            {updatedAge(Date.parse(result.updatedAt) / 1000)}
                          </time>
                        ) : (
                          t("githubRead.unavailable")
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              {reference.kind === "pull" ? (
                <>
                  {typeof loaded === "object" && loaded.checklist && gh ? (
                    <PullChecklist
                      url={reference.url}
                      details={result}
                      checklist={loaded.checklist}
                      gh={gh}
                      refresh={load}
                      resolveAction={(action) =>
                        loaded.checklist
                          ? resolveActions?.(
                              reference.url,
                              loaded.checklist,
                              action,
                            )
                          : undefined
                      }
                    />
                  ) : (
                    <PublicChecklist
                      url={reference.url}
                      sha={result.headSha}
                      checks={
                        typeof loaded === "object" && "publicChecks" in loaded
                          ? (loaded as PullDetails).publicChecks
                          : undefined
                      }
                    />
                  )}
                  {chatLink?.(reference.url)}
                  {result.body && (
                    <div className={styles.description}>
                      <GitHubBody
                        body={result.body}
                        bodyHtml={result.bodyHtml}
                        url={reference.url}
                      />
                    </div>
                  )}
                </>
              ) : (
                result.body && (
                  <GitHubBody
                    body={result.body}
                    bodyHtml={result.bodyHtml}
                    url={reference.url}
                  />
                )
              )}
            </>
          )}
        </>
      )}
      {typeof loaded === "object" && (
        <p className={styles.note}>
          {loaded.signedIn ? t("githubRead.signedIn") : t("githubRead.public")}
        </p>
      )}
    </div>
  );
}
