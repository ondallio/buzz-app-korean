import { ManagementRow } from "../ManagementRow";
import { ManagementHeader } from "../BuilderlabSettings";
import type { OverviewObserver } from "../overview";
import { ManagementSection } from "../ManagementSection";
import communitiesHero from "../assets/communities-hero.png";
import { Tabs } from "../../../shared/design-system/ui/Tabs";
import { SearchField } from "../../../shared/design-system/ui/SearchField";
import { IconButton } from "../../../shared/design-system/ui/IconButton";
import { Tooltip } from "../../../shared/design-system/ui/Tooltip";
import {
  PopoverRoot,
  PopoverPopup,
} from "../../../shared/design-system/ui/Popover";
import {
  MenuRoot,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuIcon,
} from "../../../shared/design-system/ui/Menu";
import { SettingsGroup } from "../../../shared/design-system/ui/SettingsGroup";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { npubEncode } from "nostr-tools/nip19";
import { AlertDialog } from "../../../shared/design-system/ui/AlertDialog";
import { Button } from "../../../shared/design-system/ui/Button";
import { Checkbox } from "../../../shared/design-system/ui/Checkbox";
import { Dialog } from "../../../shared/design-system/ui/Dialog";
import { EmptyState } from "../../../shared/design-system/ui/EmptyState";
import { InlineHeader } from "../../../shared/design-system/ui/Header";
import { Field } from "../../../shared/design-system/ui/Field";
import { Input } from "../../../shared/design-system/ui/Input";
import {
  ArchiveIcon,
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  ArrowsLeftRightIcon,
  BoxArrowUpIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  GlobeIcon,
  DotsThreeIcon,
  SignOutIcon,
  TrashIcon,
  WarningCircleIcon,
} from "../../../shared/design-system/icons";
import {
  ApiFailure,
  boundKey,
  check,
  clearPendingDeletion,
  isDefinitiveDeletionRejection,
  makePendingDeletion,
  persistPendingDeletion,
  quota,
  quotaLimitMessage,
  readPendingDeletion,
  relayUrl,
  Unsupported,
  type Account,
  type Api,
  type Community,
  type Identity,
  type PendingDeletion,
  type Quota,
} from "./api";
import { writeClipboardText } from "../../../shared/clipboard";
import { CommunityAddressField, useCommunityAddress } from "./CommunityAddress";
import { t, useLanguage } from "../../../shared/i18n";

const card = "mt-6 rounded-xl border border-default p-5";
const sectionClassName = "mt-section-gap";
const refreshFailure = () => t("fubuilderlab.hc.refreshFailed");
const npub = (hex?: string | null) =>
  hex ? npubEncode(hex) : t("fubuilderlab.hc.unavailable");
const message = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);
type Confirm = {
  title: string;
  description: string;
  action: string;
  /** Both start on Cancel; permanent also shows the action in red. */
  caution?: "permanent" | "guarded";
  run(): Promise<void>;
};

