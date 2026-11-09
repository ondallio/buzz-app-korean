import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../shared/i18n/deferred-message";
import { t, useLanguage, formattingLocale } from "../shared/i18n";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { npubEncode } from "nostr-tools/nip19";
import type { BackupStatus } from "../features/identity/backup";
import { BackupPrompt } from "../features/identity/BackupConsent";
import {
  backupOfferedFor,
  federatedBuilderlabAccount,
} from "../features/identity/builderlab-account";
import type { Identity } from "../features/identity/service";
import {
  signInServers,
  type FederatedIdentity,
  type SessionSnapshot,
} from "../features/federated-identity/service";
import type { Membership } from "../features/communities/service";
import {
  coveredCommunities,
  serverName,
} from "../features/federated-identity/community-servers";

import { PrivateKey } from "../features/identity/PrivateKey";
import { SignOutDialog } from "../features/identity/SignOut";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { IconButton } from "../shared/design-system/ui/IconButton";
import { Button } from "../shared/design-system/ui/Button";

import { CHANNEL_ACTIVITY_KINDS } from "../features/relay/channel-activity";
import type { RelaySession } from "../features/relay/session";
import { Tooltip } from "../shared/design-system/ui/Tooltip";
import { ToastNotice } from "../shared/design-system/ui/Toast";
import { CopyIcon } from "../shared/design-system/icons";
import styles from "./IdentitySettings.module.css";
import { writeClipboardText } from "../shared/clipboard";

const backupMessages = {
  busy: "settings.backup.busy",
  signed_out: "settings.backup.signed_out",
  not_offered: "settings.backup.not_offered",
  other_key_linked: "settings.backup.other_key_linked",
  invalid_service: "settings.backup.invalid_service",
  refused: "settings.backup.refused",
  unreachable: "settings.backup.unreachable",
  unconfirmed: "settings.backup.unconfirmed",
  storage: "settings.backup.storage",
} as const satisfies Record<
  Extract<BackupStatus, { status: "failed" }>["kind"],
  string
>;

/** Resolves only structured backup outcomes, never arbitrary service text. */
function backupFeedback(status: BackupStatus) {
  switch (status.status) {
    case "idle":
      return t("settings.backupUnchecked");
    case "running":
    case "complete":
      return undefined;
    case "waiting":
      return status.reason === "no_consent"
        ? undefined
        : status.reason === "no_session"
          ? t("settings.backupSignIn")
          : t("settings.backup.not_linked");
    case "failed":
      return t(backupMessages[status.kind]);
  }
}

function signInRecovery(code: string) {
  if (code === "sign-in-timed-out") return t("settings.recoveryTimeout");
  if (code === "storage-busy") return t("settings.recoveryBusy");
  if (code.startsWith("storage-")) return t("settings.recoveryStorage");
  if (code === "sign-in-canceled") return t("settings.recoveryCanceled");
  if (code === "reauthentication-required")
    return t("settings.recoveryExpired");
  return t("settings.recoveryOther");
}

function activityTimestamp(seconds: number) {
  const age = Math.max(0, Date.now() / 1000 - seconds);
  if (age < 60) return t("settings.justNow");
  if (age < 3600) {
    const count = Math.floor(age / 60);
    return t(count === 1 ? "settings.minuteAgo" : "settings.minutesAgo", {
      count,
    });
  }
  if (age < 86400) {
    const count = Math.floor(age / 3600);
    return t(count === 1 ? "settings.hourAgo" : "settings.hoursAgo", { count });
  }
  if (age < 604800) {
    const count = Math.floor(age / 86400);
    return t(count === 1 ? "settings.dayAgo" : "settings.daysAgo", { count });
  }
  return t("settings.onDate", {
    date: new Date(seconds * 1000).toLocaleDateString(formattingLocale(), {
      month: "short",
      day: "numeric",
    }),
  });
}

/**
 * What sync is for, and the uploader's status. While it waits for consent
 * (signed in to Builderlab, backup off or not yet chosen), Sync with
 * Builderlab opens the backup prompt, so a declined prompt can be reversed;
 * the prompt closes if the wait settles otherwise. Synced shows only once an
 * upload is confirmed. Hidden wherever first run would not offer backup, by
 * the same rule.
 */
