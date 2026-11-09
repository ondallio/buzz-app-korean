import { t, useLanguage } from "../../shared/i18n";
// Browse: the agents this community's members have shared, each importable
// as a new agent. The catalog is read a page at a time; an over-budget page is
// retried smaller.
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  checkText,
  type SharedDefinition,
  shareable,
} from "../../features/agents/agent-share";
import { useAgents } from "../../features/agents/react";
import { flushSync } from "react-dom";
import { AGENT_CATALOG_KIND } from "../../features/agents/catalog-envelope";
import { ModelIcon } from "../../features/agents/ModelPicker";
import type {
  Agent,
  Agents,
  RegisteredAgentType,
} from "../../features/agents/service";
import {
  type SharedAgent,
  sharedAgents,
} from "../../features/agents/shared-agents";
import { ReadError } from "../../features/relay/errors";
import type { EventData } from "../../features/relay/events";
import {
  useProfileGeneration,
  useRelayConnection,
} from "../../features/relay/react";
import { useReauthorizedRetry } from "../../features/relay/RecoveryNotice";
import type { RelayData } from "../../features/relay/service";
import type { RelaySession } from "../../features/relay/session";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Button } from "../../shared/design-system/ui/Button";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { Select } from "../../shared/design-system/ui/Select";
import { Tooltip } from "../../shared/design-system/ui/Tooltip";
import { useAvatarPreview } from "../../features/profiles/use-avatar-preview";
import {
  canonicalPublicKey,
  formatPublicKey,
} from "../../shared/identity/public-key";
import { AgentCardBackdrop, AgentPortrait } from "./AgentCard";
import { SurfaceButton } from "../../shared/design-system/ui/SurfaceButton";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { AgentInstructions } from "../../features/agents/AgentInstructions";
import { ProfileBackdrop } from "../../features/profiles/ProfileBackdrop";
import { agentAvatars } from "../../features/agents/avatar-packs";
import hero from "../../features/profiles/ProfileHero.module.css";
import pageStyles from "./AgentsPage.module.css";
import cardStyles from "./AgentCard.module.css";
import styles from "./AgentBrowse.module.css";

const pageSize = 200;

type Importing = Readonly<{
  agents: Agents;
  /** The types an import can be, which run on this computer. */
  types: readonly RegisteredAgentType[];
  onImported(agent: Agent): void;
  /** Opens an agent of yours that an import would only copy. */
  onOpen?: ((agent: Agent) => void) | undefined;
}>;

export type SharedAgentSelection = {
  agent: SharedAgent;
  session: RelaySession;
  community: string | undefined;
};
type Selection = {
  selectedId?: string | undefined;
  onSelect(selection: SharedAgentSelection, trigger: HTMLButtonElement): void;
};

export function AgentBrowse({
  relay,
  ...selection
}: Selection & { relay: RelayData }) {
  useLanguage();
  const connection = useRelayConnection(relay);
  if (connection.status !== "ready") return <p>{t("agentsBrowse.connect")}</p>;
  // A new session (another community) starts over from the first page.
  return (
    <SharedAgentList
      key={connection.generation}
      session={connection.session}
      community={connection.origin}
      {...selection}
    />
  );
}

