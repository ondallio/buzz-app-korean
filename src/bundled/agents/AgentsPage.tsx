import { t, useLanguage } from "../../shared/i18n";
import { rich } from "../../shared/i18n/rich";
import { formattingLocale } from "../../shared/i18n/language";
import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { visibleTeams } from "../../features/agents/visible-teams";
import { profileKey } from "../../features/profiles/target";
import type { JsonValue } from "../../features/navigation/targets";
import {
  historyActive,
  historyRoute,
  historyTarget,
  teamRoute,
} from "./routes";
import {
  historyPresentation,
  type HistoryPresentation,
} from "../../features/agents/history-presentation";
import { ConfigHistoryRow } from "../../features/agents/AgentConfigHistoryRow";
import { usePanelSplit } from "../../features/panels/usePanelSplit";
import { AgentDetails, useSyncLine } from "./AgentDetails";
import { communityDestination } from "../../features/communities/destination";
import { communityIcon } from "../../features/communities/community-icon";
import { communityName } from "../../features/communities/names";
import type {
  CommunityReader,
  Membership,
} from "../../features/communities/service";
import { PanelWorkspace } from "../../features/panels/PanelWorkspace";
import { AgentMessageButton } from "./AgentMessageButton";
import { ProviderDialog } from "./ProviderDialog";
// Agents, teams, and marketplace, with creation and import from their menus.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import styles from "./AgentsPage.module.css";
import cardStyles from "./AgentCard.module.css";
import {
  AgentBrowse,
  SharedAgentPanel,
  type SharedAgentSelection,
  SharedImportDialog,
} from "./AgentBrowse";
import { AgentShareDialog } from "./AgentShareDialog";
import type { SharedAgent } from "../../features/agents/shared-agents";
import { AgentCard, AgentPortrait, TeamCard } from "./AgentCard";
import { AgentInventoryDrag, DraggableAgentRow } from "./AgentInventoryDrag";
import { useAgentOrder } from "./agent-order";
import { AgentCreateDialog, TypeIcon } from "./AgentCreateDialog";
import { NewAgentTile } from "./NewAgentTile";
import type { ChannelChoice } from "../../features/agents/attention";
import {
  AgentDelete,
  AgentRemoveHere,
  inSeveral,
  sharedAgentSettings,
} from "../../features/agents/AgentManage";
import { AttentionSummary } from "../../features/agents/AttentionPanel";
import {
  AgentSaveState,
  DiscardChanges,
  useAgentSaveReports,
} from "../../features/agents/AgentSaveButton";
import { useAgents, useChannelChoices } from "../../features/agents/react";
import type { OldTeam, PortableAgent } from "../../features/agents/native";
import type {
  Agent,
  Agents,
  FoundAgents,
  RegisteredAgentType,
  Team,
  TeamPort,
} from "../../features/agents/service";
import { useRelayConnection } from "../../features/relay/react";
import type { RelaySession } from "../../features/relay/session";
import {
  readSnapshot,
  type SharedDefinition,
} from "../../features/agents/agent-share";
import { useDefaultAgent } from "../../features/solo/default-agent";
import { useBestieChoice } from "./BestieChoice";
import type { RelayData } from "../../features/relay/service";
import type { Navigation } from "../../features/navigation/controller";
import { targetKey } from "../../features/navigation/targets";
import type { PageNavigation } from "../../features/navigation/service";
import { SettingsSectionLink } from "../../features/navigation/SettingsSectionLink";
import {
  BrainIcon,
  CheckIcon,
  DotsThreeIcon,
  DownloadIcon,
  GearIcon,
  PlusIcon,
  RobotIcon,
  WarningCircleIcon,
  XIcon,
} from "../../shared/design-system/icons";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { Checkbox } from "../../shared/design-system/ui/Checkbox";
import { ChoiceRow } from "../../shared/design-system/ui/ChoiceRow";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import { Field } from "../../shared/design-system/ui/Field";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { Panel } from "../../shared/design-system/ui/Panel";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Input } from "../../shared/design-system/ui/Input";
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  MenuSeparator,
  MenuPopup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import { PanelHeader } from "../../shared/design-system/ui/PanelHeader";
import { SplitButton } from "../../shared/design-system/ui/SplitButton";
import { Tabs } from "../../shared/design-system/ui/Tabs";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { Tooltip } from "../../shared/design-system/ui/Tooltip";
import { publicKeyLabels } from "../../shared/identity/public-key";
import { readView, writeView } from "../../shared/view-state";
import {
  agentCardRoute,
  agentProviderRoute,
  agentProviderTarget,
  agentRoute,
  conversationOpener,
} from "./routes";
import { AgentCardCreate } from "./AgentCardCreate";
import { writeClipboardText } from "../../shared/clipboard";
import { buzzLinkTarget } from "../../features/navigation/buzz-links";
import type { ConversationExtensions } from "../../features/conversation/contracts";

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const noSubscribe = () => () => {};
const names = (agents: readonly Agent[]) =>
  new Intl.ListFormat(formattingLocale(), { type: "conjunction" }).format(
    agents.map((agent) => agent.name),
  );
const importReminderKey = "agent-community-import:dismissed";

type AgentFeedback = DisplayMessage | readonly DisplayMessage[];
/** Resolve only this surface's explicitly owned messages; external text stays literal. */
function feedbackText(value: AgentFeedback): string {
  if (typeof value === "string" || "kind" in value)
    return resolveMessage(value);
  return value.map(resolveMessage).join(" ");
}

/** The type's one-line summary of an agent; its title when it has none. */
function summaryOf(agent: Agent, type: RegisteredAgentType | undefined) {
  if (agent.place === "elsewhere")
    return type && !type.remote
      ? t("agentsBrowse.onAnotherDevice")
      : t("agentsBrowse.harnessUnavailable");
  if (agent.unfinished) return t("agentsBrowse.setupUnfinished");
  if (!type) return t("agentsBrowse.typeUnavailable");
  try {
    return type.summary?.(agent).trim() || type.title;
  } catch {
    return type.title;
  }
}

/** Pack avatars for the marketplace tile, apart from New agent's. */
const MARKETPLACE_ART = [
  "gloopies-7",
  "fuzzies-10",
  "pollies-9",
  "gloopies-14",
  "fuzzies-6",
  "pollies-21",
  "gloopies-11",
  "fuzzies-15",
];

type Tab = "yours" | "teams" | "marketplace";
const TABS = [
  { value: "yours", label: "Your agents", panelId: "agents-yours" },
  { value: "teams", label: "Your teams", panelId: "agents-teams" },
  { value: "marketplace", label: "Marketplace", panelId: "agents-marketplace" },
] as const;