export function HostedCommunities({
  api,
  active,
  join,
  sharedSignIn = false,
  onOverview,
  navigation,
  initialCreate = false,
  onCreateClose,
}: {
  api: Api;
  active(): boolean;
  /** Opens the app's join dialog on a community this account just created;
   * false when it cannot, and the address is handed off instead. */
  join?: ((address: string) => boolean) | undefined;
  /** The surrounding page owns sign-in, sign-out and the account row. */
  sharedSignIn?: boolean;
  onOverview?: OverviewObserver;
  navigation?: ReactNode;
  /** Picker entry opens the existing form once the account checks complete. */
  initialCreate?: boolean;
  /** Explicit dismissal or completion retires the caller's creation intent. */
  onCreateClose?: (() => void) | undefined;
}) {
  useLanguage();
  const activeRef = useRef(active);
  activeRef.current = active;
  const [auth, setAuth] = useState<Account | null>();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [identityLoadFailed, setIdentityLoadFailed] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [listTab, setListTab] = useState<"active" | "archived">("active");
  const [listQuery, setListQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(initialCreate);
  const needle = listQuery.trim().toLowerCase();
  const [quotaState, setQuotaState] = useState<Quota | null>(null);
  // This device's key: undefined while loading, null when it could not be read.
  const [local, setLocal] = useState<string | null>();
  const [unsupported, setUnsupported] = useState("");
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const proceed = useRef<HTMLButtonElement>(null);
  const [transfer, setTransfer] = useState<Community | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Community | null>(null);
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null);
  const [blockedOwner, setBlockedOwner] = useState<string | null>(null);
  const [deletionNotice, setDeletionNotice] = useState("");
  // The last address handed off for joining, and whether the clipboard took it.
  const [handoff, setHandoff] = useState<{
    url: string;
    copied: boolean;
  } | null>(null);
  const handoffOwner = useRef(0);
  const rowActions = useRef(new Map<string, HTMLElement>());
  const createTrigger = useRef<HTMLButtonElement>(null);
  const loginAbort = useRef<AbortController | null>(null);
  // Bumped by every operation and unmount; a read applies only if none happened since it began.
  const generation = useRef(0);
  const actionOwner = useRef(0);
  const acceptedDeletions = useRef(new Map<string, PendingDeletion>());
  const loadedOwner = useRef<string | null | undefined>(undefined);

  const load = useCallback(
    async (reconcileAccepted = false) => {
      const at = generation.current;
      const [current, list] = await Promise.all([
        api.call("identity"),
        api.call("list"),
      ]);
      if (at !== generation.current) return null;
      // A setup-needed mapping is the connect state. An upstream unauthorized
      // response may also be an expired session (browser-host/builderlab.mjs forwards it).
      if (
        current.error?.code === "unauthorized" ||
        list.error?.code === "unauthorized"
      ) {
        setIdentityLoadFailed(true);
        setIdentity(null);
        setCommunities([]);
        setQuotaState(null);
        setLoaded(false);
        setPendingDeletion(null);
        setBlockedOwner(null);
        setDeletionNotice("");
      }
      if (!current.error?.setup_needed)
        check(current, t("fubuilderlab.hc.loadIdentityFailed"));
      if (!list.error?.setup_needed)
        check(list, t("fubuilderlab.hc.loadCommunitiesFailed"));
      setIdentityLoadFailed(false);
      const nextIdentity = current.identity ?? null;
      const nextOwner = boundKey(nextIdentity);
      if (
        loadedOwner.current !== undefined &&
        loadedOwner.current !== nextOwner
      ) {
        acceptedDeletions.current.clear();
        setDeletionNotice("");
      }
      loadedOwner.current = nextOwner;
      const stored = readPendingDeletion();
      setBlockedOwner(
        stored &&
          (stored.owner_pubkey !== nextOwner ||
            stored.backend_origin !== api.origin())
          ? stored.owner_pubkey
          : null,
      );
      setPendingDeletion(
        stored?.owner_pubkey === nextOwner &&
          stored.backend_origin === api.origin()
          ? stored
          : null,
      );
      const listed = list.communities ?? [];
      if (
        reconcileAccepted &&
        nextOwner &&
        listed.some((community) =>
          acceptedDeletions.current.has(community.id ?? ""),
        )
      ) {
        const currentAuth = await api.getAuth().catch(() => null);
        if (at !== generation.current || !activeRef.current()) return null;
        if (currentAuth?.capabilities?.can_delete_buzz_communities === true)
          for (const community of listed) {
            if (at !== generation.current || !activeRef.current()) return null;
            const accepted = acceptedDeletions.current.get(community.id ?? "");
            if (!accepted || accepted.owner_pubkey !== nextOwner) continue;
            try {
              await api.admitDeletion(accepted.request, "recovery");
            } catch (reason) {
              if (
                at === generation.current &&
                activeRef.current() &&
                acceptedDeletions.current.get(accepted.request.community_id) ===
                  accepted
              ) {
                if (
                  reason instanceof ApiFailure &&
                  reason.code === "deletion_aborted"
                ) {
                  acceptedDeletions.current.delete(
                    accepted.request.community_id,
                  );
                  if (acceptedDeletions.current.size === 0)
                    setDeletionNotice("");
                  setError(
                    t("fubuilderlab.hc.deletionStopped", {
                      host: accepted.request.host,
                    }),
                  );
                } else setError(t("fubuilderlab.hc.deletionCheckFailed"));
              }
            }
            if (at !== generation.current || !activeRef.current()) return null;
          }
      }
      const nextCommunities = listed.filter(
        (community) =>
          !community.id || !acceptedDeletions.current.has(community.id),
      );
      const nextQuota = quota(list);
      setIdentity(nextIdentity);
      setCommunities(nextCommunities);
      setQuotaState(nextQuota);
      setLoaded(true);
      return { identity: nextIdentity, communities: nextCommunities };
    },
    [api],
  );

  const markDeletionAccepted = useCallback(
    (pending: PendingDeletion, at: number) => {
      if (at !== generation.current || !activeRef.current()) return false;
      clearPendingDeletion(pending);
      acceptedDeletions.current.set(pending.request.community_id, pending);
      setPendingDeletion(null);
      setCommunities((list) =>
        list.filter((item) => item.id !== pending.request.community_id),
      );
      setDeletionNotice(t("fubuilderlab.hc.deletionStarted"));
      setError("");
      return true;
    },
    [],
  );

  const localRead = useRef(0);
  const loadLocal = useCallback(() => {
    const at = ++localRead.current;
    setLocal(undefined);
    void api
      .localKey()
      .then((key) => at === localRead.current && setLocal(key));
  }, [api]);

  useEffect(() => {
    const at = ++generation.current;
    loadLocal();
    void api
      .getAuth()
      .then((next) => {
        if (at !== generation.current) return;
        setAuth(next);
        if (next)
          return load().catch(
            (reason) => at === generation.current && setError(message(reason)),
          );
      })
      .catch((reason) => {
        if (at !== generation.current) return;
        setAuth(null);
        if (reason instanceof Unsupported) setUnsupported(reason.message);
        else setError(message(reason));
      });
    return () => {
      generation.current++;
      loginAbort.current?.abort();
    };
  }, [api, load, loadLocal]);

  /** Runs one account operation at a time; resolves whether it succeeded. */
  async function run(label: string, operation: () => Promise<unknown>) {
    if (!activeRef.current()) return false;
    const at = ++generation.current;
    const owner = ++actionOwner.current;
    setAction(label);
    setError("");
    try {
      await operation();
      return true;
    } catch (reason) {
      if (at === generation.current) setError(message(reason));
      return false;
    } finally {
      if (owner === actionOwner.current) setAction(null);
    }
  }
  const copy = async (url: string) => {
    // A retired card must not start a clipboard write.
    if (!activeRef.current()) return;
    const at = handoffOwner.current;
    const copied = await Promise.resolve()
      .then(() => writeClipboardText(url))
      .then(
        () => true,
        () => false,
      );
    if (at === handoffOwner.current) setHandoff({ url, copied });
  };
  /** Refreshes after a confirmed write; a failed read must not present the write as failed. */
  const settle = () => {
    const at = generation.current;
    return load().catch(
      (reason) =>
        at === generation.current &&
        setError(
          `${refreshFailure()} ${message(reason)} ${t("fubuilderlab.hc.useRefresh")}`,
        ),
    );
  };
  const settleDeletion = async (
    pending: PendingDeletion,
    at: number,
    operation: () => Promise<unknown>,
  ) => {
    try {
      await operation();
      if (!markDeletionAccepted(pending, at)) return false;
      await settle();
      return true;
    } catch (reason) {
      if (at !== generation.current || !activeRef.current()) return false;
      if (
        (reason instanceof ApiFailure && reason.code === "deletion_aborted") ||
        isDefinitiveDeletionRejection(reason)
      ) {
        clearPendingDeletion(pending);
        setPendingDeletion(null);
        if (reason instanceof ApiFailure && reason.code === "deletion_aborted")
          await load().catch(() => undefined);
      } else setPendingDeletion(pending);
      throw reason;
    }
  };
  const checkPendingDeletion = (pending: PendingDeletion) =>
    run("delete", async () => {
      const at = generation.current;
      const snapshot = await load();
      if (at !== generation.current || !activeRef.current()) return;
      const currentAuth = await api.getAuth();
      if (at !== generation.current || !activeRef.current()) return;
      const stored = readPendingDeletion();
      if (
        !snapshot ||
        !stored ||
        JSON.stringify(stored) !== JSON.stringify(pending) ||
        stored.backend_origin !== api.origin() ||
        boundKey(snapshot.identity) !== pending.owner_pubkey
      )
        throw new Error(t("fubuilderlab.hc.deletionMismatch"));
      setAuth(currentAuth);
      if (currentAuth?.capabilities?.can_delete_buzz_communities !== true)
        throw new Error(t("fubuilderlab.hc.deletionUnavailableNow"));
      await settleDeletion(pending, at, () =>
        api.admitDeletion(pending.request, "recovery"),
      );
    });
  /** Retries a failed account check; the surrounding page keeps the shared session. */
  const retryAuth = () =>
    run("retry", async () => {
      const at = generation.current;
      const next = await api.getAuth();
      if (at !== generation.current || !activeRef.current()) return;
      setAuth(next);
      if (next) await load();
    });
  const busy = action !== null;
  const refreshAction = (
    <IconButton
      variant="ghost"
      size="sm"
      aria-label={t("inbox.refresh")}
      title={t("inbox.refresh")}
      icon={<ArrowsClockwiseIcon aria-hidden="true" />}
      loading={action === "refresh"}
      disabled={busy}
      onClick={() => void run("refresh", () => load(true))}
    />
  );
  const focusRead = useRef(false);
  const refreshOnFocus = useEffectEvent(() => {
    if (
      !activeRef.current() ||
      !auth ||
      busy ||
      focusRead.current ||
      createOpen ||
      confirm ||
      transfer ||
      deleteTarget
    )
      return;
    const at = generation.current;
    focusRead.current = true;
    void load()
      .then(
        (snapshot) => {
          if (snapshot && at === generation.current)
            setError((current) =>
              !loaded || current.startsWith(refreshFailure()) ? "" : current,
            );
        },
        (reason) => {
          if (
            at === generation.current &&
            (!loaded ||
              (reason instanceof ApiFailure && reason.code === "unauthorized"))
          )
            setError(message(reason));
        },
      )
      .finally(() => {
        focusRead.current = false;
      });
  });
  useEffect(() => {
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, []);
  // Repeated inside open dialogs, whose modal backdrop hides the page copy.
  const failure = error && (
    <p role="alert" className="error flex items-start gap-2 break-words">
      <WarningCircleIcon
        size={16}
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      />
      <span className="min-w-0 wrap-anywhere">{error}</span>
    </p>
  );
  const bound = boundKey(identity);
  // Without a usable bound key, the account cannot prove which identity it acts for.
  const mismatch =
    Boolean(identity) && (!bound || (Boolean(local) && bound !== local));
  // Acting requires this device's key to be known and to match the account's.
  const ready = bound !== null && bound === local;
  const connected = Boolean(auth) && ready && !identityLoadFailed;
  const connectedMark = connected ? (
    <Tooltip content={t("fubuilderlab.hc.connectedTooltip")}>
      <span
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users need the connection description too.
        tabIndex={0}
        role="img"
        aria-label={t("fubuilderlab.hc.identityConnected")}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-affordance-success"
      >
        <CheckIcon size={16} aria-hidden="true" color="var(--icon-success)" />
      </span>
    </Tooltip>
  ) : null;
  const deletionEnabled =
    auth?.capabilities?.can_delete_buzz_communities === true;
  // A handoff belongs to the bound identity: whenever it changes, by a local
  // action or a refresh, drop the handoff and any clipboard result in flight.
  // Layout effect, so a stale handoff is never painted beside the new identity.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bound is the trigger.
  useLayoutEffect(() => {
    handoffOwner.current++;
    setHandoff(null);
  }, [bound]);
  // Joining guidance is never offered for an address the card knows is archived,
  // including a clipboard result that lands after the archive.
  const shown =
    handoff &&
    !communities.some(
      (item) => item.archived_at && relayUrl(item) === handoff.url,
    )
      ? handoff
      : null;

  const bind = async () => {
    const reply = check(
      await api.call("bind"),
      t("fubuilderlab.hc.connectFailed"),
    );
    setIdentity(reply.identity ?? null);
    await settle();
  };

  useLayoutEffect(() => {
    if (!activeRef.current() || !onOverview) return;
    if (auth === undefined) return onOverview({ kind: "pending" });
    if (!auth)
      return onOverview({ kind: error || unsupported ? "failed" : "empty" });
    if (!loaded) return onOverview({ kind: error ? "failed" : "pending" });
    const own = (community: Community) =>
      community.owner_pubkey === bound ? 0 : 1;
    const created = (community: Community) =>
      Date.parse(community.created_at ?? "") || 0;
    const shown = communities
      .filter((community) => !community.archived_at)
      .sort((a, b) => own(a) - own(b) || created(b) - created(a));
    onOverview(
      shown.length
        ? {
            kind: "filled",
            items: shown.map((community, index) => ({
              key: community.id ?? String(index),
              label: community.name ?? t("fubuilderlab.hc.untitled"),
            })),
          }
        : { kind: "empty" },
    );
  }, [onOverview, auth, error, unsupported, loaded, communities, bound]);
  const mutate = async (
    kind: "archive" | "unarchive",
    community: Community,
    fallback: string,
  ) => {
    const reply = await api.call(kind, { community_id: community.id ?? "" });
    const archivedAt = reply.community?.archived_at;
    const done = kind === "archive" ? Boolean(archivedAt) : archivedAt === null;
    if (!done) check(reply, fallback);
    // Apply the confirmed state now, so a failed refresh cannot leave the row's old actions.
    if (done)
      setCommunities((list) =>
        list.map((item) =>
          item.id === community.id
            ? { ...item, archived_at: archivedAt ?? null }
            : item,
        ),
      );
    await settle();
  };

  const identityControls = auth ? (
    <>
      {!sharedSignIn && <InlineHeader title={t("fubuilderlab.hc.account")} />}
      <SettingsGroup layout="form">
        {!sharedSignIn && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-label">
                {auth.name ||
                  auth.email ||
                  t("fubuilderlab.hc.builderlabAccount")}
              </p>
              {auth.name && auth.email && (
                <p className="m-0 text-body-sm text-muted">{auth.email}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run("sign-out", async () => {
                  await api.signOut();
                  setPendingDeletion(null);
                  setAuth(null);
                  setIdentity(null);
                  setCommunities([]);
                  setQuotaState(null);
                  setLoaded(false);
                })
              }
            >
              <SignOutIcon aria-hidden="true" /> {t("settings.signOut")}
            </Button>
          </div>
        )}
        {!identity ? (
          identityLoadFailed ? null : (
            <div className="space-y-3">
              <InlineHeader
                title={t("fubuilderlab.hc.linkTitle")}
                subtitle={t("fubuilderlab.hc.linkSubtitle")}
              />
              <Button
                variant="primary"
                loading={action === "bind"}
                disabled={busy}
                onClick={() => void run("bind", bind)}
              >
                {t("fubuilderlab.hc.connectIdentity")}
              </Button>
            </div>
          )
        ) : local === undefined && bound ? (
          <p role="status" className="space-y-3">
            {t("fubuilderlab.hc.checkingLocal")}
          </p>
        ) : local === null && bound ? (
          <div className="space-y-3">
            <p role="alert" className="error m-0">
              {t("fubuilderlab.hc.localReadFailed")}
            </p>
            <div className="mt-3">
              <Button onClick={loadLocal}>{t("identity.failure.retry")}</Button>
            </div>
          </div>
        ) : mismatch ? (
          <section
            className="space-y-3"
            aria-label={t("fubuilderlab.hc.identityMismatch")}
          >
            <InlineHeader
              icon={<WarningCircleIcon size={16} aria-hidden="true" />}
              title={t("fubuilderlab.hc.mismatchTitle")}
            />
            <p className="text-body-sm text-muted">
              {t("fubuilderlab.hc.mismatchBody")}
            </p>
            <dl className="text-body-sm">
              <dt className="text-muted">{t("fubuilderlab.hc.accountUses")}</dt>
              <dd className="m-0 break-all font-mono">{npub(bound)}</dd>
              <dt className="mt-2 text-muted">
                {t("fubuilderlab.hc.thisDevice")}
              </dt>
              <dd className="m-0 break-all font-mono">{npub(local)}</dd>
            </dl>
            <Button
              variant="primary"
              disabled={busy || !local}
              onClick={() =>
                setConfirm({
                  title: t("fubuilderlab.hc.switchTitle"),
                  // kgoose revokes an unlinked key: binding it again answers 409.
                  // The client can't tell whether this device's key already was.
                  description: t("fubuilderlab.hc.switchDescription"),
                  action: t("fubuilderlab.hc.switchAction"),
                  caution: "permanent",
                  run: async () => {
                    check(
                      await api.call("unbind"),
                      t("fubuilderlab.hc.releaseFailed"),
                    );
                    setPendingDeletion(null);
                    // Unbound is a valid resting state; Connect recovers it.
                    setIdentity(null);
                    // The unlink is done: retire its confirmation so a
                    // failed bind is never retried by unlinking again.
                    setConfirm(null);
                    if (activeRef.current()) await bind();
                  },
                })
              }
            >
              {t("fubuilderlab.hc.switchButton")}
            </Button>
          </section>
        ) : sharedSignIn ? null : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 flex min-w-0 flex-wrap items-center gap-2 text-body-sm">
              <CheckCircleIcon size={16} aria-hidden="true" />
              {t("fubuilderlab.hc.identityConnected")}{" "}
              <span className="break-all font-mono text-muted">
                {npub(bound)}
              </span>
            </p>
          </div>
        )}
      </SettingsGroup>
    </>
  ) : null;

  return (
    <section
      aria-busy={busy}
      aria-labelledby="hosted-communities-title"
      onKeyDown={(event) => {
        // The hint leaves focus on its action, outside the popup's key handler.
        if (shown && event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.stopPropagation();
          setHandoff(null);
        }
      }}
    >
      <ManagementHeader
        navigation={navigation}
        id="hosted-communities-title"
        title={t("v1id.blab.communities")}
        align="end"
        actions={
          <Button
            ref={createTrigger}
            variant="prominent"
            aria-label={t("fubuilderlab.hc.createCommunity")}
            disabled={
              !auth || !ready || busy || quotaState?.canCreate === false
            }
            onClick={() => {
              if (activeRef.current()) setCreateOpen(true);
            }}
          >
            {t("fubuilderlab.hc.create")}
          </Button>
        }
      />
      <ManagementSection
        hero={communitiesHero}
        facts={[
          ...(connected
            ? []
            : [
                {
                  label: t("fubuilderlab.hc.buzzIdentity"),
                  value:
                    auth === undefined || (auth && local === undefined)
                      ? "…"
                      : error || mismatch || identityLoadFailed
                        ? t("v1id.needsAttention")
                        : ready
                          ? t("v1agent.external.connected")
                          : t("v1agent.manage.notConnected"),
                },
              ]),
        ]}
        aside={
          (!sharedSignIn || !ready || quotaState?.canCreate === false) && (
            <>
              {(!sharedSignIn || !ready) && identityControls}
              {quotaState?.canCreate === false && (
                <p className="text-body-sm text-subtle">
                  {quotaLimitMessage(quotaState.limit)}
                </p>
              )}
            </>
          )
        }
      >
        {auth && communities.length === 0 && (
          <div className="flex items-center justify-end gap-2">
            {refreshAction}
            {connectedMark}
          </div>
        )}
        {!createOpen && failure}
        {unsupported ? (
          <p className={`${sectionClassName} text-body-sm text-muted`}>
            {unsupported}
          </p>
        ) : auth === undefined ? (
          <p
            role="status"
            className="flex items-center gap-2 text-body-sm text-muted"
          >
            <CircleNotchIcon
              size={16}
              aria-hidden="true"
              className="motion-safe:animate-spin"
            />
            {t("fubuilderlab.hc.checkingSignIn")}
          </p>
        ) : !auth ? (
          sharedSignIn ? (
            <div className="mt-3">
              <Button
                loading={action === "retry"}
                disabled={busy}
                onClick={() => void retryAuth()}
              >
                {t("identity.failure.retry")}
              </Button>
            </div>
          ) : (
            <EmptyState
              icon={<GlobeIcon />}
              title={t("fubuilderlab.hc.signInTitle")}
              description={t("fubuilderlab.hc.signInDescription")}
              action={
                <>
                  <Button
                    variant="primary"
                    loading={action === "login"}
                    disabled={busy}
                    onClick={() =>
                      void run("login", async () => {
                        loginAbort.current = new AbortController();
                        const next = await api.login(loginAbort.current.signal);
                        setAuth(next);
                        await settle();
                      })
                    }
                  >
                    <ArrowSquareOutIcon size={18} aria-hidden="true" />{" "}
                    {t("fubuilderlab.hc.signInWithBuilderlab")}
                  </Button>
                  {action === "login" && (
                    <Button onClick={() => loginAbort.current?.abort()}>
                      {t("profileEditing.cancel")}
                    </Button>
                  )}
                </>
              }
            />
          )
        ) : (
          <>
            {deletionNotice && (
              <p role="status" className={`${card} text-body-sm`}>
                {deletionNotice}
              </p>
            )}
            {pendingDeletion && (
              <div className={card}>
                <p className="m-0 text-label">
                  {t("fubuilderlab.hc.deletionUnknownTitle")}
                </p>
                <p className="text-body-sm text-muted">
                  {t("fubuilderlab.hc.deletionUnknownBody")}
                </p>
                <p className="break-all font-mono text-body-sm">
                  {pendingDeletion.request.host}
                </p>
                <p className="text-body-sm text-muted">
                  {t("fubuilderlab.hc.contactSupport")}
                </p>
                <p className="select-all break-all font-mono text-body-sm">
                  {pendingDeletion.request.request_id}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    loading={action === "delete"}
                    disabled={busy || !deletionEnabled || !ready}
                    onClick={() => void checkPendingDeletion(pendingDeletion)}
                  >
                    {t("fubuilderlab.hc.checkDeletion")}
                  </Button>
                </div>
                {!deletionEnabled && (
                  <p className="text-body-sm text-muted">
                    {t("fubuilderlab.hc.deletionUnavailable")}
                  </p>
                )}
              </div>
            )}
            {deletionEnabled && blockedOwner && (
              <p role="status" className={`${card} text-body-sm`}>
                {blockedOwner === bound
                  ? t("fubuilderlab.hc.blockedSameOwner")
                  : t("fubuilderlab.hc.blockedOtherOwner", {
                      npub: npub(blockedOwner),
                    })}
              </p>
            )}
            {communities.length > 0 && (
              <div className="flex flex-col gap-3">
                <Tabs<"active" | "archived">
                  variant="capsule"
                  label={t("fubuilderlab.hc.communityStatus")}
                  trailingAction={
                    <div className="flex w-full min-w-0 items-center gap-2 self-end sm:w-auto">
                      {refreshAction}
                      {connectedMark}
                      <div className="min-w-0 flex-1 sm:w-60">
                        <SearchField
                          variant="capsule"
                          label={t("fubuilderlab.hc.searchCommunities")}
                          placeholder={t("search.search")}
                          value={listQuery}
                          onValueChange={(value) => {
                            if (active()) setListQuery(value);
                          }}
                        />
                      </div>
                    </div>
                  }
                  items={[
                    { value: "active", label: t("fubuilderlab.hc.active") },
                    {
                      value: "archived",
                      label: t("fubuilderlab.hc.archived"),
                    },
                  ]}
                  value={listTab}
                  onValueChange={(value) => {
                    if (active()) setListTab(value);
                  }}
                  renderPanel={(panel) => {
                    const rows = communities.filter(
                      (community) =>
                        Boolean(community.archived_at) ===
                          (panel === "archived") &&
                        (!needle ||
                          [
                            community.name,
                            community.slug,
                            community.normalized_host,
                          ].some((value) =>
                            value?.toLowerCase().includes(needle),
                          )),
                    );
                    return (
                      <>
                        {rows.length === 0 && (
                          <p className="py-12 text-center text-body-sm text-secondary">
                            {needle
                              ? t("fubuilderlab.hc.noMatches")
                              : panel === "archived"
                                ? t("fubuilderlab.hc.noArchived")
                                : t("fubuilderlab.hc.noActive")}
                          </p>
                        )}
                        <ul
                          className="m-0 list-none p-0"
                          aria-label={
                            panel === "active"
                              ? t("fubuilderlab.hc.activeList")
                              : t("fubuilderlab.hc.archivedList")
                          }
                        >
                          {rows.map((community, index) => {
                            const name =
                              community.name ??
                              community.slug ??
                              t("fubuilderlab.hc.hostedCommunity");
                            const url = relayUrl(community);
                            const archived = Boolean(community.archived_at);
                            const deletionPending =
                              pendingDeletion?.request.community_id ===
                              community.id;
                            return (
                              <li
                                key={
                                  community.id ??
                                  community.normalized_host ??
                                  index
                                }
                              >
                                <ManagementRow
                                  icon={<GlobeIcon size={20} />}
                                  title={name}
                                  detail={url ?? undefined}
                                  status={
                                    archived
                                      ? t("fubuilderlab.hc.archived")
                                      : undefined
                                  }
                                  actions={
                                    <>
                                      <MenuRoot>
                                        <MenuTrigger
                                          render={
                                            <IconButton
                                              ref={(button) => {
                                                if (!url) return;
                                                if (button)
                                                  rowActions.current.set(
                                                    url,
                                                    button,
                                                  );
                                                else
                                                  rowActions.current.delete(
                                                    url,
                                                  );
                                              }}
                                              variant="bare"
                                              size="sm"
                                              shape="row-end"
                                              aria-label={t(
                                                "fubuilderlab.moreActions",
                                                {
                                                  name,
                                                },
                                              )}
                                              icon={<DotsThreeIcon size={18} />}
                                            />
                                          }
                                        />
                                        <MenuPopup
                                          align="end"
                                          aria-label={t(
                                            "fubuilderlab.moreActions",
                                            {
                                              name,
                                            },
                                          )}
                                        >
                                          {!archived && url && ready && (
                                            <MenuItem
                                              disabled={busy}
                                              onClick={() => void copy(url)}
                                            >
                                              {t("fubuilderlab.hc.copyAddress")}
                                            </MenuItem>
                                          )}
                                          {archived ? (
                                            <>
                                              <MenuItem
                                                disabled={
                                                  busy ||
                                                  !community.id ||
                                                  deletionPending
                                                }
                                                onClick={() =>
                                                  setConfirm({
                                                    title: t(
                                                      "fubuilderlab.hc.unarchiveTitle",
                                                      { name },
                                                    ),
                                                    description: t(
                                                      "fubuilderlab.hc.unarchiveDescription",
                                                    ),
                                                    action: t(
                                                      "fubuilderlab.hc.unarchive",
                                                    ),
                                                    run: () =>
                                                      mutate(
                                                        "unarchive",
                                                        community,
                                                        t(
                                                          "fubuilderlab.hc.unarchiveFailed",
                                                        ),
                                                      ),
                                                  })
                                                }
                                              >
                                                <MenuIcon>
                                                  <BoxArrowUpIcon
                                                    size={16}
                                                    aria-hidden="true"
                                                  />
                                                </MenuIcon>{" "}
                                                {t("fubuilderlab.hc.unarchive")}
                                              </MenuItem>
                                              {deletionEnabled &&
                                                ready &&
                                                community.id &&
                                                community.normalized_host && (
                                                  <MenuItem
                                                    tone="danger"
                                                    disabled={
                                                      busy ||
                                                      Boolean(
                                                        pendingDeletion,
                                                      ) ||
                                                      Boolean(blockedOwner)
                                                    }
                                                    onClick={() =>
                                                      setDeleteTarget(community)
                                                    }
                                                  >
                                                    <MenuIcon>
                                                      <TrashIcon
                                                        size={16}
                                                        aria-hidden="true"
                                                      />
                                                    </MenuIcon>{" "}
                                                    {t(
                                                      "fubuilderlab.hc.delete",
                                                    )}
                                                  </MenuItem>
                                                )}
                                            </>
                                          ) : (
                                            <>
                                              <MenuItem
                                                disabled={busy || !community.id}
                                                onClick={() =>
                                                  setTransfer(community)
                                                }
                                              >
                                                <MenuIcon>
                                                  <ArrowsLeftRightIcon
                                                    size={16}
                                                    aria-hidden="true"
                                                  />
                                                </MenuIcon>{" "}
                                                {t("v105ch.members.transfer")}
                                              </MenuItem>
                                              <MenuItem
                                                disabled={busy || !community.id}
                                                onClick={() =>
                                                  setConfirm({
                                                    title: t(
                                                      "fubuilderlab.hc.archiveTitle",
                                                      { name },
                                                    ),
                                                    description: t(
                                                      "fubuilderlab.hc.archiveDescription",
                                                    ),
                                                    action: t(
                                                      "fubuilderlab.hc.archive",
                                                    ),
                                                    caution: "guarded",
                                                    run: () =>
                                                      mutate(
                                                        "archive",
                                                        community,
                                                        t(
                                                          "fubuilderlab.hc.archiveFailed",
                                                        ),
                                                      ),
                                                  })
                                                }
                                              >
                                                <MenuIcon>
                                                  <ArchiveIcon
                                                    size={16}
                                                    aria-hidden="true"
                                                  />
                                                </MenuIcon>{" "}
                                                {t("fubuilderlab.hc.archive")}
                                              </MenuItem>
                                            </>
                                          )}
                                        </MenuPopup>
                                      </MenuRoot>
                                    </>
                                  }
                                />
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    );
                  }}
                />
              </div>
            )}
            <PopoverRoot
              open={Boolean(shown)}
              onOpenChange={(open) => !open && setHandoff(null)}
            >
              <PopoverPopup
                side="top"
                align="end"
                size="compact"
                anchor={() =>
                  (shown && rowActions.current.get(shown.url)) ||
                  createTrigger.current
                }
                initialFocus={false}
                finalFocus={false}
                aria-label={t("v1id.blab.communityAddress")}
              >
                {shown?.copied && (
                  <p role="status" className="m-0 text-body-sm text-muted">
                    {t("fubuilderlab.hc.addressCopied")}
                  </p>
                )}
                {shown && !shown.copied && (
                  <div role="alert" className="text-body-sm">
                    <p className="m-0">{t("fubuilderlab.hc.copyFailed")}</p>
                    <p className="m-0 select-all break-all font-mono">
                      {shown.url}
                    </p>
                    <div className="mt-2">
                      <Button
                        disabled={busy || !ready}
                        onClick={() => void copy(shown.url)}
                      >
                        {t("fubuilderlab.hc.copyAgain")}
                      </Button>
                    </div>
                  </div>
                )}
              </PopoverPopup>
            </PopoverRoot>
            <CreateCommunity
              open={createOpen}
              close={() => {
                setCreateOpen(false);
                onCreateClose?.();
              }}
              quotaLabel={
                quotaState
                  ? t("fubuilderlab.hc.quotaUsed", {
                      used: quotaState.used,
                      limit: quotaState.limit,
                    })
                  : null
              }
              failure={failure}
              api={api}
              enabled={ready && quotaState?.canCreate !== false}
              atLimit={
                quotaState?.canCreate === false
                  ? quotaLimitMessage(quotaState.limit)
                  : null
              }
              busy={busy}
              creating={action === "create"}
              onCreate={(name) =>
                run("create", async () => {
                  // `run` has just started this operation's generation.
                  const at = generation.current;
                  const reply = check(
                    await api.call("create", { name }),
                    t("fubuilderlab.hc.createFailed"),
                    quotaState?.limit,
                  );
                  // Join or hand off the address before refreshing, so a failed
                  // refresh cannot lose it. The join dialog connects at once, as
                  // first run's Create community does. Like the clipboard, a
                  // retired or replaced card (another account) opens nothing.
                  const url = reply.community && relayUrl(reply.community);
                  if (
                    url &&
                    !(
                      join &&
                      activeRef.current() &&
                      at === generation.current &&
                      join(url)
                    )
                  )
                    await copy(url);
                  await settle();
                })
              }
            />
          </>
        )}
      </ManagementSection>
      {deleteTarget && bound && (
        <DeleteCommunityDialog
          community={deleteTarget}
          pending={action === "delete"}
          failure={failure}
          close={() => setDeleteTarget(null)}
          onDelete={() => {
            const occupied = readPendingDeletion();
            if (blockedOwner && !occupied) {
              setBlockedOwner(null);
              setError(t("fubuilderlab.hc.tryAgainError"));
              return;
            }
            if (blockedOwner || occupied) {
              if (
                occupied?.owner_pubkey === bound &&
                occupied.backend_origin === api.origin()
              ) {
                setPendingDeletion(occupied);
                setError(t("fubuilderlab.hc.notSentPending"));
              } else if (occupied) {
                setBlockedOwner(occupied.owner_pubkey);
                setError(
                  occupied.owner_pubkey === bound
                    ? t("fubuilderlab.hc.notSentOtherAddress")
                    : t("fubuilderlab.hc.notSentOtherOwner", {
                        npub: npub(occupied.owner_pubkey),
                      }),
                );
              }
              return;
            }
            let pending: PendingDeletion;
            try {
              pending = makePendingDeletion(bound, deleteTarget, api.origin());
              persistPendingDeletion(pending);
            } catch {
              const stored = readPendingDeletion();
              if (
                stored?.owner_pubkey === bound &&
                stored.backend_origin === api.origin()
              )
                setPendingDeletion(stored);
              setError(t("fubuilderlab.hc.notSentRecovery"));
              return;
            }
            setPendingDeletion(pending);
            setDeleteTarget(null);
            void run("delete", async () => {
              const at = generation.current;
              await settleDeletion(pending, at, () =>
                api.admitDeletion(pending.request, "fresh"),
              );
            });
          }}
        />
      )}
      {confirm && (
        <AlertDialog
          title={confirm.title}
          description={confirm.description}
          pending={busy}
          initialFocus={confirm.caution ? cancel : proceed}
          onClose={() => setConfirm(null)}
          {...(failure ? { children: failure } : {})}
          actions={
            <>
              <Button
                ref={cancel}
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                {t("profileEditing.cancel")}
              </Button>
              <Button
                ref={proceed}
                variant={
                  confirm.caution === "permanent" ? "destructive" : "prominent"
                }
                loading={busy}
                onClick={() =>
                  void run("confirm", confirm.run).then(
                    (ok) => ok && setConfirm(null),
                  )
                }
              >
                {confirm.action}
              </Button>
            </>
          }
        />
      )}
      {transfer && (
        <TransferDialog
          name={
            transfer.name ?? transfer.slug ?? t("fubuilderlab.hc.thisCommunity")
          }
          busy={busy}
          failure={failure}
          close={() => setTransfer(null)}
          onTransfer={(recipient) =>
            run("transfer", async () => {
              const reply = await api.call("transfer", {
                communityId: transfer.id ?? "",
                transfereeNpub: recipient,
              });
              if (reply.error?.code === "limit_reached")
                throw new ApiFailure(
                  "limit_reached",
                  t("fubuilderlab.hc.recipientLimit"),
                  reply.correlation_id,
                );
              check(reply, t("fubuilderlab.hc.transferFailed"));
              // The community is no longer owned; drop it before refreshing.
              setCommunities((list) =>
                list.filter((item) => item.id !== transfer.id),
              );
              await settle();
            }).then((ok) => ok && setTransfer(null))
          }
        />
      )}
    </section>
  );
}

function DeleteCommunityDialog({
  community,
  pending,
  failure,
  close,
  onDelete,
}: {
  community: Community;
  pending: boolean;
  failure: ReactNode;
  close(): void;
  onDelete(): void;
}) {
  useLanguage();
  const hostInput = useRef<HTMLInputElement>(null);
  const [host, setHost] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const expected = community.normalized_host ?? "";
  const name =
    community.name ?? community.slug ?? t("fubuilderlab.hc.thisCommunity");
  const confirmed = host === expected && acknowledged;
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      size="compact"
      initialFocus={hostInput}
      title={t("fubuilderlab.hc.deleteTitle", { name })}
      description={t("fubuilderlab.hc.deleteDescription")}
      preventClose={pending}
      actions={
        <>
          <Button disabled={pending} onClick={close}>
            {t("profileEditing.cancel")}
          </Button>
          <Button
            variant="prominent"
            loading={pending}
            disabled={!confirmed || pending}
            onClick={onDelete}
          >
            {t("fubuilderlab.hc.startDeletion")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-body-sm">
        <p className="m-0">{t("fubuilderlab.hc.deleteBody")}</p>
        <Field label={t("fubuilderlab.hc.typeHost")}>
          <Input
            ref={hostInput}
            autoComplete="off"
            spellCheck={false}
            value={host}
            onValueChange={setHost}
          />
        </Field>
        <p className="m-0 break-all font-mono">{expected}</p>
        <Checkbox
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
          label={t("fubuilderlab.hc.deleteAcknowledge")}
        />
        {failure}
      </div>
    </Dialog>
  );
}

function CreateCommunity({
  open,
  close,
  quotaLabel,
  failure,
  api,
  enabled,
  atLimit,
  busy,
  creating,
  onCreate,
}: {
  open: boolean;
  close(): void;
  quotaLabel: string | null;
  failure: ReactNode;
  api: Api;
  enabled: boolean;
  atLimit: string | null;
  busy: boolean;
  creating: boolean;
  onCreate(name: string): Promise<boolean>;
}) {
  useLanguage();
  const formId = useId();
  const addressInput = useRef<HTMLInputElement>(null);
  const deferredFocus = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) deferredFocus.current = null;
    else if (enabled && !busy) {
      // Only finish the opening focus attempt if the user has not moved it.
      if (
        deferredFocus.current &&
        deferredFocus.current === document.activeElement
      )
        addressInput.current?.focus();
      deferredFocus.current = null;
    }
  }, [open, enabled, busy]);
  const availability = useCallback(
    async (name: string) =>
      Boolean(
        check(
          await api.call("availability", { name }),
          t("fubuilderlab.hc.checkAddressFailed"),
        ).available,
      ),
    [api],
  );
  const address = useCommunityAddress(availability, enabled);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !creating) {
          address.setName("");
          close();
        }
      }}
      size="default"
      footerGap="compact"
      initialFocus={() => {
        const input = addressInput.current;
        deferredFocus.current = input?.disabled ? document.activeElement : null;
        return input ?? false;
      }}
      preventClose={creating}
      title={t("fubuilderlab.hc.createCommunity")}
      description={t("fubuilderlab.hc.createDescription")}
      leadingActions={
        quotaLabel && (
          <p className="m-0 text-body-sm text-muted">{quotaLabel}</p>
        )
      }
      actions={
        <>
          <Button
            variant="subtle"
            disabled={creating}
            onClick={() => {
              address.setName("");
              close();
            }}
          >
            {t("profileEditing.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="prominent"
            aria-label={t("fubuilderlab.hc.createCommunity")}
            loading={creating}
            disabled={!address.ready || busy}
          >
            {t("fubuilderlab.hc.create")}
          </Button>
        </>
      }
    >
      {failure}
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (address.ready)
            void onCreate(address.name).then((ok) => {
              if (ok) {
                address.setName("");
                close();
              }
            });
        }}
      >
        {atLimit && <p className="m-0 text-body-sm text-muted">{atLimit}</p>}
        <CommunityAddressField
          address={address}
          busy={busy}
          inputRef={addressInput}
        />
      </form>
    </Dialog>
  );
}

