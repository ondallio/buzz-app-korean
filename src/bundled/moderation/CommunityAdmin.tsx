import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { t, useLanguage, formattingLocale } from "../../shared/i18n";
import {
  localMessage,
  localError,
  errorMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { communityFromScope } from "../../features/relay/gifs";
import {
  useProfileGeneration,
  useRelayConnection,
} from "../../features/relay/react";
import type { RelayData } from "../../features/relay/service";
import type { RelaySession } from "../../features/relay/session";
import {
  formatPublicKey,
  publicKeyLabels,
  typedPublicKey,
} from "../../shared/identity/public-key";
import {
  CaretDownIcon,
  CrownIcon,
  DotsThreeIcon,
  ShieldIcon,
  MinusIcon,
  UserIcon,
} from "../../shared/design-system/icons/index";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Input } from "../../shared/design-system/ui/Input";
import { InputGroup } from "../../shared/design-system/ui/InputGroup";
import {
  MenuItem,
  MenuIcon,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { Tabs } from "../../shared/design-system/ui/Tabs";
import { SearchField } from "../../shared/design-system/ui/SearchField";
import {
  allowedActions,
  changeMember,
  mintInvite,
  type Action,
  type Member,
  type MemberChange,
} from "./api";
import {
  createCommunityMembership,
  type CommunityMembership,
} from "./membership";
import { avatarMedia } from "../../shared/avatar-source";
import { writeClipboardText } from "../../shared/clipboard";
import { nativeIdentityEnabled } from "../../features/identity/service";
import {
  QrCode,
  type QrVariant,
  renderQrCode,
  useQrVariant,
} from "../../shared/QrCode";
import styles from "./CommunityAdmin.module.css";
import { DIRECT_MEMBER_ADD_ENABLED } from "./features";
import { canShareInvite, shareInvite } from "./shareInvite";

const DAY = 24 * 60 * 60;
const EXPIRY = [1, 3, 7, 30].map((days) => ({
  value: String(days * DAY),
  label: days === 1 ? "1 day" : `${days} days`,
}));
const USES = [
  { value: "", label: "No limit" },
  ...[1, 5, 10, 25].map((uses) => ({
    value: String(uses),
    label: uses === 1 ? "1 use" : `${uses} uses`,
  })),
];
const ROLE_LABELS = {
  owner: "communityAdmin.owner",
  admin: "communityAdmin.admin",
  member: "communityAdmin.member",
} as const;
const roleLabel = (role: Member["role"]) => t(ROLE_LABELS[role]);

const message = errorMessage;
const STALE = localMessage("communityAdmin.stale");

export type MembershipMethod = "members" | "invite" | "direct";
type MembershipSelection = {
  selectedMethod?: MembershipMethod | undefined;
  onMethodChange?: ((method: MembershipMethod) => void) | undefined;
};

export function CommunityAdmin({
  relay,
  membership: suppliedMembership,
  communityName,
  active,
  selectedMethod,
  onMethodChange,
}: MembershipSelection & {
  relay: RelayData;
  membership?: CommunityMembership;
  communityName?: string;
  active(): boolean;
}) {
  useLanguage();
  const [fallbackMembership] = useState(() =>
    suppliedMembership ? null : createCommunityMembership(relay),
  );
  const membership = suppliedMembership ?? fallbackMembership;
  useEffect(() => () => fallbackMembership?.dispose(), [fallbackMembership]);
  useEffect(() => membership?.ensure(), [membership]);
  const connection = useRelayConnection(relay);
  if (!membership) return null;
  const community =
    connection.status === "ready" && connection.scope
      ? communityFromScope(connection.scope)
      : null;
  return (
    <section aria-labelledby="community-admin-title">
      <h2 id="community-admin-title" className="mt-0 mb-2 text-label">
        {t("communityAdmin.membership")}
      </h2>
      <p className="mt-0 mb-6 text-body-sm text-muted">
        {communityName
          ? t("communityAdmin.manageNamed", { community: communityName })
          : t("communityAdmin.manage")}
      </p>
      {community && connection.viewer ? (
        <Members
          key={`${connection.scope}:${connection.generation}`}
          session={connection.session}
          community={community}
          viewer={connection.viewer}
          membership={membership}
          active={active}
          selectedMethod={selectedMethod}
          onMethodChange={onMethodChange}
        />
      ) : (
        <p role="status">{t("communityAdmin.chooseCommunity")}</p>
      )}
    </section>
  );
}

type Pending = { member: Member; action: Action };

function Members({
  session,
  community,
  viewer,
  membership,
  active,
  selectedMethod,
  onMethodChange,
}: MembershipSelection & {
  session: RelaySession;
  community: string;
  viewer: string;
  membership: CommunityMembership;
  active(): boolean;
}) {
  useLanguage();
  const membershipState = useSyncExternalStore(
    membership.subscribe,
    membership.snapshot,
  );
  const members = membershipState.members;
  const [error, setError] = useState<DisplayMessage>("");
  const readError = membershipState.error ?? "";
  const [notice, setNotice] = useState<DisplayMessage>("");
  const refreshing = membershipState.refreshing;
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const proceed = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (selectedMethod && selectedMethod !== "members" && !busy)
      setPending(null);
  }, [selectedMethod, busy]);
  const profiles = useSyncExternalStore(
    session.profiles.subscribe,
    session.profiles.snapshot,
  );
  const profileGeneration = useProfileGeneration(session.profiles);
  useEffect(() => {
    void profileGeneration;
    if (members)
      void session.profiles
        .ensure(members.map((member) => member.pubkey))
        .catch(() => {});
  }, [members, session, profileGeneration]);
  const refresh = membership.refresh;
  const role = membershipState.role;
  const stale = !!readError;
  // No new command may start from a roster that is stale or being re-read.
  const locked = stale || refreshing;
  const baseName = (pubkey: string) =>
    profiles.get(pubkey)?.name || formatPublicKey(pubkey) || pubkey;
  // Every target gets a key qualifier: self-declared names can look identical
  // without being equal strings, so privileged actions must name one identity.
  const qualifiers = publicKeyLabels((members ?? []).map((m) => m.pubkey));
  const name = (pubkey: string) => {
    const base = baseName(pubkey);
    const qualifier = qualifiers.get(pubkey);
    if (!qualifier) return base;
    return profiles.get(pubkey)?.name ? `${base} · ${qualifier}` : qualifier;
  };
  /** Sends one command. Rejects only when the write itself is not confirmed. */
  async function apply(change: MemberChange) {
    if (!active()) return;
    if (locked) {
      setError(STALE);
      throw localError("communityAdmin.stale");
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      try {
        await changeMember(community, change);
      } catch (reason) {
        setError(message(reason));
        throw reason;
      }
      setNotice(localMessage("communityAdmin.accepted"));
      // Stay busy until the shared roster reflects the write, so no stale row acts.
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  const refreshButton = readError ? (
    <Button
      loading={refreshing}
      disabled={refreshing || busy}
      onClick={() => void refresh()}
    >
      {t("communityAdmin.retry")}
    </Button>
  ) : null;
  const status = (
    <>
      {notice && (
        <p role="status" className="m-0 text-body-sm">
          {resolveMessage(notice)}
        </p>
      )}
      {readError && (
        <p role="alert" className="m-0 text-body-sm">
          {members
            ? t("communityAdmin.staleRead", { error: readError })
            : readError}
        </p>
      )}
    </>
  );
  if (membershipState.status === "idle" || membershipState.status === "loading")
    return <p role="status">{t("communityAdmin.loading")}</p>;
  if (members === null || (role !== "owner" && role !== "admin"))
    return (
      <div className="mt-4 flex flex-col items-start gap-3">
        {status}
        {!readError && (
          <p role="status" className="m-0">
            {members === null
              ? t("communityAdmin.noRoster")
              : t("communityAdmin.restricted")}
          </p>
        )}
        {refreshButton}
      </div>
    );
  const needle = query.trim().toLowerCase();
  const shown = members
    .filter(
      (m) =>
        !needle ||
        name(m.pubkey).toLowerCase().includes(needle) ||
        m.pubkey.includes(needle),
    )
    .sort(
      (a, b) =>
        ["owner", "admin", "member"].indexOf(a.role) -
          ["owner", "admin", "member"].indexOf(b.role) ||
        name(a.pubkey).localeCompare(name(b.pubkey)),
    );
  // Revalidate the captured intent against the current roster on every render.
  const target = pending
    ? members.find((m) => m.pubkey === pending.member.pubkey)
    : undefined;
  const confirmable =
    !!pending &&
    !!target &&
    !locked &&
    allowedActions(role, target, target.pubkey === viewer).includes(
      pending.action,
    );
  const verb = {
    promote: "communityAdmin.promote",
    demote: "communityAdmin.demote",
    remove: "communityAdmin.remove",
  } as const;
  return (
    <MembershipContent
      selectedMethod={selectedMethod}
      onMethodChange={onMethodChange}
      busy={busy || !!pending}
      community={community}
      members={members}
      owner={role === "owner"}
      stale={stale}
      refreshing={refreshing}
      active={active}
      retry={() => void refresh()}
      add={(pubkey, next) => apply({ action: "add", pubkey, role: next })}
    >
      {status}
      {error && (
        <p role="alert" className="text-body-sm">
          {resolveMessage(error)}
        </p>
      )}
      <div className="flex flex-col gap-4">
        <div className={styles.searchControls}>
          <div className="min-w-0 flex-1">
            <SearchField
              label={t("communityAdmin.search")}
              placeholder={t("communityAdmin.search")}
              clearLabel={t("communityAdmin.clearSearch")}
              value={query}
              onValueChange={setQuery}
            />
          </div>
          {refreshButton}
        </div>
        <div>
          <h3 className="m-0 pb-2 text-caption text-subtle">
            {t("communityAdmin.members")} ·{" "}
            {new Intl.NumberFormat(formattingLocale()).format(members.length)}
          </h3>
          <ul
            className={styles.members}
            aria-label={t("communityAdmin.members")}
          >
            {shown.map((member) => {
              // A stale list must not offer another destructive command.
              const actions = stale
                ? []
                : allowedActions(role, member, member.pubkey === viewer);
              const label = name(member.pubkey);
              const picture = profiles.get(member.pubkey)?.picture;
              return (
                <li key={member.pubkey} className={styles.member}>
                  <Avatar
                    src={avatarMedia(picture, session.media)}
                    alt=""
                    fallback={label}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 flex min-w-0 items-center gap-1.5 text-body-sm">
                      <span className="truncate">{label}</span>
                      {member.role === "owner" && (
                        <CrownIcon className="shrink-0 text-warning" />
                      )}
                      {member.role === "admin" && (
                        <ShieldIcon className="shrink-0 text-accent" />
                      )}
                    </p>
                  </div>
                  {actions.length > 0 && (
                    <div className={styles.memberAction}>
                      <MenuRoot>
                        <MenuTrigger
                          render={
                            <IconButton
                              aria-label={t("communityAdmin.actionsFor", {
                                name: label,
                              })}
                              icon={<DotsThreeIcon />}
                              disabled={busy || refreshing}
                            />
                          }
                        />
                        <MenuPopup align="end">
                          {actions.map((action) => (
                            <MenuItem
                              key={action}
                              onClick={() => setPending({ member, action })}
                            >
                              <MenuIcon>
                                {action === "promote" ? (
                                  <ShieldIcon size={14} />
                                ) : action === "demote" ? (
                                  <UserIcon size={14} />
                                ) : (
                                  <MinusIcon size={14} />
                                )}
                              </MenuIcon>
                              {t(verb[action])}
                            </MenuItem>
                          ))}
                        </MenuPopup>
                      </MenuRoot>
                    </div>
                  )}
                  <span className="shrink-0 text-caption text-subtle">
                    {member.pubkey === viewer
                      ? t("communityAdmin.selfRole", {
                          role: roleLabel(member.role),
                        })
                      : roleLabel(member.role)}
                  </span>
                </li>
              );
            })}
          </ul>
          {!shown.length && (
            <p role="status" className="text-body-sm text-muted">
              {t("communityAdmin.noMatch")}
            </p>
          )}
        </div>
      </div>
      {pending && (
        <AlertDialog
          title={t(`communityAdmin.confirm.${pending.action}`, {
            name: name(pending.member.pubkey),
          })}
          description={
            stale
              ? resolveMessage(STALE)
              : pending.action === "remove"
                ? t("communityAdmin.removeHelp")
                : pending.action === "promote"
                  ? t("communityAdmin.promoteHelp")
                  : t("communityAdmin.demoteHelp")
          }
          pending={busy}
          initialFocus={pending.action === "remove" ? undefined : proceed}
          onClose={() => setPending(null)}
          actions={
            <>
              <Button disabled={busy} onClick={() => setPending(null)}>
                {t("communityAdmin.cancel")}
              </Button>
              <Button
                ref={proceed}
                variant={
                  pending.action === "remove" ? "destructive" : "primary"
                }
                loading={busy}
                disabled={busy || !confirmable}
                onClick={() =>
                  void apply(
                    pending.action === "remove"
                      ? { action: "remove", pubkey: pending.member.pubkey }
                      : {
                          action: "role",
                          pubkey: pending.member.pubkey,
                          role:
                            pending.action === "promote" ? "admin" : "member",
                        },
                  )
                    .then(() => setPending(null))
                    .catch(() => setPending(null))
                }
              >
                {t(verb[pending.action])}
              </Button>
            </>
          }
        />
      )}
    </MembershipContent>
  );
}

function publicKey(input: string) {
  const key = typedPublicKey(input);
  if (key) return key;
  throw localError("communityAdmin.invalidPublicKey");
}

/** Label-left, value-right choice row control, as in the Buzz desktop dialog. */
function Choice({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange(value: string): void;
  disabled?: boolean;
}) {
  return (
    <MenuRoot>
      <MenuTrigger
        disabled={disabled}
        render={
          <Button variant="ghost" size="sm" aria-label={label}>
            {options.find((option) => option.value === value)?.label}
            <CaretDownIcon
              size={14}
              className="buzz-dropdown-chevron"
              aria-hidden="true"
            />
          </Button>
        }
      />
      <MenuPopup align="end">
        <MenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(String(next))}
        >
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value} closeOnClick>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </MenuRoot>
  );
}