export function AgentsPage({
  agents,
  relay,
  communities,
  navigation,
  navigator,
  linkRenderers,
}: {
  agents: Agents;
  relay: RelayData;
  communities?: CommunityReader | undefined;
  navigation?: PageNavigation;
  navigator?: Navigation;
  linkRenderers?: ConversationExtensions["links"] | undefined;
}) {
  useLanguage();
  const { snapshot, types } = useAgents(agents);
  const connection = useRelayConnection(relay);
  const split = usePanelSplit(connection.scope, "agents", 448, 320);
  const channels = useChannelChoices(
    connection.status === "ready" ? connection.session.channels : undefined,
  );
  const [tab, setTab] = useState<Tab>("yours");
  const [sharedSelection, setSharedSelection] =
    useState<SharedAgentSelection>();
  const sharedTrigger = useRef<HTMLButtonElement | null>(null);
  const shared =
    connection.status === "ready" &&
    sharedSelection?.session === connection.session
      ? sharedSelection
      : undefined;
  // Commit first: a narrow layout hides the list, and its tile, while open.
  const closeShared = () => {
    flushSync(() => setSharedSelection(undefined));
    sharedTrigger.current?.focus();
  };
  const [selectedKey, setSelectedKey] = useState<string>();
  const [creating, setCreating] = useState(false);
  // Which import the dialog shows follows the menu it was opened from.
  const [flow, setFlow] = useState<"import" | "import-team">();
  // A team being edited by its id, or "new" for one being made.
  const [editingTeam, setEditingTeam] = useState<string>();
  // A local team leaves the list as its delete starts, so its editor keeps it
  // until the delete ends, to show a failure there.
  const [removing, setRemoving] = useState<Team>();
  const removeTeam = async (team: Team) => {
    setRemoving(team);
    try {
      await agents.removeTeam(team.id);
    } finally {
      setRemoving(undefined);
    }
  };
  const newAgentButton = useRef<HTMLButtonElement>(null);
  const newAgentLabel = useRef<HTMLSpanElement>(null);
  const [importing, setImporting] = useState(false);
  // What old Buzz has to import, read again as the community's agents and
  // teams change and as a menu opens. Import's entry points hide only once it
  // is known there is nothing, and an owner with no agents yet is offered it
  // first.
  // Undefined before the first result; null when discovery failed.
  const [legacy, setLegacy] = useState<FoundAgents | null>();
  const legacyRead = useRef(0);
  const readLegacy = useCallback(() => {
    const read = ++legacyRead.current;
    agents.portable().then(
      (found) => read === legacyRead.current && setLegacy(found),
      () => read === legacyRead.current && setLegacy(null),
    );
  }, [agents]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: What old Buzz has to import changes with the community's agents and teams.
  useEffect(() => {
    readLegacy();
    return () => {
      legacyRead.current++;
    };
  }, [readLegacy, snapshot.status, snapshot.agents, snapshot.teams]);
  const refreshOnOpen = (open: boolean) => {
    if (open) readLegacy();
  };
  const joinable = agents.joinable();
  const agentImports = [...joinable, ...(legacy?.agents ?? [])];
  const discoveryIncomplete = !legacy || legacy.warnings.length > 0;
  const canImportTeam =
    discoveryIncomplete ||
    legacy.teams.length + teamsToJoin(snapshot.teams, joinable).length > 0;
  const firstAgent = snapshot.status === "ready" && !snapshot.agents.length;
  const [localProviderKey, setLocalProviderKey] = useState<string>();
  const routed = !!navigation && !!navigator;
  const providerKey = routed
    ? agentProviderRoute(
        navigation.target.kind === "page"
          ? navigation.target.route?.params
          : undefined,
      )
    : localProviderKey;
  const setProviderKey = (provider?: string) => {
    if (!navigation || !navigator) {
      setLocalProviderKey(provider);
      return;
    }
    if (
      navigation.signal.aborted ||
      navigation.target.kind !== "page" ||
      navigation.target.pluginId !== "buzz.agents" ||
      navigation.target.pageId !== "agents" ||
      navigator.snapshot().entry.id !== navigation.entryId
    )
      return;
    const target = agentProviderTarget(navigation.target, provider);
    if (provider) void navigator.open(target);
    else {
      const closing = providerKey;
      const pageKey = targetKey(target);
      navigator.dismiss(
        (visit) =>
          visit.kind === "page" &&
          agentProviderRoute(visit.route?.params) === closing &&
          targetKey(agentProviderTarget(visit)) === pageKey,
        target,
      );
    }
  };
  // Opened from an agent card's link: Create agent, filled in from the card.
  const card =
    routed && navigation.target.kind === "page"
      ? agentCardRoute(navigation.target.route?.params)
      : undefined;
  const closeCard = () => {
    if (
      !navigation ||
      !navigator ||
      navigation.signal.aborted ||
      navigation.target.kind !== "page" ||
      navigator.snapshot().entry.id !== navigation.entryId
    )
      return;
    const target = agentProviderTarget(navigation.target);
    const pageKey = targetKey(target);
    navigator.dismiss(
      (visit) =>
        visit.kind === "page" &&
        agentCardRoute(visit.route?.params) === card &&
        targetKey(agentProviderTarget(visit)) === pageKey,
      target,
    );
  };
  const typeOf = (agent: Agent) =>
    types.find((type) => type.key === agent.type);
  const find = (pubkey: string | undefined) =>
    snapshot.agents.find((agent) => agent.pubkey === pubkey);
  const selected = find(selectedKey);
  // The open panel's unsaved edits, asked about before it is replaced or closed.
  const [unsaved, reportUnsaved] = useAgentSaveReports();
  const [leaving, setLeaving] = useState<{
    pubkey: string | undefined;
    then: (() => void) | undefined;
  }>();
  // The prompt is stale once nothing is left to discard behind it.
  if (leaving && !unsaved.dirty) setLeaving(undefined);
  // Choosing another agent or none asks first, as switching sections does,
  // and returns false while the current one stays.
  const browse = (pubkey?: string, then?: () => void) => {
    const leaves = pubkey !== selectedKey;
    if (leaves && (unsaved.saving || unsaved.dirty)) {
      if (!unsaved.saving) setLeaving({ pubkey, then });
      return false;
    }
    setSelectedKey(pubkey);
    then?.();
    return true;
  };
  const build = (pubkey: string) => browse(pubkey);
  // Removing an agent closes only its own panel, without asking.
  const removed = (pubkey: string) =>
    setSelectedKey((key) => (key === pubkey ? undefined : key));
  // Focus inside the panel goes with it, so the closed agent's card takes it
  // once the close goes ahead. Focus elsewhere stays.
  const profileSide = useRef<HTMLElement>(null);
  const closePanel = () => {
    const pubkey = selectedKey;
    const focus = document.activeElement;
    const inside =
      focus === document.body || profileSide.current?.contains(focus);
    return browse(
      undefined,
      inside
        ? () => focusCard(document.getElementById("agents-yours"), pubkey)
        : undefined,
    );
  };
  // Importing gives an agent a key here, so a hosted type cannot take one.
  const runnable = types.filter((type) => !type.remote);
  // Teams are shared by every community; this one shows each with a member
  // here, or with none in any community. A synced team always shows in its
  // home, and elsewhere only with a member there or while it has none.
  const teams = visibleTeams(agents);
  // Only a team still saved or being deleted, or one being made, keeps its
  // editor open.
  const editing =
    editingTeam === "new" ||
    editingTeam === removing?.id ||
    teams.some((team) => team.id === editingTeam)
      ? editingTeam
      : undefined;
  // Leaving Teams drops the editor, whose unsaved draft goes with it.
  const changeTab = (next: Tab) => {
    if (next !== "teams") setEditingTeam(undefined);
    if (next !== "marketplace") setSharedSelection(undefined);
    setTab(next);
  };
  // Opened for one of your agents, such as from a card sent in chat.
  const routedAgent =
    routed && navigation.target.kind === "page"
      ? agentRoute(navigation.target.route?.params)
      : undefined;
  const routedEntry = navigation?.entryId;
  // Opened for one of your teams, such as from a version link.
  const routedTeam =
    routed && navigation.target.kind === "page"
      ? teamRoute(navigation.target.route?.params)
      : undefined;
  // An editor with unsaved edits or a Save running, which Back leaves open
  // as it leaves an agent's panel.
  const teamBusy = useRef(false);
  const onTeamBusy = useCallback((busy: boolean) => {
    teamBusy.current = busy;
  }, []);
  // Read as a team's visit arrives, not a reason to apply it again.
  const leave = useRef({ browse, editingTeam });
  leave.current = { browse, editingTeam };
  useEffect(() => {
    if (!routedEntry) return;
    const { browse, editingTeam } = leave.current;
    if (!routedTeam) {
      // Back past a team's visit closes its editor; a new team has none.
      if (!teamBusy.current)
        setEditingTeam((open) => (open === "new" ? open : undefined));
      return;
    }
    // Another team's visit leaves a busy editor open too; its own versions
    // still open in it.
    if (teamBusy.current && editingTeam !== routedTeam) return;
    // An agent's unsaved edits are asked about first, as choosing another is.
    browse(undefined, () => {
      setSharedSelection(undefined);
      setTab("teams");
      setEditingTeam(routedTeam);
    });
  }, [routedTeam, routedEntry]);
  // Opening a team is a visit Back and Forward move between, and closing its
  // editor ends the visit.
  const editTeam = (id: string | undefined) => {
    if (
      !navigation ||
      !navigator ||
      navigation.signal.aborted ||
      navigation.target.kind !== "page" ||
      navigator.snapshot().entry.id !== navigation.entryId ||
      id === "new"
    ) {
      setEditingTeam(id);
      return;
    }
    // The team already routed here, as after Keep editing, has no new visit
    // to open, so it opens as Back would have opened it.
    if (id && id === routedTeam) {
      browse(undefined, () => {
        setSharedSelection(undefined);
        setTab("teams");
        setEditingTeam(id);
      });
      return;
    }
    const page = agentProviderTarget(navigation.target);
    if (id) {
      void navigator.open({
        ...page,
        route: { version: 1, params: { team: id } },
      });
      return;
    }
    // The editor closes here, as the route won't close a busy one, and its
    // visits end too; the team Back reached, if another, opens in its place.
    const closing = editingTeam ?? routedTeam;
    setEditingTeam(routedTeam === closing ? undefined : routedTeam);
    if (closing) endTeamVisits(closing);
  };
  // Ends a team's visits in this page's account and community, and nothing
  // else: a Save that finishes after its editor went away still ends them.
  const endTeamVisits = (id: string) => {
    if (!navigator || navigation?.target.kind !== "page" || id === "new")
      return;
    const page = agentProviderTarget(navigation.target);
    const pageKey = targetKey(page);
    navigator.dismiss(
      (visit) =>
        visit.kind === "page" &&
        teamRoute(visit.route?.params) === id &&
        targetKey(agentProviderTarget(visit)) === pageKey,
      page,
    );
  };
  useEffect(() => {
    // Back to an agent's visit leaves a busy team editor open too.
    if (!routedAgent || !routedEntry || teamBusy.current) return;
    setEditingTeam(undefined);
    setSharedSelection(undefined);
    setTab("yours");
    setSelectedKey(routedAgent);
  }, [routedAgent, routedEntry]);
  const returnTo = (next: Tab) => () => {
    setFlow(undefined);
    changeTab(next);
  };
  const returnToAgents = returnTo("yours");
  // The listing and its trigger go with it, so focus follows to the tab now
  // shown.
  const leaveListing = () => {
    flushSync(() => {
      setSharedSelection(undefined);
      returnToAgents();
    });
    document.getElementById("agents-yours-tab")?.focus();
  };

  const toolbarAction =
    (tab === "teams" ? teams.length > 0 : snapshot.agents.length > 0) ||
    snapshot.status === "error" ||
    snapshot.status === "unavailable";
  // Import is a dialog over the page, so an open agent and its draft stay.
  const openImport = () => setFlow("import");
  const openMarketplace = () =>
    browse(undefined, () => changeTab("marketplace"));
  // Shown only beside the tabs; with no agents yet, the tiles stand in for it.
  const newAgentMenu = (
    <MenuRoot onOpenChange={refreshOnOpen}>
      <MenuTrigger
        render={<NewAgentTile ref={newAgentButton} variant="button" />}
      />
      <MenuPopup anchor={newAgentButton} align="end">
        <MenuItem
          disabled={snapshot.status !== "ready" || !types.length}
          onClick={() => setCreating(true)}
        >
          <PlusIcon size={16} aria-hidden="true" />{" "}
          {t("agentsBrowse.createAgent")}{" "}
        </MenuItem>
        {/* Even when discovery finds nothing, a file can be imported. */}
        <MenuItem onClick={openImport}>
          <DownloadIcon size={16} aria-hidden="true" />{" "}
          {t("agentsBrowse.importAgent")}{" "}
        </MenuItem>
      </MenuPopup>
    </MenuRoot>
  );
  // With no agents yet, each way to get one is its own tile; bringing the
  // owner's own agents leads when there are any.
  const canImport =
    firstAgent &&
    (agentImports.length > 0 || legacy === null || !!legacy?.warnings.length);
  const starts = (
    <div className={cardStyles.starts}>
      {canImport && (
        <NewAgentTile
          fullWidth
          crew={agentImports}
          description={
            joinable.length
              ? t("agentsBrowse.elsewhereAgents")
              : agentImports.length
                ? t("agentsBrowse.legacyAgents")
                : t("agentsBrowse.checkSources")
          }
          label={
            agentImports.length
              ? t("agentsBrowse.importNow")
              : t("agentsBrowse.checkImport")
          }
          onClick={openImport}
        />
      )}
      <NewAgentTile
        label={t("agentsBrowse.firstAgent")}
        secondary={canImport}
        disabled={snapshot.status !== "ready" || !types.length}
        onClick={() => setCreating(true)}
      />
      <NewAgentTile
        label={t("agentsBrowse.explore")}
        art={MARKETPLACE_ART}
        secondary={canImport}
        onClick={openMarketplace}
      />
      {firstAgent && !canImport && (
        <NewAgentTile
          label={t("agentsBrowse.importFile")}
          secondary
          onClick={openImport}
        />
      )}
    </div>
  );
  // Teams have no marketplace, so New team offers only making and importing.
  const newTeamMenu = (
    <MenuRoot onOpenChange={refreshOnOpen}>
      <MenuTrigger
        render={
          toolbarAction ? (
            <NewAgentTile
              ref={newAgentButton}
              variant="button"
              label={t("agentsBrowse.newTeam")}
            />
          ) : (
            <NewAgentTile
              ref={newAgentButton}
              labelRef={newAgentLabel}
              label={t("agentsBrowse.newTeam")}
              fullWidth
            />
          )
        }
      />
      <MenuPopup
        anchor={toolbarAction ? newAgentButton : newAgentLabel}
        align={toolbarAction ? "end" : "center"}
      >
        <MenuItem
          disabled={snapshot.status !== "ready"}
          onClick={() => setEditingTeam("new")}
        >
          <PlusIcon size={16} aria-hidden="true" />{" "}
          {t("agentsBrowse.createNewTeam")}{" "}
        </MenuItem>
        {canImportTeam && (
          <MenuItem onClick={() => setFlow("import-team")}>
            <DownloadIcon size={16} aria-hidden="true" />{" "}
            {t("agentsBrowse.importTeam")}{" "}
          </MenuItem>
        )}
      </MenuPopup>
    </MenuRoot>
  );

  const yours = (() => {
    if (snapshot.status === "unavailable")
      return (
        <EmptyState
          icon="✦"
          title={t("agentsBrowse.desktopOnly")}
          description={t("agentsBrowse.nativeCustody")}
        />
      );
    if (snapshot.status === "error")
      return (
        <EmptyState
          icon="!"
          title={t("agentsBrowse.couldNotLoad")}
          description={snapshot.error ?? t("agentsBrowse.retryFallback")}
        />
      );
    const inventory = {
      service: agents,
      agents: snapshot.agents,
      selected: selected?.pubkey,
      typeOf,
      onSelect: browse,
      onBuild: build,
      onRemoved: removed,
      busy: unsaved.saving,
      newAgent: !toolbarAction && starts,
      // A published agent's toast opens it where everyone else finds it.
      onViewListing: (agent: SharedAgent) => {
        if (connection.status !== "ready") return;
        sharedTrigger.current = null;
        changeTab("marketplace");
        setSharedSelection({
          agent,
          session: connection.session,
          community: connection.origin,
        });
      },
    };
    return connection.status === "ready" ? (
      <DefaultAgentInventory
        session={connection.session}
        scope={connection.scope ?? ""}
        {...inventory}
      />
    ) : (
      <Inventory
        key={connection.scope}
        {...inventory}
        scope={connection.scope}
      />
    );
  })();

  const openSettings =
    navigator &&
    ((section: string) =>
      void navigator.open({ version: 1, kind: "settings", section }));
  // The version history of the agent or team shown, read from this visit's
  // route only when it is that subject's.
  const presentationFor = (
    subject: Readonly<{ agent: string } | { team: string }>,
    route: (value: JsonValue | undefined) => string | undefined,
  ) => {
    if (
      !navigation ||
      !navigator ||
      navigation.signal.aborted ||
      navigator.snapshot().entry.id !== navigation.entryId
    )
      return;
    const page = navigation.target;
    if (page.kind !== "page") return;
    const id = "agent" in subject ? subject.agent : subject.team;
    const params =
      route(page.route?.params) === id ? page.route?.params : undefined;
    return historyPresentation(
      navigator,
      historyRoute(params, route),
      (selection) => historyTarget(page, subject, selection),
      historyActive(params, route),
    );
  };
  const panel = selected ? (
    selected.unfinished || selected.place === "elsewhere" ? (
      <AgentPeek
        key={selected.pubkey}
        agents={agents}
        agent={selected}
        type={typeOf(selected)}
        channels={channels}
        onClose={closePanel}
        onRemoved={() => removed(selected.pubkey)}
        openSettings={openSettings}
      />
    ) : (
      <AgentDetails
        historyPresentation={presentationFor(
          { agent: selected.pubkey },
          agentRoute,
        )}
        communities={communities}
        messageAction={(variant) => (
          <AgentMessageButton
            variant={variant}
            pubkey={selected.pubkey}
            relay={relay}
            navigator={navigator}
            navigation={navigation}
          />
        )}
        key={selected.pubkey}
        agents={agents}
        agent={selected}
        type={typeOf(selected)}
        types={types}
        channels={channels}
        memories={
          connection.status === "ready"
            ? connection.session.agentMemories
            : undefined
        }
        memoryLinks={
          connection.status === "ready"
            ? {
                session: connection.session,
                registry: linkRenderers,
                open(url) {
                  if (
                    !navigator ||
                    !navigation ||
                    navigation.signal.aborted ||
                    navigator.snapshot().entry.id !== navigation.entryId ||
                    !connection.viewer ||
                    !connection.origin
                  )
                    return false;
                  const target = buzzLinkTarget(url, {
                    viewer: connection.viewer,
                    communityOrigin: connection.origin,
                  });
                  if (!target) return false;
                  void navigator.open(target);
                  return true;
                },
              }
            : undefined
        }
        onRemoved={() => removed(selected.pubkey)}
        openLink={(target) => {
          const pubkey = profileKey(target);
          return !!find(pubkey) && browse(pubkey);
        }}
        canOpenLink={(target) => !!find(profileKey(target))}
        openSettings={openSettings}
        openConversation={conversationOpener(
          navigator,
          connection.viewer && connection.origin
            ? { viewer: connection.viewer, communityOrigin: connection.origin }
            : undefined,
        )}
      />
    )
  ) : undefined;
  const body = (
    <div className={styles.inventory}>
      <div className={styles.content}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            variant="panel"
            label={t("agentsBrowse.agentTabs")}
            value={tab}
            onValueChange={changeTab}
            items={TABS.map((item) => ({
              ...item,
              label: t(
                item.value === "yours"
                  ? "agentsBrowse.yourAgents"
                  : item.value === "teams"
                    ? "agentsBrowse.yourTeams"
                    : "agentsBrowse.marketplace",
              ),
            }))}
          />
          {tab !== "marketplace" &&
            toolbarAction &&
            !(tab === "teams" && editing) &&
            (tab === "teams" ? newTeamMenu : newAgentMenu)}
        </div>
        <section
          id={`agents-${tab}`}
          role="tabpanel"
          aria-labelledby={`agents-${tab}-tab`}
        >
          {tab === "yours" ? (
            yours
          ) : tab === "marketplace" ? (
            <AgentBrowse
              relay={relay}
              selectedId={shared?.agent.id}
              onSelect={(selection, trigger) => {
                sharedTrigger.current = trigger;
                setSharedSelection(selection);
              }}
            />
          ) : (
            <Teams
              agents={agents}
              saved={snapshot.agents.filter(
                (agent) => agent.place !== "elsewhere" && !agent.unfinished,
              )}
              teams={teams}
              editing={editing}
              removing={removing}
              onEdit={editTeam}
              onRemove={removeTeam}
              onSaved={endTeamVisits}
              onBusy={onTeamBusy}
              historyPresentation={
                editing && editing !== "new"
                  ? presentationFor({ team: editing }, teamRoute)
                  : undefined
              }
              newTeam={!toolbarAction && newTeamMenu}
            />
          )}
        </section>
      </div>
    </div>
  );

  return (
    <div className="h-full min-h-0">
      <div
        ref={split.ref}
        style={split.style}
        className={styles.browse}
        data-side={
          (panel && tab === "yours") || (shared && tab === "marketplace")
            ? ""
            : undefined
        }
      >
        <div className={styles.main}>
          <Panel aria-label={t("agentsBrowse.agents")}>
            <div className="flex h-full min-h-0 flex-col">
              <PanelHeader
                title={
                  <Tabs
                    variant="navigation"
                    label={t("agentsBrowse.agentsHeader")}
                    value="agents"
                    onValueChange={() => {}}
                    showSelection={false}
                    items={[
                      {
                        value: "agents",
                        label: t("agentsBrowse.agents"),
                        icon: <RobotIcon size="1rem" />,
                      },
                    ]}
                  />
                }
              />
              <div className="min-h-0 flex-1">{body}</div>
            </div>
          </Panel>
        </div>
        {shared && tab === "marketplace" && (
          <aside className={styles.side}>
            {split.handle}
            <Panel aria-label={t("agentsBrowse.sharedProfile")}>
              <PanelWorkspace
                value={shared.agent.id}
                select={() => {}}
                items={[
                  {
                    id: shared.agent.id,
                    label: shared.agent.name,
                    close: closeShared,
                    content: (
                      <SharedAgentPanel
                        key={shared.agent.id}
                        selection={shared}
                        agents={agents}
                        types={runnable}
                        onImported={leaveListing}
                        // Stays on the listing if an unsaved draft is kept.
                        onOpen={(agent) => browse(agent.pubkey, leaveListing)}
                      />
                    ),
                  },
                ]}
              />
            </Panel>
          </aside>
        )}
        {panel && selected && (
          <aside
            ref={profileSide}
            className={styles.side}
            hidden={tab !== "yours"}
          >
            {split.handle}
            <Panel aria-label={t("agentsBrowse.profile")}>
              <PanelWorkspace
                focusOnMount={false}
                adoptSelection={selected.pubkey}
                value={selected.pubkey}
                select={() => {}}
                items={[
                  {
                    id: selected.pubkey,
                    label: selected.name,
                    content: (
                      <AgentSaveState value={reportUnsaved}>
                        {panel}
                      </AgentSaveState>
                    ),
                    close: closePanel,
                  },
                ]}
              />
            </Panel>
          </aside>
        )}
      </div>
      {flow && (
        <Dialog
          open
          title={
            flow === "import"
              ? t("agentsBrowse.importAgent")
              : t("agentsBrowse.importTeam")
          }
          size="wide"
          height="stable-tall"
          preventClose={importing}
          finalFocus={newAgentButton}
          onOpenChange={(open) => {
            if (!open) setFlow(undefined);
          }}
        >
          <ImportAgents
            key={connection.scope ?? "disconnected"}
            agents={agents}
            community={connection.origin}
            viewer={connection.viewer}
            communities={communities}
            types={runnable}
            only={flow === "import" ? "agents" : "teams"}
            onImported={
              flow === "import" ? () => changeTab("yours") : returnTo("teams")
            }
            onPendingChange={setImporting}
          />
        </Dialog>
      )}
      {leaving && selected && (
        <DiscardChanges
          description={t("agentsBrowse.unsavedName", { name: selected.name })}
          onKeep={() => setLeaving(undefined)}
          onDiscard={() => {
            setLeaving(undefined);
            setSelectedKey(leaving.pubkey);
            leaving.then?.();
          }}
        />
      )}
      {creating && (
        <AgentCreateDialog
          agents={agents}
          types={types}
          community={
            connection.status === "ready" ? connection.origin : undefined
          }
          onClose={() => setCreating(false)}
          onCreated={(agent) => {
            setCreating(false);
            changeTab("yours");
            build(agent.pubkey);
          }}
        />
      )}
      {card && (
        <AgentCardCreate
          key={`${routedEntry}:${card}`}
          card={card}
          agents={agents}
          types={types}
          community={
            connection.status === "ready" ? connection.origin : undefined
          }
          onClose={closeCard}
          onCreated={(agent) => {
            closeCard();
            changeTab("yours");
            build(agent.pubkey);
          }}
        />
      )}
      {providerKey && (
        <ProviderDialog
          type={types.find((type) => type.key === providerKey)}
          finalFocus={newAgentButton}
          visit={routed}
          onClose={() => setProviderKey(undefined)}
        />
      )}
    </div>
  );
}

type InventoryProps = {
  scope?: string | undefined;
  service: Agents;
  agents: readonly Agent[];
  selected: string | undefined;
  typeOf(agent: Agent): RegisteredAgentType | undefined;
  /** False while the current agent stays selected; then runs once another
   * is, which may wait on a discard prompt. */
  onSelect(pubkey?: string, then?: () => void): boolean;
  onBuild(pubkey: string): void;
  onRemoved(pubkey: string): void;
  /** A save is pending, so choosing another agent waits for it. */
  busy?: boolean | undefined;
  newAgent: ReactNode;
  /** The agent explicitly saved as this community's Bestie. */
  bestie?: string | undefined;
  onMakeBestie?: ((pubkey: string) => void) | undefined;
  /** Asks before saving no Bestie; absent where none can be saved. */
  onRemoveBestie?: ((pubkey: string, name: string) => void) | undefined;
  defaultChoices?: ReadonlySet<string>;
  /** The community connection Share publishes through, while it is ready. */
  session?: RelaySession;
  onViewListing?: ((agent: SharedAgent) => void) | undefined;
};

/** Agents keeps Morgan's account-synced selection owner; this surface only
 * names an explicitly saved selection Bestie and asks before replacing it. */
function DefaultAgentInventory({
  session,
  scope,
  ...props
}: InventoryProps & { session: RelaySession; scope: string }) {
  // Keep Morgan's automatic fallback/adoption behavior active even though the
  // Bestie pill names only the explicit account-saved choice.
  useDefaultAgent(session, scope);
  // A remote agent is asked about before it is made Bestie.
  const bestie = useBestieChoice(
    session,
    scope,
    (pubkey) => props.agents.find((agent) => agent.pubkey === pubkey)?.place,
  );
  return (
    <>
      <Inventory
        {...props}
        key={scope}
        scope={scope}
        session={session}
        bestie={bestie.saved}
        defaultChoices={
          new Set(bestie.choices.selectable.map((agent) => agent.pubkey))
        }
        onMakeBestie={bestie.make}
        onRemoveBestie={bestie.remove}
      />
      {bestie.view}
    </>
  );
}

/** Right-clicking an agent card opens its actions menu; the context-menu key
 * and Shift+F10 open it from the keyboard. */
function CardContextMenu({
  name,
  card,
  children,
}: {
  name: string;
  card: ReactElement;
  children: ReactNode;
}) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement>();
  return (
    <ContextMenuRoot
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAnchor(undefined);
      }}
    >
      <ContextMenuTrigger
        render={card}
        // Right-clicks and long-presses in the card's open menus bubble
        // through their portals; only the card itself opens this menu.
        onContextMenu={(event) => {
          if (!event.currentTarget.contains(event.target as Node))
            event.preventBaseUIHandler();
        }}
        onTouchStart={(event) => {
          if (!event.currentTarget.contains(event.target as Node))
            event.preventBaseUIHandler();
        }}
        onKeyDown={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return;
          if (
            event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10")
          ) {
            event.preventDefault();
            event.stopPropagation();
            setAnchor(event.currentTarget);
            setOpen(true);
          }
        }}
      />
      <MenuPopup
        aria-label={t("agentsBrowse.actionsFor", { name })}
        anchor={anchor}
      >
        {children}
      </MenuPopup>
    </ContextMenuRoot>
  );
}

