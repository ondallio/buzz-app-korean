import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from "react";
import { useAgentChoices } from "../../features/agents/use-choices";
import type {
  CodeBlockRenderer,
  ContributionReader,
} from "../../features/conversation/contracts";
import {
  DOCUMENT_PROFILE,
  DOCUMENT_RENDER_CELLS,
} from "../../features/markdown/document-profile";
import { guardDocument } from "../../features/markdown/guard";
import {
  MarkdownDocument,
  MarkdownSource,
  sharedComponents,
} from "../../features/markdown/MarkdownDocument";
import { useIdentityNames } from "../../features/identity-names/react";
import { MAX_MARKDOWN_LENGTH } from "../../features/relay/message-content";
import { PanelWorkspace } from "../../features/panels/PanelWorkspace";
import { usePanelSplit } from "../../features/panels/usePanelSplit";
import type { Profile } from "../../features/relay/contracts";
import type { EventData } from "../../features/relay/events";
import { useRelayConnection } from "../../features/relay/react";
import type { RelayData } from "../../features/relay/service";
import type { RelaySession } from "../../features/relay/session";
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  NoteIcon,
  InfoIcon,
} from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPopup,
  PopoverTitle,
  PopoverDescription,
} from "../../shared/design-system/ui/Popover";
import { SurfaceButton } from "../../shared/design-system/ui/SurfaceButton";
import { Panel } from "../../shared/design-system/ui/Panel";
import {
  PanelHeader,
  PanelHeaderLabel,
} from "../../shared/design-system/ui/PanelHeader";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { avatarMedia } from "../../shared/avatar-source";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import {
  NOTE_LIMIT,
  emptyNotePage,
  readNotePage,
  noteHeads,
  noteKey,
  noteTag,
  noteTitle,
} from "./collection";
import styles from "./NotesPage.module.css";
import { formatPublicKey } from "../../shared/identity/public-key";
import type { PageProps } from "../../features/pages/service";
import type { Navigation } from "../../features/navigation/controller";
import { buzzLinkTarget } from "../../features/navigation/buzz-links";
import type { NavigationScope } from "../../features/navigation/targets";
import { notesRoute, notesTarget, type NotesRoute } from "./routes";
import type { Panels, RegisteredPanel } from "../../features/panels/service";
import { profileTarget } from "../../features/profiles/target";
import { t, useLanguage } from "../../shared/i18n";
const noSubscribe = () => () => {};
const noPanels: readonly RegisteredPanel[] = [];
const emptyPanels = () => noPanels;
type NotesNavigation = Pick<PageProps, "navigation"> & {
  navigator?: Navigation | undefined;
  panels?: Panels | undefined;
  /** Plugin code-block renderers for note bodies. */
  codeBlocks?: ContributionReader<CodeBlockRenderer> | undefined;
};

function NotesPanel({
  children,
  refresh,
  refreshRef,
  loading = false,
}: {
  children: ReactNode;
  refresh?: (() => void) | undefined;
  refreshRef?: Ref<HTMLButtonElement>;
  loading?: boolean;
}) {
  useLanguage();
  return (
    <Panel aria-label={t("v1wf.notes.title")}>
      <div className={styles.page}>
        <PanelHeader
          title={
            <PanelHeaderLabel
              title={t("v1wf.notes.title")}
              icon={<NoteIcon size="1rem" />}
            >
              <PopoverRoot>
                <PopoverTrigger
                  render={
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon={<InfoIcon size="1rem" aria-hidden="true" />}
                      aria-label={t("v1wf.notes.about")}
                      title={t("v1wf.notes.about")}
                    />
                  }
                />
                <PopoverPopup>
                  <PopoverTitle>{t("v1wf.notes.about")}</PopoverTitle>
                  <PopoverDescription
                    render={<div className={styles.description} />}
                  >
                    <p>{t("v1wf.notes.aboutBody1")}</p>
                    <p>{t("v1wf.notes.aboutBody2")}</p>
                  </PopoverDescription>
                </PopoverPopup>
              </PopoverRoot>
            </PanelHeaderLabel>
          }
          actions={
            refresh && (
              <>
                {loading && (
                  <span role="status" className="text-caption text-subtle">
                    {t("v1wf.notes.reading")}
                  </span>
                )}
                <IconButton
                  hint="familiar"
                  ref={refreshRef}
                  size="sm"
                  variant="ghost"
                  aria-label={t("v1wf.notes.refresh")}
                  title={t("v1wf.notes.refresh")}
                  icon={<ArrowsClockwiseIcon size="1rem" />}
                  onClick={refresh}
                />
              </>
            )
          }
        />
        <div className={styles.body}>{children}</div>
      </div>
    </Panel>
  );
}