function BackupRow({
  identity,
  viewer,
}: {
  identity: Identity;
  viewer: string;
}) {
  useLanguage();
  const { backup } = identity;
  const status = useSyncExternalStore(backup.subscribe, backup.snapshot);
  const [offered, setOffered] = useState(false);
  const [asking, setAsking] = useState(false);
  const action = useRef<HTMLButtonElement>(null);
  const sentence = useRef<HTMLSpanElement>(null);
  const backedUp = useRef(false);
  useEffect(() => {
    void backupOfferedFor(backup).then(setOffered);
  }, [backup]);
  const close = useCallback((saved?: boolean) => {
    backedUp.current = saved === true;
    setAsking(false);
  }, []);
  if (!offered || !status) return null;
  const waiting = status.status === "waiting" && status.reason === "no_consent";
  // Every pass runs before it is admitted, so only a settled outcome ends the wait.
  const settled =
    status.status !== "running" && status.status !== "idle" && !waiting;
  const feedback = backupFeedback(status);
  const indicator =
    status.status === "running" || status.status === "complete"
      ? t(status.status === "running" ? "settings.syncing" : "settings.synced")
      : undefined;
  return (
    <>
      <PreferenceRow
        title={t("settings.identitySync")}
        subtitle={
          <span ref={sentence} tabIndex={-1}>
            {t("settings.identitySyncDescription")}
            {/* Mounted empty so a later sentence is announced. */}
            <span role="status" className="block">
              {feedback}
            </span>
          </span>
        }
        trailing={
          <>
            {waiting && (
              <Button
                ref={action}
                type="button"
                onClick={() => setAsking(true)}
              >
                {t("settings.syncBuilderlab")}
              </Button>
            )}
            {/* Mounted empty so a later indicator is announced. */}
            <span role="status" className="text-body-sm text-subtle">
              {indicator}
            </span>
          </>
        }
      />
      {asking && (
        <BackupPrompt
          identity={identity}
          pubkey={viewer}
          ended={settled}
          onClose={close}
          // Sync ends the consent wait, which removes the action, perhaps
          // only after the prompt has closed; the description stays.
          finalFocus={() =>
            (backedUp.current ? null : action.current) ?? sentence.current
          }
        />
      )}
    </>
  );
}

/**
 * When `pubkey` was last active in a channel on the current community's relay,
 * in Unix seconds; undefined without any activity there. Throws without a
 * connected session, so that reads as unchecked rather than inactive.
 */
export async function keyActivity(
  session: Pick<RelaySession, "read"> | undefined,
  pubkey: string,
): Promise<number | undefined> {
  if (!session) throw new Error("The relay isn’t connected");
  const [latest] = await session.read(
    // Relay reads must name kinds: channel activity, the messages people see.
    [{ kinds: [...CHANNEL_ACTIVITY_KINDS], authors: [pubkey], limit: 1 }],
    { priority: "background" },
  );
  return latest?.created_at;
}

type BackedUp =
  | { revision: string; key: string | null }
  | { revision: string; failed: string };

/**
 * The account's linked key when it is backed up, read with the organization
 * sign-in as first run reads it (`nsec-backups/status`). Backups of other keys
 * are left out: making one the account's would unlink the linked key, and
 * kgoose never links an unlinked key again.
 */