/** By key: the list can change while a discard prompt is open. */
function focusCard(root: ParentNode | null, pubkey: string | undefined) {
  root
    ?.querySelector<HTMLElement>(`[role="gridcell"][data-agent="${pubkey}"]`)
    ?.focus();
}

/** Cards retain arrow navigation; their embedded controls have their own tab stops. The
 * New agent tile leads the grid but is its own stop. */
function Inventory({ scope, agents, typeOf, ...props }: InventoryProps) {
  useLanguage();
  const { ordered, save, error } = useAgentOrder(scope, agents);
  return (
    <>
      <AgentInventoryDrag
        agents={ordered}
        enabled={!!scope}
        onMove={save}
        overlay={(agent) => (
          <AgentCard
            agent={agent}
            community={agent.relay || undefined}
            icon={<TypeIcon type={typeOf(agent)} />}
            detail={summaryOf(agent, typeOf(agent))}
          />
        )}
      >
        {(preview, dragging) => (
          <InventoryGrid
            {...props}
            scope={scope}
            agents={preview}
            dragging={dragging}
            typeOf={typeOf}
          />
        )}
      </AgentInventoryDrag>
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error ===
          "The agent order couldn't be saved on this device. Try again."
            ? t("agentsBrowse.orderFailed")
            : error}
        </p>
      )}
    </>
  );
}