const ROLES_OFFERED = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

function MembershipContent({
  children,
  busy,
  community,
  members,
  owner,
  stale,
  refreshing,
  active,
  retry,
  add,
  selectedMethod,
  onMethodChange,
}: MembershipSelection & {
  children: ReactNode;
  busy: boolean;
  community: string;
  members: readonly Member[];
  owner: boolean;
  stale: boolean;
  refreshing: boolean;
  active(): boolean;
  retry(): void;
  add(pubkey: string, role: "admin" | "member"): Promise<void>;
}) {
  useLanguage();
  const [localMethod, setMethod] = useState<MembershipMethod>("members");
  const requestedMethod = selectedMethod ?? localMethod;
  const method =
    !DIRECT_MEMBER_ADD_ENABLED && requestedMethod === "direct"
      ? "members"
      : requestedMethod;
  const open = method === "invite";
  const expiryOptions = EXPIRY.map((option) => ({
    ...option,
    label: t(
      Number(option.value) === DAY
        ? "communityAdmin.oneDay"
        : "communityAdmin.days",
      { days: Number(option.value) / DAY },
    ),
  }));
  const useOptions = USES.map((option) => ({
    ...option,
    label: option.value
      ? t(
          option.value === "1"
            ? "communityAdmin.oneUse"
            : "communityAdmin.uses",
          { uses: Number(option.value) },
        )
      : t("communityAdmin.unlimited"),
  }));
  const roleOptions = ROLES_OFFERED.map((option) => ({
    ...option,
    label: t(
      option.value === "admin"
        ? "communityAdmin.admin"
        : "communityAdmin.member",
    ),
  }));
  const [ttl, setTtl] = useState(String(3 * DAY));
  const [uses, setUses] = useState("");
  const [identity, setIdentity] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<DisplayMessage>("");
  const [notice, setNotice] = useState<DisplayMessage>("");
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  // The QR code drawn for one link, or no svg when it failed; it never shows
  // for another link.
  const [qr, setQr] = useState<{
    url: string;
    variant: QrVariant;
    svg?: string;
  } | null>(null);
  // One minted link per settings; a missing entry for these settings mints.
  const settings = `${ttl}:${uses}`;
  const [link, setLink] = useState<{
    settings: string;
    url?: string;
    failed?: boolean;
  } | null>(null);
  const minting = useRef(0);
  // StrictMode replays effects; never mint twice for the same settings.
  const requested = useRef("");
  const current = link?.settings === settings ? link : null;
  const locked = stale || refreshing;
  useEffect(() => {
    if (open) return;
    // A new visit needs a fresh link: the previous one may be exhausted.
    ++minting.current;
    requested.current = "";
    setLink(null);
    setQr(null);
    setCopied(false);
    setError("");
  }, [open]);
  useEffect(() => {
    // Visiting a sharing tab, or changing its settings, creates the link to share.
    if (!open || locked || current || requested.current === settings) return;
    if (!active()) return;
    requested.current = settings;
    const request = ++minting.current;
    setLink({ settings });
    setCopied(false);
    setError("");
    mintInvite(community, Number(ttl), uses ? Number(uses) : null).then(
      (invite) => {
        if (minting.current === request) setLink({ settings, url: invite.url });
      },
      (reason) => {
        if (minting.current !== request) return;
        requested.current = "";
        setLink({ settings, failed: true });
        setError(message(reason));
      },
    );
  }, [open, locked, current, active, community, settings, ttl, uses]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const url = current?.url;
  // New settings have no link until the effect mints one; count them as
  // pending so the code's place never collapses, which scrolled the dialog.
  const pending = current ? !url && !current.failed : !locked;
  const variant = useQrVariant();
  const drawn = url && qr?.url === url && qr.variant === variant ? qr : null;
  const showQr =
    nativeIdentityEnabled() && (pending || !!url) && !(drawn && !drawn.svg);
  useEffect(() => {
    if (!url || !nativeIdentityEnabled()) return;
    let live = true;
    renderQrCode(url, variant).then(
      (svg) => live && setQr({ url, variant, svg }),
      (reason) => {
        if (!live) return;
        setQr({ url, variant });
        setError(message(reason));
      },
    );
    return () => {
      live = false;
    };
  }, [url, variant]);
  let directKey: string | null = null;
  let identityError: DisplayMessage = "";
  if (identity.trim()) {
    try {
      directKey = publicKey(identity);
      if (members.some((member) => member.pubkey === directKey))
        identityError = localMessage("communityAdmin.alreadyMember");
    } catch (reason) {
      identityError = message(reason);
    }
  }
  async function addDirectly() {
    if (!directKey || identityError || !active() || locked || adding) return;
    setAdding(true);
    setError("");
    setNotice("");
    try {
      await add(directKey, owner ? role : "member");
      setIdentity("");
      setRole("member");
      setNotice(localMessage("communityAdmin.added"));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setAdding(false);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <div className={styles.tabs}>
        <Tabs
          value={method}
          onValueChange={onMethodChange ?? setMethod}
          label={t("u275e.admin.sections")}
          variant="panel"
          items={[
            {
              value: "members",
              label: t("communityAdmin.members"),
              panelId: "invite-members-panel",
              disabled: adding || busy,
            },
            {
              value: "invite",
              label: t("u275e.admin.invite"),
              panelId: "invite-share-panel",
              disabled: adding || busy,
            },
            ...(DIRECT_MEMBER_ADD_ENABLED
              ? [
                  {
                    value: "direct" as const,
                    label: t("communityAdmin.addDirectly"),
                    panelId: "invite-direct-panel",
                    disabled: adding || busy,
                  },
                ]
              : []),
          ]}
        />
      </div>
      {method === "members" && (
        <section
          role="tabpanel"
          id="invite-members-panel"
          aria-labelledby="invite-members-panel-tab"
        >
          {children}
        </section>
      )}
      {open && (
        <section
          className={styles.invitePanel}
          role="tabpanel"
          id="invite-share-panel"
          aria-labelledby="invite-share-panel-tab"
        >
          <div className={styles.inviteQr}>
            {showQr && (
              <div className="flex justify-center">
                {drawn?.svg ? (
                  <QrCode svg={drawn.svg} alt={t("u275e.admin.qrAlt")} />
                ) : (
                  // Holds the code's place while the link or its code is made.
                  <div
                    aria-hidden="true"
                    className="size-60 max-w-full shrink-0"
                  />
                )}
              </div>
            )}
            {showQr && drawn?.svg && canShareInvite() && (
              <div className={styles.qrShare}>
                <Button
                  size="sm"
                  variant="subtle"
                  disabled={!url || !drawn?.svg || locked}
                  loading={sharing}
                  onClick={async (event) => {
                    if (!url || sharing) return;
                    const anchor = event.currentTarget.getBoundingClientRect();
                    setSharing(true);
                    setError("");
                    try {
                      await shareInvite(url, anchor);
                    } catch {
                      setError(localMessage("u275e.admin.shareFailed"));
                    } finally {
                      setSharing(false);
                    }
                  }}
                >
                  {t("u275e.admin.share")}
                </Button>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <InputGroup
              trailing={
                <Button
                  size="sm"
                  loading={pending}
                  disabled={current?.failed ? locked : !url}
                  // Copying with a pointer should not move focus into the field.
                  // Keyboard activation keeps the shared visible-focus treatment.
                  onMouseDown={(event) => {
                    if (event.button === 0) event.preventDefault();
                  }}
                  onClick={() => {
                    if (current?.failed) {
                      setLink(null);
                      return;
                    }
                    if (!url) return;
                    writeClipboardText(url)
                      .then(() => {
                        setCopied(true);
                      })
                      .catch(() =>
                        setError(localMessage("communityAdmin.copyFailed")),
                      );
                  }}
                >
                  {current?.failed
                    ? t("communityAdmin.retry")
                    : copied
                      ? t("communityAdmin.copied")
                      : t("communityAdmin.copyLink")}
                </Button>
              }
            >
              <Input
                aria-label={t("communityAdmin.inviteLinkLabel")}
                readOnly
                value={url ?? ""}
                placeholder={
                  current?.failed
                    ? t("communityAdmin.createFailed")
                    : t("communityAdmin.creating")
                }
              />
            </InputGroup>
            <SettingsGroup>
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="text-body-sm">
                  {t("communityAdmin.expiresAfter")}
                </span>
                <Choice
                  label={t("communityAdmin.chooseExpiry")}
                  value={ttl}
                  options={expiryOptions}
                  onChange={setTtl}
                  // Stays usable while a link is made, so the closing menu can
                  // return focus to it; the newest choice's link wins.
                  disabled={locked}
                />
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="text-body-sm">{t("u275e.admin.maxUses")}</span>
                <Choice
                  label={t("communityAdmin.chooseMaxUses")}
                  value={uses}
                  options={useOptions}
                  onChange={setUses}
                  disabled={locked}
                />
              </div>
            </SettingsGroup>
          </div>
        </section>
      )}
      {DIRECT_MEMBER_ADD_ENABLED && method === "direct" && (
        <section
          role="tabpanel"
          id="invite-direct-panel"
          aria-labelledby="invite-direct-panel-tab"
        >
          <p className="mt-1 mb-3 text-body-sm text-muted">
            {t("communityAdmin.identityHelp")}
          </p>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void addDirectly();
            }}
          >
            <div className="min-w-0 flex-1">
              <InputGroup>
                <Input
                  aria-label={t("communityAdmin.publicIdentity")}
                  placeholder={t("communityAdmin.identityPlaceholder")}
                  value={identity}
                  onChange={(event) => setIdentity(event.currentTarget.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={adding}
                />
                {owner && (
                  <Choice
                    label={t("communityAdmin.chooseRole")}
                    value={role}
                    options={roleOptions}
                    onChange={(value) => setRole(value as "admin" | "member")}
                    disabled={adding}
                  />
                )}
              </InputGroup>
              {identityError && (
                <p role="alert" className="mt-2 mb-0 text-body-sm">
                  {resolveMessage(identityError)}
                </p>
              )}
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={adding}
              disabled={adding || locked || !directKey || !!identityError}
            >
              {t("communityAdmin.addMember")}
            </Button>
          </form>
        </section>
      )}
      <div className="flex flex-col gap-2 empty:hidden">
        {error && (
          <p role="alert" className="m-0 text-body-sm">
            {resolveMessage(error)}
          </p>
        )}
        {method !== "members" && stale && !adding && (
          <div className="flex items-center justify-between gap-3">
            <p role="alert" className="m-0 text-body-sm">
              {resolveMessage(STALE)}
            </p>
            <Button
              size="sm"
              loading={refreshing}
              disabled={refreshing}
              onClick={retry}
            >
              {t("communityAdmin.retry")}
            </Button>
          </div>
        )}
        {notice && (
          <p role="status" className="m-0 text-body-sm">
            {resolveMessage(notice)}
          </p>
        )}
      </div>
    </div>
  );
}