function BackedUpKey({
  viewer,
  identity,
  federated,
  lastActive,
}: {
  viewer: string;
  identity: Identity;
  federated: FederatedIdentity;
  lastActive?: ((pubkey: string) => Promise<number | undefined>) | undefined;
}) {
  useLanguage();
  const session = useSyncExternalStore(
    federated.subscribe,
    federated.snapshot,
    federated.snapshot,
  );
  const revision =
    session.status === "signed-in" && session.authority
      ? session.revision
      : undefined;
  // A backup finishing after the read may have just added the linked key.
  const backedUp =
    useSyncExternalStore(identity.backup.subscribe, identity.backup.snapshot)
      ?.status === "complete";
  const [read, setRead] = useState<BackedUp>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a finished backup reads the account again.
  useEffect(() => {
    if (!revision) return;
    let current = true;
    const account = federatedBuilderlabAccount(
      { revision },
      federated,
      identity,
    );
    Promise.all([account.linkedKey(), account.backupStatus()]).then(
      ([linked, backups]) => {
        if (!current) return;
        const key =
          linked && backups !== "unavailable" && backups.includes(linked)
            ? linked
            : null;
        setRead({ revision, key });
      },
      (error: unknown) => {
        if (current)
          setRead({
            revision,
            failed: error instanceof Error ? error.message : String(error),
          });
      },
    );
    return () => {
      current = false;
    };
  }, [revision, federated, identity, backedUp]);
  const shown = read?.revision === revision ? read : undefined;
  const key = shown && "key" in shown ? shown.key : null;
  // undefined: checking; null: no events there; false: the read failed.
  const [active, setActive] = useState<number | null | false>();
  useEffect(() => {
    if (!key || !lastActive) return;
    let current = true;
    setActive(undefined);
    lastActive(key).then(
      (at) => {
        if (current) setActive(at ?? null);
      },
      (error: unknown) => {
        console.warn("Couldn’t read the backed-up key’s activity", error);
        if (current) setActive(false);
      },
    );
    return () => {
      current = false;
    };
  }, [key, lastActive]);
  if (!revision)
    return (
      <PreferenceRow
        title={t("settings.backedUpKey")}
        subtitle={t("settings.backupSignInOrganization")}
      />
    );
  if (!shown)
    return (
      <PreferenceRow
        title={t("settings.backedUpKey")}
        subtitle={<span role="status">{t("settings.checkingBackup")}</span>}
      />
    );
  if ("failed" in shown)
    return (
      <PreferenceRow
        title={t("settings.backedUpKey")}
        subtitle={
          <span role="alert">
            {t("settings.backupCheckFailed", { error: shown.failed })}
          </span>
        }
      />
    );
  if (!shown.key) return null;
  return (
    <PreferenceRow
      title={t(
        shown.key === viewer
          ? "settings.backedUpThisDevice"
          : "settings.backedUpLinked",
      )}
      subtitle={
        <>
          <code className={`text-mono ${styles.identityValue}`}>
            {npubEncode(shown.key)}
          </code>
          {lastActive &&
            (active === undefined
              ? t("settings.checkingActivity")
              : active === null
                ? t("settings.noActivity")
                : active === false
                  ? t("settings.activityFailed")
                  : t("settings.lastActive", {
                      time: activityTimestamp(active),
                    }))}
        </>
      }
    />
  );
}