function SharedAgentList({
  session,
  community,
  selectedId,
  onSelect,
}: Selection & {
  session: RelaySession;
  community: string | undefined;
}) {
  useLanguage();
  const [events, setEvents] = useState<readonly EventData[]>([]);
  const [cursor, setCursor] = useState<{ until: number; before_id: string }>();
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // A catalog opened while signed out loads once sign-in lands.
  const reauthorized = useReauthorizedRetry(session.recovery, () =>
    setAttempt((value) => value + 1),
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: An explicit retry reruns this finite read.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const failed = reauthorized.begin();
    const readPage = async () => {
      let limit = pageSize;
      for (;;) {
        controller.signal.throwIfAborted();
        try {
          const page = await session.read(
            [{ kinds: [AGENT_CATALOG_KIND], limit, ...cursor }],
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          setEvents((previous) => (cursor ? [...previous, ...page] : page));
          setMore(page.length === limit);
          return;
        } catch (problem) {
          // Match the community catalog's bounded retry at the same cursor.
          if (
            problem instanceof ReadError &&
            problem.kind === "invalid-response" &&
            problem.message === "Relay response exceeds the read budget" &&
            limit > 1
          ) {
            limit = Math.floor(limit / 2);
            continue;
          }
          throw problem;
        }
      }
    };
    void readPage()
      .catch((problem) => {
        if (controller.signal.aborted) return;
        setError(true);
        failed(problem);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session, cursor, attempt]);
  const agents = sharedAgents(events);
  const grid = useRef<HTMLDivElement>(null);
  // A selection made elsewhere, such as View on a published agent, scrolls to
  // its card once the card is here; one chosen in the grid is in view already.
  const shown = useRef<string>(undefined);
  const present = agents.some((agent) => agent.id === selectedId);
  useEffect(() => {
    if (!present || shown.current === selectedId) return;
    shown.current = selectedId;
    grid.current
      ?.querySelector<HTMLElement>("[data-selected]")
      ?.scrollIntoView({ block: "center" });
  }, [present, selectedId]);
  return (
    <div className="flex flex-col gap-section-gap">
      {loading && <p role="status">{t("agentsBrowse.loadingShared")}</p>}
      {error && (
        <div role="alert">
          <p>{t("agentsBrowse.loadSharedFailed")}</p>
          <Button onClick={() => setAttempt((value) => value + 1)}>
            {t("agentsBrowse.tryAgain")}
          </Button>
        </div>
      )}
      {!loading && !error && !agents.length && (
        <p>{t("agentsBrowse.noShared")}</p>
      )}
      <div ref={grid} className={cardStyles.grid}>
        {agents.map((agent) => (
          <SurfaceButton
            key={agent.id}
            className={`${cardStyles.card} ${cardStyles.agentCard}`}
            aria-label={agent.name}
            aria-current={selectedId === agent.id || undefined}
            data-selected={selectedId === agent.id || undefined}
            onClick={(event) => {
              shown.current = agent.id;
              onSelect({ agent, session, community }, event.currentTarget);
            }}
          >
            <SharedAgentCardContent agent={agent} community={community} />
          </SurfaceButton>
        ))}
      </div>
      {more && !error && (
        <Button
          disabled={loading}
          onClick={() => {
            const last = [...events]
              .sort(
                (a, b) =>
                  b.created_at - a.created_at || a.id.localeCompare(b.id),
              )
              .at(-1);
            if (last) setCursor({ until: last.created_at, before_id: last.id });
          }}
        >
          {t("agentsBrowse.loadMore")}
        </Button>
      )}
    </div>
  );
}

export function SharedAgentPanel({
  selection,
  ...importing
}: Importing & { selection: SharedAgentSelection }) {
  useLanguage();
  const { agent, session, community } = selection;
  const pack = agentAvatars.find((item) => item.url === agent.picture);
  const picture = useAvatarPreview(
    pack ? "" : (agent.picture ?? ""),
    community,
    "small",
  );
  const backdrop = pack?.preview ?? picture;
  return (
    <div className={pageStyles.detailsScroll}>
      <section
        className={`${hero.hero} ${hero.panelHero}`}
        aria-label={t("agentsBrowse.identityOf", { name: agent.name })}
      >
        <ProfileBackdrop src={backdrop} />
        <span className={pageStyles.identityPortrait}>
          <AgentPortrait agent={agent} community={community} />
        </span>
        <h2 className="m-0 text-heading text-center break-words">
          {agent.name}
        </h2>
        <div className={hero.actions}>
          <ImportShared
            key={agent.id}
            shared={agent}
            variant={backdrop ? "glass" : "subtle"}
            {...importing}
          />
        </div>
      </section>
      <section>
        <InlineHeader title={t("agentsBrowse.about")} />
        <SettingsGroup>
          <PreferenceRow
            title={t("agentsBrowse.sharedBy")}
            trailing={
              <Sharer
                pubkey={agent.owner}
                session={session}
                community={community}
              />
            }
          />
          <PreferenceRow
            title={t("agentsBrowse.model")}
            trailing={
              <span className={styles.fact}>
                <ModelIcon model={agent.model} />
                {agent.model || t("agentsBrowse.notGiven")}
              </span>
            }
          />
        </SettingsGroup>
      </section>
      <SharedAgentDetails agent={agent} />
    </div>
  );
}

function SharedAgentDetails({ agent }: { agent: SharedAgent }) {
  useLanguage();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long =
    agent.instructions.length > 320 ||
    agent.instructions.split("\n").length > 5;
  return (
    <div className={styles.details}>
      <InlineHeader title={t("agentsBrowse.instructions")} />
      <section
        id={id}
        className={styles.instructions}
        data-collapsed={long && !expanded ? "" : undefined}
        aria-label={t("agentsBrowse.instructions")}
      >
        {agent.instructions || t("agentsBrowse.noInstructions")}
      </section>
      {long && (
        <div className={styles.instructionsAction}>
          <Button
            variant="subtle"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? t("agentsBrowse.seeLess") : t("agentsBrowse.seeMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Who shared it, by their profile; the key itself is a hover away. */
function Sharer({
  pubkey,
  session,
  community,
}: {
  pubkey: string;
  session: RelaySession;
  community: string | undefined;
}) {
  const profiles = useSyncExternalStore(
    session.profiles.subscribe,
    session.profiles.snapshot,
    session.profiles.snapshot,
  );
  const profileGeneration = useProfileGeneration(session.profiles);
  useEffect(() => {
    void profileGeneration;
    void session.profiles.ensure([pubkey]).catch(() => {});
  }, [session, pubkey, profileGeneration]);
  const profile = profiles.get(pubkey);
  const picture = useAvatarPreview(profile?.picture ?? "", community, "small");
  const npub = canonicalPublicKey(pubkey) ?? pubkey;
  const name =
    profile && !profile.nameIsFallback
      ? profile.name
      : (formatPublicKey(pubkey) ?? pubkey);
  return (
    <Tooltip content={npub}>
      <span
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users need access to the key in the tooltip.
        tabIndex={0}
        className={styles.fact}
      >
        <Avatar src={picture} alt="" fallback={name} size="small" />
        <span className="truncate">{name}</span>
      </span>
    </Tooltip>
  );
}

/** The panel keeps one action; configuration belongs to the import dialog. */
function ImportShared({
  variant,
  ...props
}: Importing & { shared: SharedAgent; variant: "glass" | "subtle" }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={trigger}
        variant={variant}
        size="sm"
        shape="control"
        onClick={() => setOpen(true)}
      >
        {t("agentsBrowse.import")}
      </Button>
      {open && (
        <SharedImportDialog
          {...props}
          onClose={() => setOpen(false)}
          finalFocus={trigger}
        />
      )}
    </>
  );
}

/** Imports a shared definition as a new agent, from the marketplace or a file. */
/** A shared agent's card face, in the Marketplace and in conversations. */
export function SharedAgentCardContent({
  agent,
  community,
  detail,
}: {
  agent: Pick<SharedDefinition, "name" | "picture" | "model">;
  community: string | undefined;
  /** Said in place of the model, such as why the card isn't ready. */
  detail?: string | undefined;
}) {
  useLanguage();
  return (
    <>
      <AgentCardBackdrop agent={agent} community={community} />
      <span className={cardStyles.portrait} aria-hidden="true">
        <AgentPortrait agent={agent} community={community} />
      </span>
      <span className={cardStyles.identity}>
        <span className={`${cardStyles.name} text-label`}>{agent.name}</span>
        <span className={cardStyles.detail}>
          {!detail && <ModelIcon model={agent.model} />}
          <span className={cardStyles.detailText}>
            {detail ?? (agent.model || t("agentsBrowse.sharedAgent"))}
          </span>
        </span>
      </span>
    </>
  );
}

/** Whether importing `shared` would only copy `agent` again. */
function copies(
  shared: SharedDefinition,
  agent: Agent,
  type: RegisteredAgentType | undefined,
) {
  try {
    const own = shareable(agent, type);
    // Pictures are left out: a built-in avatar's address can differ.
    return (
      own.name === shared.name &&
      own.instructions === shared.instructions &&
      own.runtime === shared.runtime &&
      own.model === shared.model &&
      (own.provider ?? "") === (shared.provider ?? "")
    );
  } catch {
    return false;
  }
}

export function SharedImportDialog({
  shared,
  agents,
  types,
  onImported,
  onOpen,
  onClose,
  finalFocus,
}: Importing & {
  shared: SharedDefinition;
  onClose(): void;
  finalFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  useLanguage();
  const { snapshot, types: known } = useAgents(agents);
  const body = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => {
    for (const type of types) {
      const config = type.importShared?.(shared);
      if (config !== undefined) return { key: type.key, config };
    }
    return undefined;
  });
  const [type, setType] = useState(initial?.key ?? "");
  const [config, setConfig] = useState<unknown>(initial?.config);
  const [instructions, setInstructions] = useState(shared.instructions);
  const [pending, setPending] = useState(false);
  // Anything changed from what was shared; Undo brings it back.
  const edited =
    type !== (initial?.key ?? "") ||
    JSON.stringify(config) !== JSON.stringify(initial?.config) ||
    instructions !== shared.instructions;
  const undo = () => {
    // Undo goes with the edit; focus starts over at the first field.
    flushSync(() => {
      setType(initial?.key ?? "");
      setConfig(initial?.config);
      setInstructions(shared.instructions);
      setError("");
    });
    body.current?.querySelector<HTMLElement>("[role='combobox']")?.focus();
  };
  // An agent you already have, the same in everything this would copy.
  const existing = edited
    ? undefined
    : snapshot.agents.find((agent) =>
        copies(
          shared,
          agent,
          known.find((type) => type.key === agent.type),
        ),
      );
  const [error, setError] = useState("");
  // What block/buzz refuses, such as hidden characters in what is shown here.
  let refused = "";
  try {
    checkText(shared.name, instructions);
  } catch (reason) {
    refused = reason instanceof Error ? reason.message : String(reason);
  }
  const chosen = types.find((item) => item.key === type);
  const Model = chosen?.CreateModel;
  const choose = (key: string) => {
    const next = types.find((item) => item.key === key);
    setType(key);
    setConfig(next?.importShared?.(shared) ?? next?.defaults().config);
  };
  const run = async () => {
    if (!chosen || pending || refused) return;
    setPending(true);
    setError("");
    try {
      const { agent } = await agents.port({
        source: "shared",
        type: chosen.key,
        name: shared.name,
        ...(shared.picture ? { picture: shared.picture } : {}),
        instructions,
        ...(config !== undefined ? { config } : {}),
      });
      onImported(agent);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      title={shared.name}
      description={
        existing
          ? t("agentsBrowse.alreadyHave")
          : edited
            ? t("agentsBrowse.editedCopy")
            : t("agentsBrowse.editBeforeImport")
      }
      headerGap="compact"
      footerGap="compact"
      finalFocus={finalFocus}
      preventClose={pending}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      leadingActions={
        edited && (
          <Button variant="ghost" disabled={pending} onClick={undo}>
            {t("agentsBrowse.undo")}
          </Button>
        )
      }
      actions={
        <>
          {!(existing && onOpen) && (
            <Button disabled={pending} onClick={onClose}>
              {t("agentsBrowse.cancel")}
            </Button>
          )}
          <Button
            {...(existing && onOpen ? {} : { variant: "primary" as const })}
            disabled={!chosen || pending || !!refused}
            loading={pending}
            onClick={() => void run()}
          >
            {existing ? t("agentsBrowse.importCopy") : t("agentsBrowse.import")}
          </Button>
          {existing && onOpen && (
            <Button
              variant="primary"
              disabled={pending}
              onClick={() => onOpen(existing)}
            >
              {t("agentsBrowse.openName", { name: existing.name })}
            </Button>
          )}
        </>
      }
    >
      {/* Laid out as the agent's Identity tab will show it once imported. */}
      <div ref={body} className="grid gap-4">
        {types.length === 0 ? (
          <p className="m-0 text-body-sm text-secondary">
            {t("agentsBrowse.enableType")}
          </p>
        ) : (
          <SettingsGroup>
            <PreferenceRow
              title={t("agentsBrowse.harness")}
              trailing={
                <Select
                  label={t("agentsBrowse.harness")}
                  variant="compact"
                  align="end"
                  placeholder={t("agentsBrowse.choose")}
                  value={type}
                  disabled={pending}
                  groups={[
                    {
                      label: "",
                      options: types.map((item) => ({
                        value: item.key,
                        label: item.title,
                      })),
                    },
                  ]}
                  onValueChange={choose}
                />
              }
            />
            {Model && (
              <PreferenceRow
                title={t("agentsBrowse.model")}
                trailing={
                  <Model
                    key={type}
                    config={config}
                    disabled={pending}
                    onChange={setConfig}
                  />
                }
              />
            )}
          </SettingsGroup>
        )}
        <AgentInstructions
          value={instructions}
          disabled={pending}
          onChange={setInstructions}
        />
        {(refused || error) && (
          <p role="alert" className="m-0 text-body-sm text-danger">
            {refused || error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