function TransferDialog({
  name,
  busy,
  failure,
  close,
  onTransfer,
}: {
  name: string;
  busy: boolean;
  failure: ReactNode;
  close(): void;
  onTransfer(npub: string): void;
}) {
  useLanguage();
  const recipientInput = useRef<HTMLInputElement>(null);
  const [recipient, setRecipient] = useState("");
  const valid = /^npub1[02-9ac-hj-np-z]{58}$/.test(recipient);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      preventClose={busy}
      initialFocus={recipientInput}
      title={t("v105ch.members.transfer")}
      description={t("fubuilderlab.hc.transferDescription", { name })}
      actions={
        <>
          <Button disabled={busy} onClick={close}>
            {t("profileEditing.cancel")}
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            disabled={!valid}
            onClick={() => onTransfer(recipient)}
          >
            {t("v105ch.members.transfer")}
          </Button>
        </>
      }
    >
      <Field
        label={t("fubuilderlab.hc.recipientNpub")}
        invalid={Boolean(recipient) && !valid}
        error={
          recipient && !valid ? t("fubuilderlab.hc.invalidNpub") : undefined
        }
      >
        <Input
          ref={recipientInput}
          autoComplete="off"
          spellCheck={false}
          placeholder="npub1…"
          value={recipient}
          onValueChange={(value) => setRecipient(value.trim())}
        />
      </Field>
      {failure}
    </Dialog>
  );
}