export function IdentitySettings({
  viewer,
  identity,
  federatedIdentity,
  memberships = [],
  servers = signInServers,
  builderlabIdentity,
  lastActive,
}: {
  viewer?: string | undefined;
  identity?: Identity | undefined;
  federatedIdentity?: FederatedIdentity | undefined;
  /** Joined communities, for each server's "Used by". */
  memberships?: readonly Membership[] | undefined;
  /** The build's sign-in servers; native's compiled list by default. */
  servers?: () => Promise<readonly SessionSnapshot[]>;
  /**
   * The same session as the Builderlab plugin's bundled installation, as
   * first run uses it: the host's own refuses authenticated requests.
   */
  builderlabIdentity?: FederatedIdentity | undefined;
  /** When `pubkey` was last active in a channel on the current community's relay. */
  lastActive?: ((pubkey: string) => Promise<number | undefined>) | undefined;
}) {
  useLanguage();
  const [signingOut, setSigningOut] = useState(false);
  const [offered, setOffered] = useState(false);
  useEffect(() => {
    if (identity) void backupOfferedFor(identity.backup).then(setOffered);
  }, [identity]);
  const [copyStatus, setCopyStatus] = useState<{
    message: DisplayMessage;
    failed: boolean;
  } | null>(null);
  const copyAttempt = useRef(0);
  const npub = viewer ? npubEncode(viewer) : "";
  async function copyIdentity(value: string, kind: "hex" | "npub") {
    const attempt = ++copyAttempt.current;
    setCopyStatus(null);
    try {
      await writeClipboardText(value);
      if (attempt === copyAttempt.current)
        setCopyStatus({
          message: localMessage(
            kind === "hex"
              ? "settings.publicKeyCopied"
              : "settings.nostrAddressCopied",
          ),
          failed: false,
        });
    } catch {
      if (attempt === copyAttempt.current)
        setCopyStatus({
          message: localMessage(
            kind === "hex"
              ? "settings.publicKeyCopyFailed"
              : "settings.nostrCopyFailed",
          ),
          failed: true,
        });
    }
  }
  return (
    <section aria-labelledby="identity-settings-title">
      <Header
        id="identity-settings-title"
        title={t("settings.identity")}
        subtitle={t("settings.identityDescription")}
      />
      {!viewer && <p>{t("settings.identityUnavailable")}</p>}
      {viewer && (
        <>
          <SettingsGroup>
            {(
              [
                [
                  "hex",
                  t("settings.publicKeyHex"),
                  t("settings.copyPublicKey"),
                  viewer,
                ],
                [
                  "npub",
                  t("settings.nostrAddressNpub"),
                  t("settings.copyNostrAddress"),
                  npub,
                ],
              ] as const
            ).map(([kind, label, copyLabel, value]) => (
              <PreferenceRow
                key={kind}
                title={label}
                subtitle={
                  <code className={`text-mono ${styles.identityValue}`}>
                    {value}
                  </code>
                }
                trailing={
                  <Tooltip content={copyLabel} hint="familiar">
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={copyLabel}
                      icon={<CopyIcon aria-hidden="true" />}
                      onClick={() => void copyIdentity(value, kind)}
                    />
                  </Tooltip>
                }
              />
            ))}
          </SettingsGroup>
          {identity && (
            <div className="mt-6">
              <SettingsGroup layout="form">
                {/* One key widget at a time; the dialog brings its own. */}
                {!signingOut && <PrivateKey identity={identity} />}
              </SettingsGroup>
              <SettingsGroup>
                <BackupRow identity={identity} viewer={viewer} />
                {offered && viewer && builderlabIdentity && (
                  <BackedUpKey
                    viewer={viewer}
                    identity={identity}
                    federated={builderlabIdentity}
                    lastActive={lastActive}
                  />
                )}
                <PreferenceRow
                  title={t("settings.signOutBuzz")}
                  subtitle={t("settings.signOutDescription")}
                  trailing={
                    <Button type="button" onClick={() => setSigningOut(true)}>
                      {t("settings.signOutBuzz")}
                    </Button>
                  }
                />
              </SettingsGroup>
              {signingOut && (
                <SignOutDialog
                  identity={identity}
                  onClose={() => setSigningOut(false)}
                />
              )}
            </div>
          )}
          {federatedIdentity && (
            <OrganizationSignIns
              identity={federatedIdentity}
              memberships={memberships}
              servers={servers}
            />
          )}
          {copyStatus && (
            <ToastNotice
              title={
                copyStatus.failed
                  ? t("settings.identityCopyFailed")
                  : resolveMessage(copyStatus.message)
              }
              {...(copyStatus.failed
                ? { description: resolveMessage(copyStatus.message) }
                : {})}
              tone={copyStatus.failed ? "error" : "success"}
              timeout={copyStatus.failed ? 0 : 5000}
              onDismiss={() => setCopyStatus(null)}
            />
          )}
        </>
      )}
    </section>
  );
}

/** Every server's session, live: one stable array until one changes. */
function useSessions(sessions: readonly FederatedIdentity[]) {
  const store = useMemo(() => {
    let cached: readonly SessionSnapshot[] = [];
    return {
      subscribe: (listener: () => void) => {
        const stops = sessions.map((session) => session.subscribe(listener));
        return () => {
          for (const stop of stops) stop();
        };
      },
      snapshot: () => {
        const next = sessions.map((session) => session.snapshot());
        if (
          next.length !== cached.length ||
          next.some((state, index) => state !== cached[index])
        )
          cached = next;
        return cached;
      },
    };
  }, [sessions]);
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}

/** One row per signed-in server, each signing out of that server only, and
 * the build's Builderlab row to sign in from while it isn't signed in. */