export function NotesPage({
  relay,
  navigation,
  navigator,
  panels,
  codeBlocks,
}: { relay: RelayData } & NotesNavigation) {
  useLanguage();
  const connection = useRelayConnection(relay);
  const request = useMemo(
    () => navigation?.forSession(relay, connection),
    [navigation, relay, connection],
  );
  const scope = useMemo(
    () =>
      connection.viewer && connection.scope
        ? {
            viewer: connection.viewer,
            communityOrigin: connection.scope.slice(
              0,
              -(connection.viewer.length + 1),
            ),
          }
        : undefined,
    [connection.viewer, connection.scope],
  );
  useEffect(() => {
    if (
      request?.target.kind !== "page" ||
      request.target.scope !== undefined ||
      connection.status !== "ready" ||
      !scope
    )
      return;
    request.resolve({ ...request.target, scope });
  }, [request, connection.status, scope]);
  if (connection.status === "ready")
    return (
      <NotesCommunity
        key={`${connection.scope}:${connection.generation}`}
        session={connection.session}
        scope={scope}
        navigation={request}
        navigator={navigator}
        panels={panels}
        codeBlocks={codeBlocks}
      />
    );
  return (
    <NotesPanel>
      <p role="status">
        {connection.status === "connecting"
          ? t("v1wf.notes.connecting")
          : t("v1wf.notes.connect")}
      </p>
      {connection.status === "error" && (
        <>
          <p role="alert">{connection.error}</p>
          <Button onClick={() => relay.tryAgain()}>
            {t("v1wf.notes.retryConnection")}
          </Button>
        </>
      )}
    </NotesPanel>
  );
}

export function NotesCommunity({
  session,
  scope,
  navigation,
  navigator,
  panels,
  codeBlocks,
}: {
  session: RelaySession;
  scope?: NavigationScope | undefined;
} & NotesNavigation) {
  const choices = useAgentChoices(session);
  const resolveName = useIdentityNames(session.names);
  const candidates = useMemo(
    () => choices.identities.map((agent) => agent.pubkey),
    [choices.identities],
  );
  const agents = choices.identities.map((agent) => ({
    pubkey: agent.pubkey,
    picture: agent.avatar,
    name: resolveName(
      agent.pubkey,
      agent.managedName ?? agent.name,
      candidates,
      choices.identities,
    ),
  }));
  // Existing content includes archived identities; selecting a new recipient does not.
  const authors = choices.identities
    .map((agent) => agent.pubkey)
    .sort()
    .join(":");
  return (
    <NoteCollection
      key={authors}
      session={session}
      scope={scope}
      navigation={navigation}
      navigator={navigator}
      panels={panels}
      codeBlocks={codeBlocks}
      authors={authors}
      agents={agents}
      pending={choices.pending}
      complete={choices.complete}
      inventoryError={choices.error}
      refreshAgents={() => {
        void session.agentChoices.refresh().catch(() => {});
      }}
    />
  );
}