function InventoryGrid({
  scope,
  service,
  agents,
  selected,
  typeOf,
  onSelect,
  onBuild,
  onRemoved,
  busy,
  newAgent,
  bestie,
  defaultChoices,
  onMakeBestie,
  onRemoveBestie,
  session,
  onViewListing,
  dragging,
}: InventoryProps & {
  dragging: boolean;
}) {
  useLanguage();
  const grid = useRef<HTMLDivElement>(null);
  const index = agents.findIndex((agent) => agent.pubkey === selected);
  const columns = () =>
    grid.current
      ? getComputedStyle(grid.current).gridTemplateColumns.split(" ").length
      : 1;
  const onKeyDown = (event: KeyboardEvent) => {
    if (dragging) return;
    if (
      !(event.target instanceof HTMLElement) ||
      event.target.getAttribute("role") !== "gridcell"
    )
      return;
    const last = agents.length - 1;
    const from = index < 0 ? -1 : index;
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns(),
      ArrowUp: -columns(),
    };
    let next: number | undefined;
    if (event.key in step) {
      const delta = step[event.key] ?? 0;
      next = from < 0 ? 0 : from + delta;
      if (next < 0 || next > last)
        next = Math.abs(delta) === 1 ? Math.min(Math.max(next, 0), last) : from;
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === "Enter" && selected) {
      event.preventDefault();
      onBuild(selected);
      return;
    } else if (event.key === "Escape" && selected) {
      event.preventDefault();
      onSelect(undefined, () => focusCard(grid.current, selected));
      return;
    }
    if (next === undefined) return;
    event.preventDefault();
    // Focus follows the selection, including after a discard is confirmed.
    const target = agents[next]?.pubkey;
    onSelect(target, () => focusCard(grid.current, target));
  };
  return (
    <div ref={grid} className={cardStyles.grid} data-agent-grid="">
      {newAgent}
      {agents.length > 0 && (
        // biome-ignore lint/a11y/useSemanticElements: This is a wrapping layout grid of interactive cards, not tabular data.
        <div
          role="grid"
          aria-label={t("agentsBrowse.agents")}
          aria-busy={busy || undefined}
          className="contents"
          onKeyDown={onKeyDown}
        >
          {agents.map((agent, position) => {
            const type = typeOf(agent);
            const active = agent.pubkey === selected;
            const isBestie = agent.pubkey === bestie;
            return (
              <DraggableAgentRow
                key={agent.pubkey}
                agent={agent}
                enabled={!!scope}
              >
                <InventoryCard
                  tag={isBestie ? t("agentsBrowse.bestie") : undefined}
                  bestie={
                    onMakeBestie
                      ? {
                          selected: isBestie,
                          available: !!defaultChoices?.has(agent.pubkey),
                          onMake: () => onMakeBestie(agent.pubkey),
                          ...(onRemoveBestie && {
                            onRemove: () =>
                              onRemoveBestie(agent.pubkey, agent.name),
                          }),
                        }
                      : undefined
                  }
                  service={service}
                  session={session}
                  type={type}
                  onViewListing={onViewListing}
                  onBuild={() => onBuild(agent.pubkey)}
                  onRemoved={() => onRemoved(agent.pubkey)}
                  role="gridcell"
                  data-agent={agent.pubkey}
                  aria-label={
                    isBestie
                      ? t("agentsBrowse.bestieName", { name: agent.name })
                      : agent.name
                  }
                  data-selected={active}
                  aria-selected={active}
                  tabIndex={active || (index < 0 && position === 0) ? 0 : -1}
                  data-unavailable={type ? undefined : ""}
                  onClick={(event) => {
                    if (
                      event.currentTarget.contains(event.target as Node) &&
                      !(event.target as Element).closest(
                        "[data-card-control], button, input",
                      )
                    ) {
                      // A kept agent keeps focus, as the arrow keys leave it.
                      const chose = onSelect(
                        active ? undefined : agent.pubkey,
                        () => focusCard(grid.current, agent.pubkey),
                      );
                      if (!chose) focusCard(grid.current, selected);
                    }
                  }}
                  onDoubleClick={(event) => {
                    if (
                      event.currentTarget.contains(event.target as Node) &&
                      !(event.target as Element).closest(
                        "[data-card-control], button, input",
                      )
                    )
                      onBuild(agent.pubkey);
                  }}
                  agent={agent}
                  community={agent.relay || undefined}
                  icon={<TypeIcon type={type} />}
                  detail={summaryOf(agent, type)}
                />
              </DraggableAgentRow>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Card edits use the same type-owned field and service as creation/settings. */
function InventoryCard({
  service,
  session,
  type,
  onBuild,
  onRemoved,
  bestie,
  onViewListing,
  ...props
}: Omit<React.ComponentProps<typeof AgentCard>, "agent"> & {
  agent: Agent;
  service: Agents;
  session: RelaySession | undefined;
  type: RegisteredAgentType | undefined;
  onBuild(): void;
  onRemoved(): void;
  onViewListing?: ((agent: SharedAgent) => void) | undefined;
  /** Whether it is the community's Bestie or can be made it. */
  bestie?:
    | {
        selected: boolean;
        available: boolean;
        onMake(): void;
        /** Removing it as Bestie, which edits only the account, so it is
         * offered wherever the agent runs. */
        onRemove?: (() => void) | undefined;
      }
    | undefined;
}) {
  useLanguage();
  const agent = props.agent;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const editable = agent.place !== "elsewhere" && !agent.unfinished;
  const Model = editable ? type?.CreateModel : undefined;
  const save = async (config: unknown) => {
    setSaving(true);
    setError("");
    try {
      await service.save(agent.key, {
        config,
        ...(agent.configBase && { base: agent.configBase }),
      });
    } catch (reason) {
      setError(message(reason));
    } finally {
      setSaving(false);
    }
  };
  // The "..." button and right-click share one set of actions.
  const actions = (remove?: () => void, leave?: () => void) => (
    <>
      {bestie && !bestie.selected && (
        <>
          <MenuItem disabled={!bestie.available} onClick={bestie.onMake}>
            {" "}
            {t("agentsBrowse.makeBestie")}{" "}
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      {bestie?.selected && bestie.onRemove && (
        <>
          <MenuItem onClick={bestie.onRemove}>
            {t("agentsBrowse.removeBestie")}
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      {editable && (
        <MenuItem onClick={onBuild}>{t("agentsBrowse.openSettings")}</MenuItem>
      )}
      {editable && session && type?.exportShared && (
        <MenuItem onClick={() => setSharing(true)}>
          {t("agentsBrowse.share")}
        </MenuItem>
      )}
      <MenuItem
        onClick={() => {
          void writeClipboardText(agent.pubkey).catch((reason) =>
            setError(message(reason)),
          );
        }}
      >
        {" "}
        {t("agentsBrowse.copyPublicKey")}{" "}
      </MenuItem>
      {leave && (
        <MenuItem tone="danger" onClick={leave}>
          {" "}
          {t("agentsBrowse.removeHere")}{" "}
        </MenuItem>
      )}
      {remove && (
        <MenuItem tone="danger" onClick={remove}>
          {" "}
          {t("agentsBrowse.deleteAgent")}{" "}
        </MenuItem>
      )}
    </>
  );
  const card = (remove?: () => void, leave?: () => void) => (
    <CardContextMenu
      name={agent.name}
      card={
        <AgentCard
          {...props}
          icon={Model ? undefined : props.icon}
          detail={Model ? undefined : props.detail}
          menu={
            <MenuRoot>
              <MenuTrigger
                render={
                  <IconButton
                    aria-label={t("agentsBrowse.actionsFor", {
                      name: agent.name,
                    })}
                    variant="glass-ghost"
                    size="sm"
                    icon={<DotsThreeIcon size={16} />}
                  />
                }
              />
              <MenuPopup align="end">{actions(remove, leave)}</MenuPopup>
            </MenuRoot>
          }
        >
          {(Model || error) && (
            <div
              data-card-control=""
              className="flex min-w-0 max-w-full flex-col items-center gap-2"
            >
              {Model && (
                <Model
                  agent={agent}
                  openSettings={onBuild}
                  config={agent.config}
                  modelAppearance="glass-ghost"
                  disabled={saving}
                  onChange={(config) => void save(config)}
                />
              )}
              {error && (
                <span role="alert" className="text-body-sm text-danger">
                  {error}
                </span>
              )}
            </div>
          )}
        </AgentCard>
      }
    >
      {actions(remove, leave)}
    </CardContextMenu>
  );
  return (
    <>
      {agent.place === "elsewhere" ? (
        card()
      ) : (
        <AgentDelete
          agents={service}
          agent={agent}
          onRemoved={onRemoved}
          trigger={(remove) =>
            inSeveral(service, agent) ? (
              <AgentRemoveHere
                agents={service}
                agent={agent}
                onRemoved={onRemoved}
                trigger={(leave) => card(remove, leave)}
              />
            ) : (
              card(remove)
            )
          }
        />
      )}
      {sharing && session && (
        <AgentShareDialog
          agent={agent}
          type={type}
          session={session}
          onViewListing={onViewListing}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  );
}

function SideHeader({ title, onClose }: { title: ReactNode; onClose(): void }) {
  useLanguage();
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">{title}</div>
      <IconButton
        aria-label={t("agentsBrowse.close")}
        size="sm"
        icon={<XIcon size={16} aria-hidden="true" />}
        onClick={onClose}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h4 className="m-0 text-caption text-secondary">{title}</h4>
      {children}
    </section>
  );
}

function AgentPeek({
  agents,
  agent,
  type,
  channels,
  onClose,
  onRemoved,
  openSettings,
}: {
  agents: Agents;
  agent: Agent;
  type: RegisteredAgentType | undefined;
  channels: readonly ChannelChoice[];
  onClose(): void;
  onRemoved(): void;
  openSettings: ((section: string) => void) | undefined;
}) {
  useLanguage();
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const finish = async () => {
    setFinishing(true);
    setError("");
    try {
      await agents.finish(agent.pubkey);
    } catch (reason) {
      setError(message(reason));
    }
    setFinishing(false);
  };
  return (
    <div className={styles.sideBody}>
      <PeekIdentity
        agent={agent}
        detail={summaryOf(agent, type)}
        onClose={onClose}
      />
      {agent.place === "elsewhere" ? (
        <p className="m-0 text-body-sm text-secondary">
          {type && !type.remote ? (
            <> {t("agentsBrowse.keyElsewhere")} </>
          ) : (
            rich("agentsBrowse.harnessHelp", {
              plugins: (
                <SettingsSectionLink section="plugins" open={openSettings}>
                  {t("agentsBrowse.managePlugins")}
                </SettingsSectionLink>
              ),
            })
          )}
        </p>
      ) : (
        <>
          <p className="m-0 text-body-sm text-secondary">
            {" "}
            {t("agentsBrowse.finishDescription")}{" "}
          </p>
          <Button
            variant="primary"
            loading={finishing}
            onClick={() => void finish()}
          >
            {" "}
            {t("agentsBrowse.finishSetup")}{" "}
          </Button>
          {error && (
            <p role="alert" className="m-0 text-body-sm text-danger">
              {error}
            </p>
          )}
          <AgentDelete agents={agents} agent={agent} onRemoved={onRemoved} />
          {agent.place === "here" && (
            <Section title={t("agentsBrowse.wakesOn")}>
              <AttentionSummary agent={agent} channels={channels} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function PeekIdentity({
  agent,
  detail,
  onClose,
}: {
  agent: Agent;
  detail: string;
  onClose(): void;
}) {
  useLanguage();
  return (
    <div className={styles.peekIdentity}>
      <span className={styles.portraitLarge}>
        <AgentPortrait agent={agent} community={agent.relay || undefined} />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <h3 className="m-0 truncate text-heading">{agent.name}</h3>
        <p className="m-0 text-body-sm text-secondary">{detail}</p>
      </div>
      <IconButton
        aria-label={t("agentsBrowse.close")}
        size="sm"
        icon={<XIcon size={16} aria-hidden="true" />}
        onClick={onClose}
      />
    </div>
  );
}

const host = (relay: string) => relay.replace(/^wss:\/\//, "");
const sentence = (text: string) => text.replace(/\.?$/, ".");
const LEGACY = "Buzz (Legacy)";

/** The owner's teams with members `joinable` can add here: adding them gives
 * the team, which every community shares, its members here too. */
function teamsToJoin(teams: readonly Team[], joinable: readonly Agent[]) {
  const byPubkey = new Map(joinable.map((agent) => [agent.pubkey, agent]));
  return teams.flatMap((team) => {
    const members = team.members.flatMap((pubkey) => {
      const agent = byPubkey.get(pubkey);
      return agent ? [agent] : [];
    });
    return members.length ? [{ team, members }] : [];
  });
}

/** What a team import left undone, or "" if nothing. */
function teamPortNote({
  team,
  imported,
  failed,
  elsewhere,
  foreign,
  teamError,
  notes = [],
}: TeamPort) {
  if (
    !failed.length &&
    !elsewhere.length &&
    !foreign.length &&
    !teamError &&
    !notes.length
  )
    return "";
  const came = imported.map((agent) => agent.name).join(", ");
  const parts: DisplayMessage[] = [];
  if (teamError)
    parts.push(
      came
        ? localMessage("agentsBrowse.teamSaveWithMembers", {
            team: teamError.name,
            names: came,
          })
        : localMessage("agentsBrowse.teamSaveNoMembers", {
            team: teamError.name,
          }),
    );
  else if (team)
    parts.push(
      came
        ? localMessage("agentsBrowse.importedTeamMembers", {
            team: team.name,
            names: came,
          })
        : localMessage("agentsBrowse.importedTeamOnly", { team: team.name }),
    );
  parts.push(
    ...failed.map((member) =>
      localMessage("agentsBrowse.memberImportFailed", {
        name: member.name,
        error: sentence(member.error),
      }),
    ),
  );
  if (elsewhere.length)
    parts.push(
      localMessage("agentsBrowse.otherCommunities", {
        names: elsewhere.join(", "),
      }),
    );
  if (foreign.length)
    parts.push(
      localMessage("agentsBrowse.otherAccount", { names: foreign.join(", ") }),
    );
  parts.push(...notes.filter(Boolean));
  return parts.length ? Object.freeze(parts) : "";
}

type SharedImport =
  | { agent: Agent }
  | { team: Team; members: readonly Agent[] };

/** One list of what Import can bring here: the owner's agents from their
 * other communities, which come as they are, and old Buzz's, which come as
 * the type chosen on each. */
function ImportAgents({
  agents,
  community,
  viewer,
  communities,
  types,
  only,
  onImported,
  onPendingChange,
}: {
  agents: Agents;
  community: string | undefined;
  viewer: string | undefined;
  communities: CommunityReader | undefined;
  types: readonly RegisteredAgentType[];
  /** The section its entry point imports. */
  only: "agents" | "teams";
  onImported(): void;
  onPendingChange(pending: boolean): void;
}) {
  useLanguage();
  const [found, setFound] = useState<FoundAgents>();
  const [confirming, setConfirming] = useState<SharedImport>();
  const importTrigger = useRef<HTMLButtonElement | null>(null);
  // The type each old Buzz agent or team comes in as, by pubkey or team id;
  // unchosen, the first.
  const [chosenTypes, setChosenTypes] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<AgentFeedback>("");
  // What did not come over with a team that did.
  const [notice, setNotice] = useState<AgentFeedback>("");
  // Each agent the owner chose, in the order chosen: imports run one at a
  // time and the dialog stays open, so several can be picked in a row.
  const [ports, setPorts] = useState<ReadonlyMap<string, "queued" | "done">>(
    new Map(),
  );
  // What did not come over, or why an import failed, by agent; choosing the
  // agent again replaces it.
  const [said, setSaid] = useState<
    ReadonlyMap<string, Readonly<{ text: AgentFeedback; failed: boolean }>>
  >(new Map());
  const chosenPorts = useRef(new Set<string>());
  const portLine = useRef(Promise.resolve());
  // An import still waiting its turn when the dialog goes away is dropped:
  // it would otherwise land in whatever community is selected by then.
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);
  const queued = [...ports.values()].includes("queued");
  useEffect(() => onPendingChange(queued), [queued, onPendingChange]);
  useEffect(() => {
    let live = true;
    agents.portable().then(
      (next) => live && setFound(next),
      (reason) => live && setError(message(reason)),
    );
    return () => {
      live = false;
    };
  }, [agents]);
  const typeFor = (id: string) =>
    types.find((item) => item.key === chosenTypes.get(id)) ?? types[0];
  const chooseType = (id: string, key: string) =>
    setChosenTypes((last) => new Map(last).set(id, key));
  const labels = publicKeyLabels(found?.agents.map((a) => a.pubkey) ?? []);
  const named = new Map<string, number>();
  for (const agent of found?.agents ?? [])
    named.set(agent.name, (named.get(agent.name) ?? 0) + 1);
  const setPort = (pubkey: string, state?: "queued" | "done") =>
    setPorts((last) => {
      const next = new Map(last);
      if (state) next.set(pubkey, state);
      else next.delete(pubkey);
      return next;
    });
  const say = (pubkey: string, text?: AgentFeedback, failed = false) =>
    setSaid((last) => {
      const next = new Map(last);
      if (text) next.set(pubkey, { text, failed });
      else next.delete(pubkey);
      return next;
    });
  /** Runs `bring` for the agent after the ones chosen before it. */
  const queue = (
    pubkey: string,
    name: string,
    bring: () => Promise<Readonly<{ notes: readonly string[] }>>,
  ) => {
    if (chosenPorts.current.has(pubkey)) return;
    chosenPorts.current.add(pubkey);
    setPort(pubkey, "queued");
    say(pubkey);
    portLine.current = portLine.current.then(async () => {
      if (!open.current) return;
      try {
        const { notes } = await bring();
        setPort(pubkey, "done");
        if (notes.length) say(pubkey, notes.join(" "));
        onImported();
      } catch (reason) {
        chosenPorts.current.delete(pubkey);
        setPort(pubkey);
        say(
          pubkey,
          localMessage("agentsBrowse.wasntImported", {
            name,
            error: sentence(message(reason)),
          }),
          true,
        );
      }
    });
  };
  const port = (agent: PortableAgent) => {
    const type = typeFor(agent.pubkey)?.key;
    if (!type) return;
    queue(agent.pubkey, agent.name, () =>
      agents.port({ source: agent.source, pubkey: agent.pubkey, type }),
    );
  };
  const join = (agent: Agent) =>
    queue(agent.pubkey, agent.name, () => agents.join(agent.key));
  /** Adds each of the team's members from the owner's other communities. */
  const joinTeam = async (team: Team, members: readonly Agent[]) => {
    if (pending) return;
    setPending(team.id);
    onPendingChange(true);
    setError("");
    setNotice("");
    const notes: string[] = [];
    const failures: DisplayMessage[] = [];
    for (const member of members) {
      if (!open.current) return;
      try {
        notes.push(...(await agents.join(member.key)).notes);
      } catch (reason) {
        failures.push(
          localMessage("agentsBrowse.wasntImported", {
            name: member.name,
            error: sentence(message(reason)),
          }),
        );
      }
    }
    if (!open.current) return;
    setPending(undefined);
    onPendingChange(false);
    // Leaving would hide the one place that names what still needs a hand.
    if (failures.length) setError(failures);
    if (notes.length) setNotice(notes.join(" "));
    if (!failures.length && !notes.length) onImported();
  };
  const importShared = (selection: SharedImport) => {
    if ("agent" in selection) join(selection.agent);
    else void joinTeam(selection.team, selection.members);
  };
  const requestShared = (
    trigger: HTMLButtonElement,
    selection: SharedImport,
  ) => {
    if (
      viewer &&
      readView<unknown>(viewer, importReminderKey, false) === true
    ) {
      importShared(selection);
      return;
    }
    importTrigger.current = trigger;
    setConfirming(selection);
  };
  const portTeam = async (team: OldTeam) => {
    const type = typeFor(team.id)?.key;
    if (!type || pending) return;
    setPending(team.id);
    onPendingChange(true);
    setError("");
    setNotice("");
    try {
      const result = await agents.portTeam({ id: team.id, type });
      const came = new Set(result.imported.map((agent) => agent.pubkey));
      setFound(
        (last) =>
          last && {
            ...last,
            agents: last.agents.filter((item) => !came.has(item.pubkey)),
            here: [...last.here, ...came],
          },
      );
      // Leaving would hide the one place that names what still needs a hand.
      const note = teamPortNote(result);
      if (note) setError(note);
      else onImported();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setPending(undefined);
      onPendingChange(false);
    }
  };
  // The owner's agents in their other communities, as offered since the
  // dialog opened, so one added here stays listed as added, and those its
  // community lists only once it connects still come.
  const { snapshot } = useAgents(agents);
  const [offered, setOffered] = useState(() => agents.joinable());
  // biome-ignore lint/correctness/useExhaustiveDependencies: What it can join changes with the snapshot.
  useEffect(() => {
    setOffered((shown) => {
      const more = agents
        .joinable()
        .filter((agent) => !shown.some((item) => item.key === agent.key));
      return more.length ? [...shown, ...more] : shown;
    });
  }, [agents, snapshot]);
  if (!types.length)
    return (
      <p className="m-0 text-body-sm text-secondary">
        {" "}
        {t("agentsBrowse.enableType")}{" "}
      </p>
    );
  const elsewhere = only === "agents" ? offered : [];
  const teamsElsewhere =
    only === "teams" ? teamsToJoin(snapshot.teams, agents.joinable()) : [];
  const old = found?.[only] ?? [];
  const yours = new Set(found?.here);
  const failures = [...said.values()].filter((item) => item.failed);
  const notes = [...said.values()].filter((item) => !item.failed);
  const members = (count: number) =>
    t(
      count === 1
        ? "agentsBrowse.memberCountOne"
        : "agentsBrowse.memberCountMany",
      { count },
    );
  /** The type menu that comes with old Buzz's import for `id`. */
  const typeMenu = (id: string) => (
    <MenuRadioGroup
      value={typeFor(id)?.key ?? ""}
      onValueChange={(key: string) => chooseType(id, key)}
    >
      {types.map((item) => (
        <MenuRadioItem key={item.key} value={item.key} closeOnClick>
          <ChoiceRow label={item.title} leading={<TypeIcon type={item} />} />
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
  const empty = !!found && !elsewhere.length && !teamsElsewhere.length;
  return (
    <div className="flex flex-col gap-4">
      {(error || failures.length > 0) && (
        <p role="alert" className="m-0 text-body-sm text-danger">
          {[error, ...failures.map((item) => item.text)]
            .filter(Boolean)
            .map(feedbackText)
            .join(" ")}
        </p>
      )}
      {(notice || notes.length > 0) && (
        <p role="status" className="m-0 text-body-sm text-secondary">
          {[notice, ...notes.map((item) => item.text)]
            .filter(Boolean)
            .map(feedbackText)
            .join(" ")}
        </p>
      )}
      {found?.warnings.map((warning) => (
        <p key={warning} className="m-0 text-body-sm text-secondary">
          {warning}
        </p>
      ))}
      {old.length > 0 && (
        <p className="m-0 text-body-sm text-secondary">
          {rich("agentsBrowse.legacyWarning", {
            legacy: <strong>Buzz (Legacy)</strong>,
          })}
        </p>
      )}
      {empty && !old.length ? (
        <p className="m-0 text-body-sm text-secondary">
          {found.warnings.length
            ? t(
                only === "teams"
                  ? "agentsBrowse.noReadableTeams"
                  : "agentsBrowse.noReadableAgents",
              )
            : only === "teams"
              ? t("agentsBrowse.noTeamsImport")
              : t("agentsBrowse.noAgentsImport")}
        </p>
      ) : only === "teams" ? (
        <section aria-label={t("agentsBrowse.teamsImport")}>
          <ul className={styles.portList}>
            {teamsElsewhere.map(({ team, members: joining }) => (
              <ImportRow
                key={team.id}
                name={team.name}
                detail={joining.map((member) => member.name).join(", ")}
              >
                <Button
                  size="compact"
                  variant="prominent"
                  aria-label={t("agentsBrowse.importTeamName", {
                    name: team.name,
                  })}
                  loading={pending === team.id}
                  disabled={!!pending && pending !== team.id}
                  onClick={(event) =>
                    requestShared(event.currentTarget, {
                      team,
                      members: joining,
                    })
                  }
                >
                  {" "}
                  {t("agentsBrowse.import")}{" "}
                </Button>
              </ImportRow>
            ))}
            {found?.teams.map((team) => {
              const here = team.members.filter((member) =>
                yours.has(member.pubkey),
              ).length;
              return (
                <ImportRow
                  key={team.id}
                  name={team.name}
                  detail={[
                    members(team.members.length),
                    here > 0 && t("agentsBrowse.alreadyHere", { count: here }),
                    LEGACY,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  <SplitButton
                    size="sm"
                    variant="prominent"
                    aria-label={t("agentsBrowse.importAsTeam", {
                      type: String(typeFor(team.id)?.title),
                      name: team.name,
                    })}
                    menuLabel={t("agentsBrowse.chooseTeamType", {
                      name: team.name,
                    })}
                    menu={typeMenu(team.id)}
                    loading={pending === team.id}
                    disabled={!!pending && pending !== team.id}
                    onClick={() => void portTeam(team)}
                  >
                    <ImportType type={typeFor(team.id)} />
                  </SplitButton>
                </ImportRow>
              );
            })}
          </ul>
        </section>
      ) : (
        <section
          aria-label={t("agentsBrowse.agentsImport")}
          className={cardStyles.grid}
          data-import=""
        >
          {elsewhere.map((agent) => (
            <AgentCard
              key={agent.pubkey}
              agent={agent}
              community={agent.relay}
              icon={
                <TypeIcon
                  type={types.find((item) => item.key === agent.type)}
                />
              }
              detail={host(agent.relay)}
            >
              {ports.get(agent.pubkey) === "done" ? (
                <Imported name={agent.name} />
              ) : (
                <Button
                  size="compact"
                  variant="prominent"
                  aria-label={t("agentsBrowse.importFrom", {
                    name: agent.name,
                    host: host(agent.relay),
                  })}
                  loading={ports.get(agent.pubkey) === "queued"}
                  onClick={(event) => {
                    requestShared(event.currentTarget, { agent });
                  }}
                >
                  {" "}
                  {t("agentsBrowse.import")}{" "}
                </Button>
              )}
            </AgentCard>
          ))}
          {found?.agents.map((agent) => (
            <AgentCard
              key={agent.pubkey}
              agent={agent}
              community={agent.relay || undefined}
              detail={[
                LEGACY,
                // Its key tells it apart only from one of the same name.
                named.get(agent.name) !== 1 && labels.get(agent.pubkey),
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              {ports.get(agent.pubkey) === "done" ? (
                <Imported name={agent.name} />
              ) : (
                <SplitButton
                  size="sm"
                  variant="prominent"
                  aria-label={t("agentsBrowse.importAsName", {
                    type: String(typeFor(agent.pubkey)?.title),
                    name: agent.name,
                  })}
                  menuLabel={t("agentsBrowse.chooseType", { name: agent.name })}
                  menu={typeMenu(agent.pubkey)}
                  loading={ports.get(agent.pubkey) === "queued"}
                  onClick={() => port(agent)}
                >
                  <ImportType type={typeFor(agent.pubkey)} />
                </SplitButton>
              )}
            </AgentCard>
          ))}
        </section>
      )}
      {!found && !error && (
        <p role="status" className="m-0 text-body-sm text-secondary">
          {" "}
          {t("agentsBrowse.looking")}{" "}
        </p>
      )}
      {confirming && (
        <CommunityImportDialog
          selection={confirming}
          community={community}
          communities={communities}
          canRemember={!!viewer}
          finalFocus={importTrigger}
          onClose={() => setConfirming(undefined)}
          onImport={(remember) => {
            if (remember && viewer) writeView(viewer, importReminderKey, true);
            setConfirming(undefined);
            importShared(confirming);
          }}
        />
      )}
      {only === "agents" && (
        <FileImport agents={agents} types={types} onImported={onImported} />
      )}
    </div>
  );
}

/** Registered artwork can stand for a known type; the robot fallback cannot. */
function ImportType({ type }: { type: RegisteredAgentType | undefined }) {
  useLanguage();
  return (
    <>
      {rich("agentsBrowse.importAs", {
        type:
          type?.icon && type.icon !== RobotIcon ? (
            <TypeIcon type={type} />
          ) : (
            (type?.title ?? null)
          ),
      })}
    </>
  );
}

/** Explain the shared identity before adding it to another community. */
function CommunityImportDialog({
  selection,
  community,
  communities,
  canRemember,
  finalFocus,
  onClose,
  onImport,
}: {
  selection: SharedImport;
  community: string | undefined;
  communities: CommunityReader | undefined;
  canRemember: boolean;
  finalFocus: React.RefObject<HTMLButtonElement | null>;
  onClose(): void;
  onImport(remember: boolean): void;
}) {
  useLanguage();
  const proceed = useRef<HTMLButtonElement>(null);
  const [remember, setRemember] = useState(false);
  const known = useSyncExternalStore(
    communities?.subscribe ?? noSubscribe,
    () => communities?.snapshot(),
  );
  const members = "agent" in selection ? [selection.agent] : selection.members;
  const name =
    "agent" in selection ? selection.agent.name : selection.team.name;
  const sources = [...new Set(members.map((member) => member.relay))];
  const first = members[0];
  const portrait =
    members.length === 1 && first ? (
      <div className={styles.importPortrait} aria-hidden="true">
        <AgentPortrait agent={first} community={first.relay} />
      </div>
    ) : (
      <div className={cardStyles.crew} aria-hidden="true">
        {members.slice(0, 3).map((member) => (
          <span className={cardStyles.crewPortrait} key={member.key}>
            <AgentPortrait agent={member} community={member.relay} />
          </span>
        ))}
      </div>
    );
  return (
    <Dialog
      open
      size="compact"
      headerGap="compact"
      footerGap="compact"
      title={t("agentsBrowse.importName", { name })}
      artwork={
        <div className="grid gap-3">
          {members.length > 1 && portrait}
          <div className={styles.importIdentity}>
            {sources.map((source) => (
              <ImportCommunity
                key={source}
                origin={source}
                memberships={known?.memberships}
                direction="From"
              />
            ))}
            {members.length === 1 && portrait}
            <ImportCommunity
              origin={community}
              memberships={known?.memberships}
              direction="To"
            />
          </div>
        </div>
      }
      initialFocus={proceed}
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      actions={
        <>
          <Button onClick={onClose}>{t("agentsBrowse.cancel")}</Button>
          <Button
            ref={proceed}
            variant="prominent"
            onClick={() => onImport(remember)}
          >
            {" "}
            {t("agentsBrowse.import")}{" "}
          </Button>
        </>
      }
    >
      <dl className="m-0 grid min-w-0 gap-6">
        <div className="flex items-start gap-3">
          <GearIcon
            size={20}
            className="shrink-0 text-secondary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <dt className="text-label-sm">{t("agentsBrowse.oneSetup")}</dt>
            <dd className="m-0 mt-1 text-body-sm text-secondary">
              {sharedAgentSettings ===
              "Name, type and settings, including instructions, model and workspace, are shared across communities."
                ? t("agentsBrowse.sharedSettings")
                : sharedAgentSettings}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <BrainIcon
            size={20}
            className="shrink-0 text-secondary"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <dt className="text-label-sm">{t("agentsBrowse.memoriesStay")}</dt>
            <dd className="m-0 mt-1 text-body-sm text-secondary">
              {" "}
              {t("agentsBrowse.separateDetails")}{" "}
            </dd>
          </div>
        </div>
      </dl>
      {canRemember && (
        <div className="mt-3">
          <Checkbox
            label={t("agentsBrowse.dontRemind")}
            checked={remember}
            onCheckedChange={setRemember}
          />
        </div>
      )}
    </Dialog>
  );
}

function ImportCommunity({
  origin,
  memberships,
  direction,
}: {
  origin: string | undefined;
  memberships: readonly Membership[] | undefined;
  direction: "From" | "To";
}) {
  useLanguage();
  const destination = origin ? communityDestination(origin) : undefined;
  const membership =
    destination &&
    memberships?.find(
      (item) => communityDestination(item.id).url === destination.url,
    );
  const name = membership
    ? communityName(membership)
    : (destination?.name ?? t("agentsBrowse.thisCommunity"));
  return (
    <Tooltip
      content={
        destination && name !== destination.name
          ? t(
              direction === "From"
                ? "agentsBrowse.fromQualified"
                : "agentsBrowse.toQualified",
              { name, host: destination.name },
            )
          : t(
              direction === "From"
                ? "agentsBrowse.fromTooltip"
                : "agentsBrowse.toTooltip",
              { name },
            )
      }
    >
      <figure
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users need access to the community name and address in the tooltip.
        tabIndex={0}
        aria-label={t(
          direction === "From"
            ? "agentsBrowse.fromName"
            : "agentsBrowse.toName",
          { name },
        )}
        className={styles.importCommunity}
      >
        <div
          className={styles.importCommunityImage}
          data-avatar-shape="squircle"
        >
          <Avatar
            size="fill"
            shape="squircle"
            alt=""
            fallback={name}
            src={
              membership
                ? communityIcon(membership.publishedIcon ?? membership.icon)
                : undefined
            }
          />
        </div>
        <figcaption className="sr-only">
          {name} {destination?.name}
        </figcaption>
      </figure>
    </Tooltip>
  );
}

/** An import that finished, keeping the owner's place for the next one. */
function Imported({ name }: { name: string }) {
  useLanguage();
  // It replaces the import's control, taking keyboard focus with it.
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!document.activeElement || document.activeElement === document.body)
      ref.current?.focus();
  }, []);
  return (
    <Button
      ref={ref}
      size="compact"
      variant="outline"
      aria-label={t("agentsBrowse.importedName", { name })}
      disabled
      focusableWhenDisabled
    >
      <CheckIcon size={16} aria-hidden="true" /> {t(
        "agentsBrowse.imported",
      )}{" "}
    </Button>
  );
}

/** A team Import can bring here, with its action. */
function ImportRow({
  name,
  detail,
  children,
}: {
  name: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <li className={styles.portRow}>
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-body">{name}</span>
        <span className="truncate text-caption text-secondary">{detail}</span>
      </span>
      {children}
    </li>
  );
}

/** An exported `.agent.json` or `.agent.png`, imported as a new agent. */
function FileImport({
  agents,
  types,
  onImported,
}: {
  agents: Agents;
  types: readonly RegisteredAgentType[];
  onImported(): void;
}) {
  useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [shared, setShared] = useState<SharedDefinition>();
  const [error, setError] = useState<DisplayMessage>("");
  const read = async (file: File) => {
    setError("");
    try {
      setShared(await readSnapshot(file));
    } catch (reason) {
      setError(
        localMessage("agentsBrowse.readSnapshotFailed", {
          error: message(reason),
        }),
      );
    }
  };
  return (
    <section
      aria-label={t("agentsBrowse.snapshot")}
      className="flex flex-col items-start gap-2"
    >
      <InlineHeader
        title={t("agentsBrowse.snapshot")}
        subtitle={t("agentsBrowse.snapshotDescription")}
      />
      <Button
        ref={trigger}
        size="compact"
        variant="outline"
        onClick={() => input.current?.click()}
      >
        {" "}
        {t("agentsBrowse.chooseFile")}{" "}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".json,.png"
        aria-label={t("agentsBrowse.chooseFile")}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void read(file);
        }}
      />
      {error && (
        <p role="alert" className="m-0 text-body-sm text-danger">
          {resolveMessage(error)}
        </p>
      )}
      {shared && (
        <SharedImportDialog
          shared={shared}
          agents={agents}
          types={types}
          onImported={() => {
            setShared(undefined);
            onImported();
          }}
          onClose={() => setShared(undefined)}
          finalFocus={trigger}
        />
      )}
    </section>
  );
}

/** The owner's teams: each a name, instructions and members, given to every
 * member's prompt with a roster. Agents record nothing about their teams. */
function Teams({
  agents,
  saved,
  teams,
  editing,
  removing,
  onEdit,
  onRemove,
  onSaved,
  onBusy,
  historyPresentation,
  newTeam,
}: {
  agents: Agents;
  saved: readonly Agent[];
  teams: readonly Team[];
  /** A team's id while it is edited, or "new" for one being made. */
  editing: string | undefined;
  /** A team while its delete runs, which may have left `teams`. */
  removing: Team | undefined;
  onEdit(id: string | undefined): void;
  onRemove(team: Team): Promise<void>;
  onSaved(id: string): void;
  onBusy(busy: boolean): void;
  historyPresentation?: HistoryPresentation | undefined;
  newTeam: ReactNode;
}) {
  useLanguage();
  const team =
    teams.find((item) => item.id === editing) ??
    (removing?.id === editing ? removing : undefined);
  if (editing === "new" || team)
    return (
      <TeamEditor
        key={editing}
        agents={agents}
        saved={saved}
        {...(team ? { team } : {})}
        onRemove={onRemove}
        historyPresentation={historyPresentation}
        onBusy={onBusy}
        onSaved={onSaved}
        onDone={() => onEdit(undefined)}
      />
    );
  const byKey = new Map(saved.map((agent) => [agent.pubkey, agent]));
  return (
    <div className="grid gap-4">
      <div className={cardStyles.grid}>
        {newTeam}
        {teams.length > 0 && (
          <ul className="contents" aria-label={t("agentsBrowse.teams")}>
            {teams.map((item) => (
              <li key={item.id} className="contents">
                <TeamCard
                  name={item.name}
                  aria-label={item.name}
                  members={item.members.flatMap((pubkey) => {
                    const member = byKey.get(pubkey);
                    return member
                      ? [{ ...member, community: member.relay || undefined }]
                      : [];
                  })}
                  onClick={() => onEdit(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const sameMembers = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((pubkey) => b.includes(pubkey));

function TeamEditor({
  agents,
  saved,
  team,
  onRemove,
  historyPresentation,
  onBusy,
  onSaved,
  onDone,
}: {
  agents: Agents;
  saved: readonly Agent[];
  team?: Team;
  /** Deletes the team, keeping this editor open until that ends. */
  onRemove(team: Team): Promise<void>;
  historyPresentation?: HistoryPresentation | undefined;
  onBusy(busy: boolean): void;
  /** Ends the saved team's visits, even once this editor is gone. */
  onSaved(id: string): void;
  onDone(): void;
}) {
  useLanguage();
  // A saved revert, until the team shows its new version.
  const [reverted, setReverted] = useState(false);
  const synced = team && agents.teamHistory(team.id);
  const history = synced && {
    ...synced,
    revise: async (...args: Parameters<typeof synced.revise>) => {
      const outcome = await synced.revise(...args);
      if (outcome.status === "accepted") setReverted(true);
      return outcome;
    },
  };
  const [name, setName] = useState(team?.name ?? "");
  const [instructions, setInstructions] = useState(team?.instructions ?? "");
  const [members, setMembers] = useState<readonly string[]>(
    team?.members ?? [],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const askDelete = (open: boolean) => {
    setError("");
    setDeleting(open);
  };
  const done = useRef(onDone);
  done.current = onDone;
  // A Save that finishes after this editor is gone leaves whatever editor
  // replaced it alone; its team's visits still end through `onSaved`.
  useEffect(
    () => () => {
      done.current = () => {};
    },
    [],
  );
  // What a synced Save revises, and a new team's id for every retry.
  const [opened, setOpened] = useState(team);
  const nameEdited = !!opened && name !== opened.name;
  const membersEdited = !!opened && !sameMembers(members, opened.members);
  const busy =
    pending ||
    (opened
      ? nameEdited || membersEdited || instructions !== opened.instructions
      : !!(name.trim() || instructions || members.length));
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  // A revert takes its instructions, and the saved name and members unless
  // edited here. An edit over a newer saved change keeps the opened version,
  // so Save is refused as a conflict rather than undoing that change.
  useEffect(() => {
    if (!reverted || !team || !opened || team.revision === opened.revision)
      return;
    setReverted(false);
    setInstructions(team.instructions);
    if (!nameEdited) setName(team.name);
    if (!membersEdited) setMembers(team.members);
    if (
      !(nameEdited && team.name !== opened.name) &&
      !(membersEdited && !sameMembers(team.members, opened.members))
    )
      setOpened(team);
  }, [reverted, team, opened, nameEdited, membersEdited]);
  const [draft] = useState(() => crypto.randomUUID());
  const which = opened ? { id: opened.id } : { draft };
  // While it has unsaved changes or a Save running, a local team isn't moved
  // to its community, which would close this editor.
  const held =
    !!opened &&
    (pending ||
      name !== opened.name ||
      instructions !== opened.instructions ||
      members.length !== opened.members.length ||
      members.some((pubkey) => !opened.members.includes(pubkey)));
  useEffect(
    () => (held && opened ? agents.holdTeam(opened.id) : undefined),
    [agents, held, opened],
  );
  // Each hosted agent picked, as listed then in the only community with it.
  const [picked, setPicked] = useState<ReadonlyMap<string, Agent>>(
    () => new Map(),
  );
  // Only a team Save puts in this community can have its hosted agents.
  const listed = agents.teamHere(which)
    ? saved
    : saved.filter((agent) => agent.place === "here");
  // Hosted agents picked where Save puts the team stay choices while not
  // listed, as while its agent list is read again or once one is deleted, so
  // each can be unchecked. Not one picked in another community, as before
  // selecting this one, which can't have it.
  const choices = [
    ...listed,
    ...[...picked.values()].filter(
      (agent) =>
        agents.teamHere(which, agent.relay) &&
        !listed.some((item) => item.pubkey === agent.pubkey),
    ),
  ];
  // What Save gets: members among these choices, ones the team already has,
  // and agents here in other communities.
  const kept = members.filter(
    (pubkey) =>
      choices.some((agent) => agent.pubkey === pubkey) ||
      opened?.members.includes(pubkey) ||
      agents.memberships(pubkey).length > 0,
  );
  // Members not in this community, which it doesn't list but keeps.
  const away = members.filter(
    (pubkey) =>
      !choices.some((agent) => agent.pubkey === pubkey) &&
      agents.memberships(pubkey).length > 0,
  ).length;
  // Their provider runs them, so they may not get the team's instructions.
  const remote = choices.filter(
    (agent) => agent.place === "hosted" && members.includes(agent.pubkey),
  );
  const act = async (work: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    setError("");
    const ended = onSaved;
    const id = opened?.id;
    try {
      await work();
      if (id) ended(id);
      // The latest, as Back may have moved on while it ran.
      done.current();
    } catch (reason) {
      setError(message(reason));
      setPending(false);
    }
  };
  const save = () =>
    act(() =>
      agents.saveTeam({
        ...(opened ? { id: opened.id, opened } : { draft }),
        name: name.trim(),
        instructions,
        members: kept,
      }),
    );
  return (
    <form
      className={styles.sideBody}
      aria-label={
        team
          ? t("agentsBrowse.editName", { name: team.name })
          : t("agentsBrowse.newTeam")
      }
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      onKeyDown={(event) => {
        // Not while Save runs, as its button keeps focus while loading, nor
        // under the dialog: before focus moves into it, its Escape starts here.
        if (event.key === "Escape" && !pending && !deleting) onDone();
      }}
    >
      <SideHeader
        title={
          <h3 className="m-0 text-heading">
            {team ? t("agentsBrowse.editTeam") : t("agentsBrowse.newTeam")}
          </h3>
        }
        onClose={onDone}
      />
      {team && <TeamSyncLine agents={agents} id={team.id} />}
      <Field label={t("agentsBrowse.name")}>
        <Input
          autoFocus
          value={name}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field
        label={t("agentsBrowse.instructions")}
        description={
          <>
            {remote.length > 0
              ? t("agentsBrowse.deviceInstructions")
              : t("agentsBrowse.memberInstructions")}
            {remote.length > 0 && (
              <>
                {" "}
                <span className="mt-1 flex items-start gap-1 text-warning">
                  <WarningCircleIcon className="mt-0.5 shrink-0" aria-hidden />
                  {t("agentsBrowse.providerInstructions", {
                    names: names(remote),
                  })}
                </span>
              </>
            )}
          </>
        }
      >
        <Textarea
          rows={5}
          value={instructions}
          disabled={pending}
          onChange={(event) => setInstructions(event.target.value)}
        />
      </Field>
      {history && (
        <ConfigHistoryRow
          history={history}
          presentation={historyPresentation}
        />
      )}
      <Section title={t("agentsBrowse.members")}>
        {choices.length ? (
          <div className="grid gap-2">
            {choices.map((agent) => (
              <Checkbox
                key={agent.pubkey}
                label={agent.name}
                checked={members.includes(agent.pubkey)}
                disabled={pending}
                onCheckedChange={(checked) => {
                  if (agent.place === "hosted")
                    setPicked((last) => new Map(last).set(agent.pubkey, agent));
                  setMembers((last) =>
                    checked
                      ? [...last, agent.pubkey]
                      : last.filter((pubkey) => pubkey !== agent.pubkey),
                  );
                }}
              />
            ))}
          </div>
        ) : (
          <p className="m-0 text-body-sm text-secondary">
            {t("agentsBrowse.noAgentsYet")}
          </p>
        )}
        {away > 0 && (
          <p className="m-0 text-body-sm text-secondary">
            {t("agentsBrowse.awayMembers", { count: away })}
          </p>
        )}
      </Section>
      {error && !deleting && (
        <p role="alert" className="m-0 text-body-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={!name.trim()}
        >
          {team ? t("agentsBrowse.save") : t("agentsBrowse.createTeam")}
        </Button>
        {team && (
          <Button
            ref={deleteButton}
            variant="destructive"
            disabled={pending}
            onClick={() => askDelete(true)}
          >
            {" "}
            {t("agentsBrowse.deleteTeam")}{" "}
          </Button>
        )}
      </div>
      {team && deleting && (
        <AlertDialog
          title={t("agentsBrowse.deleteName", { name: team.name })}
          description={t(
            team.revision
              ? "agentsBrowse.deleteTeamSynced"
              : "agentsBrowse.deleteTeamLocal",
          )}
          pending={pending}
          // While pending, it closes only with the editor, once the delete
          // ends. The editor also goes if the team is deleted elsewhere, and
          // React has by then cleared Delete team's ref. Either way focus
          // moves to the tab now shown, as leaveListing does.
          finalFocus={() =>
            pending || !deleteButton.current
              ? (document.getElementById("agents-teams-tab") ?? false)
              : deleteButton.current
          }
          onClose={() => askDelete(false)}
          actions={
            <>
              <Button disabled={pending} onClick={() => askDelete(false)}>
                {" "}
                {t("agentsBrowse.cancel")}{" "}
              </Button>
              <Button
                variant="destructive"
                loading={pending}
                onClick={() => void act(() => onRemove(team))}
              >
                {" "}
                {t("agentsBrowse.deleteTeam")}{" "}
              </Button>
            </>
          }
        >
          {error && (
            <p role="alert" className="m-0 text-body-sm text-danger">
              {error}
            </p>
          )}
        </AlertDialog>
      )}
    </form>
  );
}

/** Where the team lives: synced in its community, or only on this device. */
function TeamSyncLine({ agents, id }: { agents: Agents; id: string }) {
  useLanguage();
  const line = useSyncLine(agents, () => agents.teamSync(id), "team");
  const state = agents.teamSync(id);
  if (!line || !state) return null;
  const host = (relay: string) => relay.replace(/^\w+:\/\//, "");
  const text =
    "synced" in state
      ? t("agentsBrowse.syncedIn", { host: host(state.synced) })
      : "conflict" in state
        ? t("agentsBrowse.syncConflict", { host: host(state.conflict) })
        : state.local
          ? t(
              state.local === "communities"
                ? "agentsBrowse.syncCommunities"
                : state.local === "unsupported"
                  ? "agentsBrowse.syncUnsupported"
                  : "agentsBrowse.syncFailed",
            )
          : t("agentsBrowse.onlyMac");
  return <p className="m-0 text-body-sm text-secondary">{text}</p>;
}