function OrganizationSignIns({
  identity,
  memberships,
  servers,
}: {
  identity: FederatedIdentity;
  memberships: readonly Membership[];
  servers: () => Promise<readonly SessionSnapshot[]>;
}) {
  useLanguage();
  const [ids, setIds] = useState<readonly string[]>([]);
  useEffect(() => {
    let active = true;
    void servers()
      .then((list) => {
        if (active)
          setIds(list.flatMap((server) => server.authority?.id ?? []));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [servers]);
  const sessions = useMemo(
    () => ids.flatMap((id) => identity.forServer?.(id) ?? []),
    [identity, ids],
  );
  const states = useSessions(sessions);
  // Kept here, not in a row: a sign-out that fails still leaves signed-in,
  // so its row goes, and the failure must outlive it.
  const [failures, setFailures] = useState<
    ReadonlyMap<FederatedIdentity, SignOutFailure>
  >(new Map());
  const report = (session: FederatedIdentity, failure?: SignOutFailure) =>
    setFailures((current) => {
      const next = new Map(current);
      if (failure) next.set(session, failure);
      else next.delete(session);
      return next;
    });
  const signOut = (session: FederatedIdentity) => {
    const authority = session.snapshot().authority;
    if (!authority) return;
    report(session);
    void session.signOut().catch((error: unknown) =>
      report(session, {
        authority,
        failure: error instanceof Error ? error.message : "",
      }),
    );
  };
  const signedIn = sessions.filter(
    (_, index) =>
      states[index]?.status === "signed-in" && states[index]?.authority,
  );
  // Native reports a sign-out it couldn't finish, such as a storage failure,
  // as that server's snapshot with `cleanup` rather than an error. Read from
  // the session, it survives Settings closing and a reload until cleanup ends.
  // Any other unavailable session, such as a failed restore, still has a
  // record that may be valid; signing out would delete it.
  const unfinished = new Map(failures);
  sessions.forEach((session, index) => {
    const state = states[index];
    if (state?.cleanup && state.authority)
      unfinished.set(session, {
        authority: state.authority,
        failure: state.failure ?? "",
      });
  });
  const problems = [...unfinished].map(([session, { authority, failure }]) => (
    <div key={authority.id}>
      <p role="alert" className="text-body-sm text-danger">
        {t("settings.signOutServerFailed", {
          server: serverName(authority),
          error: signInRecovery(failure),
        })}
      </p>
      <Button type="button" onClick={() => signOut(session)}>
        {t("settings.tryAgain")}
      </Button>
    </div>
  ));
  // The first server's own row would repeat its failure without naming it.
  const first = identity.snapshot().authority?.id;
  const firstFailed = [...unfinished.values()].some(
    ({ authority }) => authority.id === first,
  );
  const firstSignedIn = states.some(
    (state) => state.status === "signed-in" && state.authority?.id === first,
  );
  if (signedIn.length === 0)
    return (
      <>
        {!firstFailed && <OrganizationSignIn identity={identity} />}
        {problems}
      </>
    );
  return (
    <section className="mt-6" aria-labelledby="organization-sign-in-title">
      <InlineHeader
        id="organization-sign-in-title"
        title={t("settings.organizationSignIn")}
      />
      <SettingsGroup>
        {!firstSignedIn && !firstFailed && (
          <OrganizationSignIn identity={identity} listed />
        )}
        {signedIn.map((session) => (
          <ServerSession
            key={session.snapshot().authority?.id}
            session={session}
            memberships={memberships}
            onSignOut={() => signOut(session)}
          />
        ))}
        {problems}
      </SettingsGroup>
    </section>
  );
}

type SignOutFailure = Readonly<{
  authority: NonNullable<SessionSnapshot["authority"]>;
  failure: string;
}>;

function ServerSession({
  session,
  memberships,
  onSignOut,
}: {
  session: FederatedIdentity;
  memberships: readonly Membership[];
  onSignOut: () => void;
}) {
  useLanguage();
  const state = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
    session.snapshot,
  );
  if (!state.authority) return null;
  const host = new URL(state.authority.identityOrigin).host;
  const usedBy = coveredCommunities(
    state.authority.communityHosts,
    memberships,
  );
  const expires = state.expiresAt
    ? new Date(state.expiresAt).toLocaleString(formattingLocale(), {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
  return (
    <PreferenceRow
      title={serverTitle(state.authority)}
      subtitle={
        <>
          {state.email
            ? t("settings.signedInAs", { account: state.email })
            : t("settings.signedInOrganization")}
          {expires && t("settings.expiresSuffix", { time: expires })}
          {usedBy.length > 0 && (
            <>
              <br />
              {t("settings.usedBy", { communities: usedBy.join(", ") })}
            </>
          )}
        </>
      }
      trailing={
        <Button
          type="button"
          aria-label={t("settings.signOutServer", { host })}
          onClick={onSignOut}
        >
          {t("settings.signOut")}
        </Button>
      }
    />
  );
}

/** A server's row title: its name, and its host when that differs. */
function serverTitle(authority: NonNullable<SessionSnapshot["authority"]>) {
  const host = new URL(authority.identityOrigin).host;
  const name = serverName(authority);
  return name === host ? host : `${name} (${host})`;
}

/** The build's Builderlab sign-in, in a section of its own; `listed`, only
 * its row, named by its server, among other servers' rows. */
function OrganizationSignIn({
  identity,
  listed = false,
}: {
  identity: FederatedIdentity;
  listed?: boolean;
}) {
  useLanguage();
  const state = useSyncExternalStore(
    identity.subscribe,
    identity.snapshot,
    identity.snapshot,
  );
  const [failure, setFailure] = useState<DisplayMessage>("");
  const problem = failure || state.failure;
  if (!state.authority || state.status === "unconfigured") return null;
  const unavailable = state.status === "unavailable";
  // Controls hide when unavailable, but a failed restore still explains itself.
  if (unavailable && !listed)
    return problem ? (
      <p role="alert" className="mt-6 text-body-sm text-danger">
        {typeof problem === "string"
          ? signInRecovery(problem)
          : resolveMessage(problem)}
      </p>
    ) : null;
  const organization = new URL(state.authority.identityOrigin).host;
  const signedIn = state.status === "signed-in";
  const signingIn = state.status === "signing-in";
  const status = signedIn
    ? state.email
      ? t("settings.signedInAs", { account: state.email })
      : t("settings.signedInOrganization")
    : t("settings.notSignedIn");
  const expires =
    signedIn && state.expiresAt
      ? new Date(state.expiresAt).toLocaleString(formattingLocale(), {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "";
  function run(operation: () => Promise<unknown>) {
    setFailure("");
    void Promise.resolve()
      .then(operation)
      .catch((error: unknown) =>
        setFailure(
          error instanceof Error
            ? error.message
            : localMessage("settings.signInUnavailable"),
        ),
      );
  }
  const row = (
    <>
      <PreferenceRow
        title={listed ? serverTitle(state.authority) : status}
        subtitle={
          <>
            {listed && !unavailable && (
              <>
                {status}
                <br />
              </>
            )}
            {expires && (
              <>
                {t("settings.expiresAt", { time: expires })}
                <br />
              </>
            )}
            {t("settings.organizationDescription", { organization })}
          </>
        }
        trailing={
          unavailable ? undefined : (
            <Button
              type="button"
              disabled={state.status === "restoring"}
              onClick={() =>
                run(() =>
                  signedIn
                    ? identity.signOut()
                    : signingIn
                      ? identity.cancelSignIn()
                      : identity.signIn(),
                )
              }
            >
              {signedIn
                ? t("settings.signOutOrganization")
                : signingIn
                  ? t("settings.cancelSignIn")
                  : t("settings.signIn")}
            </Button>
          )
        }
      />
      {problem && (
        <p role="alert" className="text-body-sm text-danger">
          {typeof problem === "string"
            ? signInRecovery(problem)
            : resolveMessage(problem)}
        </p>
      )}
    </>
  );
  if (listed) return row;
  return (
    <section className="mt-6" aria-labelledby="organization-sign-in-title">
      <InlineHeader
        id="organization-sign-in-title"
        title={t("settings.organizationSignIn")}
      />
      <SettingsGroup>{row}</SettingsGroup>
    </section>
  );
}