function NoteCollection({
  session,
  scope,
  authors,
  agents: ownedAgents,
  pending,
  complete,
  inventoryError,
  refreshAgents,
  navigation,
  navigator,
  panels,
  codeBlocks,
}: NotesNavigation & {
  session: RelaySession;
  scope?: NavigationScope | undefined;
  authors: string;
  agents: readonly {
    pubkey: string;
    name: string;
    picture?: string | undefined;
  }[];
  pending: boolean;
  complete: boolean;
  inventoryError: string | undefined;
  refreshAgents(): void;
}) {
  useLanguage();
  const [request, setRequest] = useState({ version: 0, more: false });
  const pages = useRef({ owned: emptyNotePage(), shared: emptyNotePage() });
  const sharedAgents = useRef(new Map<string, Profile>());
  const [result, setResult] = useState<{
    notes: EventData[];
    loading: boolean;
    partial: boolean;
    error?: string | undefined;
    sharedError?: string | undefined;
  }>({ notes: [], loading: true, partial: false });
  const profiles = useSyncExternalStore(
    session.profiles.subscribe,
    session.profiles.snapshot,
  );
  const resolveName = useIdentityNames(session.names);
  const agents = useMemo(() => {
    const others = [...new Set(result.notes.map((note) => note.pubkey))].filter(
      (pubkey) =>
        !ownedAgents.some((agent) => agent.pubkey === pubkey) &&
        sharedAgents.current.has(pubkey),
    );
    const candidates = [...ownedAgents.map((agent) => agent.pubkey), ...others];
    return [
      ...ownedAgents.map((agent) => ({ ...agent, owned: true })),
      ...others.map((pubkey) => ({
        pubkey,
        picture: (profiles.get(pubkey) ?? sharedAgents.current.get(pubkey))
          ?.picture,
        name: resolveName(
          pubkey,
          (profiles.get(pubkey) ?? sharedAgents.current.get(pubkey))?.name ??
            formatPublicKey(pubkey) ??
            pubkey,
          candidates,
        ),
        owned: false,
      })),
    ].sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        }) || a.pubkey.localeCompare(b.pubkey),
    );
  }, [ownedAgents, result.notes, profiles, resolveName]);
  const [author, setAuthor] = useState("");
  const [opened, setOpened] = useState<EventData[]>([]);
  const [selected, setSelected] = useState("");
  const split = usePanelSplit(session.scope, "notes", 448, 320);
  const origin = useRef<HTMLElement | null>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const preserveControlFocus = useCallback((node: HTMLButtonElement | null) => {
    if (!node) return;
    return () => {
      if (document.activeElement === node) refreshRef.current?.focus();
    };
  }, []);
  const folderGrid = useRef<HTMLElement>(null);
  const folderTitle = useRef<HTMLHeadingElement>(null);
  const [profile, setProfile] = useState("");
  useSyncExternalStore(
    panels?.subscribe ?? noSubscribe,
    panels?.snapshot ?? emptyPanels,
  );
  const profileAddress = profileTarget(profile, { agent: true });
  const profilePanel = profileAddress
    ? panels?.resolve(profileAddress)
    : undefined;
  const profileKey = `profile:${profile}`;
  const noteActive = opened.some((note) => noteKey(note) === selected)
    ? selected
    : noteKeyOrEmpty(opened[0]);
  const active =
    profilePanel && (selected === profileKey || !noteActive)
      ? profileKey
      : noteActive;

  useEffect(() => {
    const controller = new AbortController();
    setResult((old) => ({
      ...old,
      loading: true,
      sharedError: undefined,
    }));
    const options = { signal: controller.signal, fresh: request.version > 0 };
    const previous = request.more
      ? pages.current
      : { owned: emptyNotePage(), shared: emptyNotePage() };
    const owned = authors
      ? readNotePage(
          session,
          { kinds: [30023], authors: authors.split(":"), limit: NOTE_LIMIT },
          previous.owned,
          options,
        )
      : Promise.resolve({ ...emptyNotePage(), done: true });
    const shared = readNotePage(
      session,
      { kinds: [30023], limit: NOTE_LIMIT },
      previous.shared,
      options,
    ).then(async (page) => {
      controller.signal.throwIfAborted();
      const known = request.more
        ? new Map(sharedAgents.current)
        : new Map<string, Profile>();
      const previousIds = new Set(previous.shared.notes.map((note) => note.id));
      const newAuthors = [
        ...new Set(
          page.notes
            .filter((note) => !previousIds.has(note.id))
            .map((note) => note.pubkey),
        ),
      ];
      // Enrich only this page, and retain accepted classification across directory eviction.
      for (let offset = 0; offset < newAuthors.length; offset += NOTE_LIMIT) {
        const batch = newAuthors.slice(offset, offset + NOTE_LIMIT);
        await session.profiles.ensure(batch, "background");
        controller.signal.throwIfAborted();
        for (const pubkey of batch) {
          const profile = session.profiles.snapshot().get(pubkey);
          if (profile?.isAgent) known.set(pubkey, profile);
          else known.delete(pubkey);
        }
      }
      return { page, agents: known };
    });
    void Promise.allSettled([owned, shared]).then(
      ([ownResult, sharedResult]) => {
        if (controller.signal.aborted) return;
        if (ownResult.status === "fulfilled")
          pages.current.owned = ownResult.value;
        if (sharedResult.status === "fulfilled") {
          pages.current.shared = sharedResult.value.page;
          sharedAgents.current = sharedResult.value.agents;
        }
        const ownAuthors = authors ? authors.split(":") : [];
        const sharedNotes = pages.current.shared.notes.filter(
          (note) =>
            !ownAuthors.includes(note.pubkey) &&
            sharedAgents.current.has(note.pubkey),
        );
        const notes = noteHeads(
          [...pages.current.owned.notes, ...sharedNotes],
          [...ownAuthors, ...sharedNotes.map((note) => note.pubkey)],
        );
        setResult({
          notes,
          loading: false,
          partial: !pages.current.owned.done || !pages.current.shared.done,
          error:
            ownResult.status === "rejected"
              ? t("v1wf.notes.readFailed")
              : undefined,
          sharedError:
            sharedResult.status === "rejected"
              ? t("v1wf.notes.sharedFailed")
              : undefined,
        });
        setAuthor((current) =>
          notes.some((note) => note.pubkey === current) ? current : "",
        );
        setOpened((old) =>
          old.map(
            (note) =>
              notes.find((next) => noteKey(next) === noteKey(note)) ?? note,
          ),
        );
      },
    );
    return () => controller.abort();
  }, [session, authors, request]);

  const restored = useRef<string | undefined>(undefined);
  const [routeError, setRouteError] = useState("");
  const visit = (route: NotesRoute, replace = false) => {
    if (
      !navigation ||
      !navigator ||
      navigation.signal.aborted ||
      navigation.target.kind !== "page" ||
      navigation.target.pluginId !== "buzz.relay-notes" ||
      navigation.target.pageId !== "notes" ||
      navigator.snapshot().entry.id !== navigation.entryId
    )
      return;
    void navigator.open(notesTarget(navigation.target, route), {
      replace,
      focus: "preserve",
    });
  };
  useEffect(() => {
    if (
      !navigation ||
      navigation.signal.aborted ||
      restored.current === navigation.entryId ||
      result.loading ||
      result.error ||
      pending
    )
      return;
    const route =
      navigation.target.kind === "page"
        ? notesRoute(navigation.target.route?.params)
        : undefined;
    setRouteError("");
    if (
      route?.author &&
      !agents.some((agent) => agent.pubkey === route.author)
    ) {
      setRouteError(t("v1wf.notes.folderUnavailable"));
      return;
    }
    setAuthor(route?.author ?? "");
    if (route?.profile) {
      if (!agents.some((agent) => agent.pubkey === route.profile)) {
        setRouteError(t("v1wf.notes.profileUnavailable"));
        return;
      }
      setProfile(route.profile);
      setSelected(`profile:${route.profile}`);
    }
    if (route?.note === "") {
      setOpened([]);
      setSelected("");
    } else if (route?.note) {
      const note =
        result.notes.find((item) => noteKey(item) === route.note) ??
        opened.find((item) => noteKey(item) === route.note);
      if (note) {
        setOpened((old) =>
          old.some((item) => noteKey(item) === route.note)
            ? old
            : [...old, note],
        );
        setSelected(route.note);
      } else {
        setRouteError(t("v1wf.notes.noteMissing"));
        return;
      }
    }
    restored.current = navigation.entryId;
  }, [
    navigation,
    result.loading,
    result.error,
    result.notes,
    pending,
    agents,
    opened,
  ]);

  const openProfile = (pubkey: string) => {
    setProfile(pubkey);
    setSelected(`profile:${pubkey}`);
    visit({ author, profile: pubkey }, true);
  };
  const closeProfile = () => {
    setProfile("");
    setSelected(noteActive);
    visit({ author, note: noteActive }, true);
  };
  const openLink = (url: string) => {
    const target = scope && buzzLinkTarget(url, scope);
    if (!target || !navigator) return false;
    void navigator.open(target);
    return true;
  };
  const canProfile = (pubkey: string) =>
    !!panels?.resolve(profileTarget(pubkey, { agent: true }) ?? "");
  const refresh = () => {
    setRequest((old) => ({ version: old.version + 1, more: false }));
  };
  const close = (key: string) => {
    setOpened((old) => old.filter((note) => noteKey(note) !== key));
    const next =
      active === key
        ? opened.find((note) => noteKey(note) !== key)
        : opened.find((note) => noteKey(note) === active);
    visit(
      active === profileKey && profilePanel
        ? { author, profile }
        : { author, note: noteKeyOrEmpty(next) },
      true,
    );
    if (opened.length === 1 && !profilePanel)
      requestAnimationFrame(() => {
        (origin.current?.isConnected
          ? origin.current
          : refreshRef.current
        )?.focus();
      });
  };
  const name = (note: EventData) =>
    agents.find((agent) => agent.pubkey === note.pubkey)?.name ?? note.pubkey;
  const visible = result.notes.filter((note) => note.pubkey === author);
  const ownedNotes = result.notes.filter((note) =>
    ownedAgents.some((agent) => agent.pubkey === note.pubkey),
  );
  const folders = agents.flatMap((agent) => {
    const notes = result.notes.filter((note) => note.pubkey === agent.pubkey);
    return notes.length
      ? [{ ...agent, count: notes.length, latest: notes[0]?.created_at ?? 0 }]
      : [];
  });
  const folder = folders.find((agent) => agent.pubkey === author);
  const openFolder = (pubkey: string) => {
    visit({
      author: pubkey,
      ...(active === profileKey && profilePanel
        ? { profile }
        : active
          ? { note: active }
          : {}),
    });
    setAuthor(pubkey);
    requestAnimationFrame(() => {
      if (pubkey) folderTitle.current?.focus();
      else
        folderGrid.current
          ?.querySelector<HTMLElement>(`[data-agent="${author}"]`)
          ?.focus();
    });
  };
  const renderNoteGrid = (notes: readonly EventData[]) => (
    <div className={styles.notes}>
      {notes.map((note) => (
        <article key={noteKey(note)} className={styles.noteItem}>
          <SurfaceButton
            className={styles.noteCard}
            aria-label={`Open ${noteTitle(note)} by ${name(note)}`}
            aria-current={active === noteKey(note) ? "true" : undefined}
            aria-pressed={opened.some(
              (item) => noteKey(item) === noteKey(note),
            )}
            onClick={(event) => {
              origin.current = event.currentTarget;
              if (opened.some((item) => noteKey(item) === noteKey(note))) {
                close(noteKey(note));
              } else {
                setOpened((old) => [...old, note]);
                setSelected(noteKey(note));
                visit({ author, note: noteKey(note) }, true);
              }
            }}
          >
            <span className={styles.noteHeading}>
              <span
                className={`${styles.noteTitle} text-label`}
                title={noteTitle(note)}
              >
                {noteTitle(note)}
              </span>
              <span className="text-caption text-secondary">
                <NoteIdentifier note={note} separator={false} />
              </span>
            </span>
            <span className={`${styles.summary} text-body-sm text-subtle`}>
              {noteTag(note, "summary") ||
                note.content.slice(0, 600).replace(/[#*_`]/g, "")}
            </span>
          </SurfaceButton>
          <span className={`${styles.byline} text-caption text-secondary`}>
            <NoteAuthor
              name={name(note)}
              picture={avatarMedia(
                agents.find((agent) => agent.pubkey === note.pubkey)?.picture,
                session.media,
              )}
              open={
                canProfile(note.pubkey)
                  ? () => openProfile(note.pubkey)
                  : undefined
              }
            />{" "}
            · <NoteTime note={note} />
          </span>
        </article>
      ))}
    </div>
  );
  const readerOpen = !!opened.length || !!profilePanel;
  return (
    <div
      className={styles.split}
      ref={split.ref}
      data-side={readerOpen ? "" : undefined}
    >
      <div className={styles.main}>
        <NotesPanel
          refresh={refresh}
          refreshRef={refreshRef}
          loading={result.loading}
        >
          {author && (
            <div className={styles.folderHeader}>
              <IconButton
                hint="familiar"
                variant="ghost"
                aria-label={t("v1wf.notes.back")}
                title={t("v1wf.notes.back")}
                icon={<ArrowLeftIcon size="1rem" aria-hidden="true" />}
                onClick={() => openFolder("")}
              />
              <h2 className="text-heading" ref={folderTitle} tabIndex={-1}>
                {folder?.name}
              </h2>
            </div>
          )}
          {routeError && <p role="alert">{routeError}</p>}
          {pending && <p role="status">{t("v1wf.notes.loadingAgents")}</p>}
          {!pending && !complete && !inventoryError && (
            <div role="status">
              <p>{t("v1wf.notes.someAgentsFailed")}</p>
              <Button onClick={refreshAgents}>
                {t("v1wf.notes.retryAgents")}
              </Button>
            </div>
          )}
          {inventoryError && (
            <div role="alert">
              <p>{inventoryError}</p>
              <Button onClick={refreshAgents}>
                {t("v1wf.notes.retryAgents")}
              </Button>
            </div>
          )}
          {result.sharedError && (
            <p role="status" className="text-body-sm text-secondary">
              {result.sharedError}
            </p>
          )}
          {result.error && (
            <div role="alert">
              <p>{result.error}</p>
              <Button
                ref={preserveControlFocus}
                loading={result.loading}
                onClick={() =>
                  setRequest((old) => ({ ...old, version: old.version + 1 }))
                }
              >
                {t("v1wf.notes.retryNotes")}
              </Button>
            </div>
          )}
          {!pending &&
            complete &&
            !inventoryError &&
            !result.loading &&
            !result.error &&
            !(author ? visible.length : folders.length) && (
              <EmptyState
                icon={<NoteIcon size="1.5rem" />}
                title={t("v1wf.notes.none")}
                description={
                  author
                    ? t("v1wf.notes.emptyFolder")
                    : t("v1wf.notes.emptyAll")
                }
              />
            )}
          {!author ? (
            <section
              className={styles.folderGroups}
              aria-label={t("v1wf.notes.folders")}
              ref={folderGrid}
            >
              {[
                { owned: true, label: t("v1wf.notes.yourAgents") },
                { owned: false, label: t("v1wf.notes.otherAgents") },
              ].map((group) => {
                const items = folders.filter(
                  (agent) => agent.owned === group.owned,
                );
                // Folders start in alphabetical order; retain that order for ties.
                if (!group.owned) items.sort((a, b) => b.latest - a.latest);
                return items.length ? (
                  <Fragment key={group.label}>
                    <section aria-label={group.label}>
                      <h2 className="text-label">{group.label}</h2>
                      <div className={styles.folders}>
                        {items.map((agent) => (
                          <SurfaceButton
                            key={agent.pubkey}
                            className={styles.folderCard}
                            aria-label={t("v1wf.notes.openFolder", {
                              name: agent.name,
                            })}
                            data-agent={agent.pubkey}
                            onClick={() => openFolder(agent.pubkey)}
                          >
                            <span className={styles.folderAvatar}>
                              <Avatar
                                src={avatarMedia(agent.picture, session.media)}
                                alt=""
                                fallback={agent.name}
                                size="fill"
                                shape="squircle"
                              />
                            </span>
                            <span className={`${styles.folderName} text-label`}>
                              {agent.name}
                            </span>
                            <span className="text-caption text-subtle">
                              {t(
                                agent.count === 1
                                  ? "v1wf.notes.count.one"
                                  : "v1wf.notes.count.other",
                                { count: agent.count },
                              )}
                            </span>
                          </SurfaceButton>
                        ))}
                      </div>
                    </section>
                    {group.owned && renderNoteGrid(ownedNotes)}
                  </Fragment>
                ) : null;
              })}
            </section>
          ) : (
            renderNoteGrid(visible)
          )}
          {result.partial && (
            <div>
              <Button
                size="sm"
                ref={preserveControlFocus}
                loading={result.loading}
                onClick={() =>
                  setRequest((old) => ({
                    version: old.version + 1,
                    more: true,
                  }))
                }
              >
                {t("v1wf.notes.loadOlder")}
              </Button>
            </div>
          )}
        </NotesPanel>
      </div>
      {readerOpen && (
        <aside className={styles.side} aria-label={t("v1wf.notes.reader")}>
          {split.handle}
          <Panel aria-label={t("v1wf.notes.details")}>
            <PanelWorkspace
              label={t("v1wf.notes.open")}
              value={active}
              select={(key) => {
                setSelected(key);
                visit(
                  key === profileKey
                    ? { author, profile }
                    : { author, note: key },
                  true,
                );
              }}
              items={[
                ...opened.map((note) => ({
                  id: noteKey(note),
                  label: noteTitle(note),
                  icon: (
                    <Avatar
                      src={avatarMedia(
                        agents.find((agent) => agent.pubkey === note.pubkey)
                          ?.picture,
                        session.media,
                      )}
                      alt=""
                      fallback={name(note)}
                      size="fill"
                      shape="squircle"
                    />
                  ),
                  close: () => close(noteKey(note)),
                  content: (
                    <NoteBody
                      note={note}
                      session={session}
                      openLink={openLink}
                      codeBlocks={codeBlocks}
                      openProfile={
                        canProfile(note.pubkey)
                          ? () => openProfile(note.pubkey)
                          : undefined
                      }
                      author={name(note)}
                      picture={avatarMedia(
                        agents.find((agent) => agent.pubkey === note.pubkey)
                          ?.picture,
                        session.media,
                      )}
                    />
                  ),
                })),
                ...(profilePanel && profileAddress
                  ? [
                      {
                        id: profileKey,
                        label: t("v1wf.notes.agentProfile", {
                          name:
                            agents.find((agent) => agent.pubkey === profile)
                              ?.name ?? t("v1wf.notes.agent"),
                        }),
                        close: closeProfile,
                        content: (
                          <profilePanel.component
                            target={profileAddress}
                            close={closeProfile}
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Panel>
        </aside>
      )}
    </div>
  );
}

const noteKeyOrEmpty = (note: EventData | undefined) =>
  note ? noteKey(note) : "";

function NoteIdentifier({
  note,
  separator = true,
}: {
  note: EventData;
  separator?: boolean;
}) {
  const identifier = noteTag(note, "d");
  return identifier ? (
    <>
      {separator && " · "}
      <code
        className={`${styles.identifier} text-mono font-mono`}
        title={`Saved as ${identifier}`}
      >
        {identifier}
      </code>
    </>
  ) : null;
}

function NoteTime({ note }: { note: EventData }) {
  const date = new Date(note.created_at * 1000);
  const days = Math.floor((Date.now() / 1000 - note.created_at) / 86400);
  // The shared recency ladder switches to calendar dates after a week; notes
  // keep older timestamps relative too, with the exact date in the title.
  const label =
    days >= 7
      ? new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(
          -days,
          "day",
        )
      : relativeTimestamp(note.created_at);
  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "long",
      })}
    >
      {label}
    </time>
  );
}

export function NoteBody({
  note,
  session,
  openLink,
  codeBlocks,
  author,
  picture,
  openProfile,
}: {
  openProfile?: (() => void) | undefined;
  note: EventData;
  session: RelaySession;
  openLink(url: string): boolean;
  codeBlocks?: ContributionReader<CodeBlockRenderer> | undefined;
  author: string;
  picture?: string | undefined;
}) {
  const plain = !guardDocument(note.content, DOCUMENT_PROFILE, {
    chars: MAX_MARKDOWN_LENGTH,
    cells: DOCUMENT_RENDER_CELLS,
  });
  return (
    <article className={styles.document}>
      <h2 className="text-heading">{noteTitle(note)}</h2>
      <p className={`${styles.byline} text-caption text-secondary`}>
        <NoteAuthor name={author} picture={picture} open={openProfile} /> ·
        Updated <NoteTime note={note} />
        <NoteIdentifier note={note} />
      </p>
      {plain ? (
        <MarkdownSource content={note.content} className={styles.markdown} />
      ) : (
        <MarkdownDocument
          content={note.content}
          profile={DOCUMENT_PROFILE}
          components={sharedComponents}
          capabilities={{ openLink, session, codeBlocks, copy: true }}
          scale="document"
          className={styles.markdown}
        />
      )}
    </article>
  );
}

function NoteAuthor({
  name,
  picture,
  open,
}: {
  name: string;
  picture?: string | undefined;
  open?: (() => void) | undefined;
}) {
  const identity = (
    <>
      <Avatar
        src={picture}
        alt=""
        fallback={name}
        size="compact"
        shape="squircle"
      />
      <span>{name}</span>
    </>
  );
  return open ? (
    <Button
      variant="plain"
      size="inline"
      aria-label={t("v1wf.notes.viewProfile", { name })}
      onClick={open}
    >
      {identity}
    </Button>
  ) : (
    <span className={styles.byline}>{identity}</span>
  );
}
