import { english } from "../../shared/i18n";
import { formatMessage } from "../../shared/i18n/messages";
import { rich } from "../../shared/i18n/rich";
import {
  localError,
  errorMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { t, useLanguage } from "../../shared/i18n";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Dialog, type DialogProps } from "../../shared/design-system/ui/Dialog";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { communityName } from "./community-name";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { Checkbox } from "../../shared/design-system/ui/Checkbox";
import { Button } from "../../shared/design-system/ui/Button";
import { communityRequest, inspectProfile, type CommunityInfo } from "./api";
import type { Communities, PersonalProfile } from "./service";
import { canSaveProfile, ProfileFields, profilesEqual } from "./ProfileFields";
import { communityDestination } from "./destination";
import { parsePastedInvite, pastedInviteError } from "./invite-link";
import { nativeIdentityEnabled } from "../identity/service";
import { isTransientFailure, readErrorKind } from "../relay/errors";
import { createJoinJournal, type PendingJoin } from "./join-journal";
import { admitCommunity, completeJoin, type Current } from "./join";
import { consentAsked, type JoinPolicy } from "./join-policy";
import { ACCOUNT_CONSENT, accountConsents } from "./account-consent";
import { CommunitySignIn } from "../federated-identity/CommunitySignIn";
import type { FederatedIdentity } from "../federated-identity/service";
import { OnboardingBack } from "../identity/OnboardingBack";
import { OnboardingScreen } from "../identity/OnboardingScreen";
import styles from "./Communities.module.css";

export function CommunityDialog({
  communities,
  mode,
  close,
  onJoined,
  invite,
  connectionFrom,
  submittedDestination = false,
  onboarding = false,
  federatedIdentity,
}: {
  communities: Communities;
  /** Offers protected-community sign-in when admission refuses for it. */
  federatedIdentity?: FederatedIdentity | undefined;
  mode: "join" | "profile";
  close(): void;
  onJoined?: (id: string) => void;
  /** A deliberate connection edit uses the same admission flow, never rekeys existing data. */
  connectionFrom?: string;
  /** The landing form already submitted this destination. */
  submittedDestination?: boolean;
  onboarding?: boolean;
  invite?:
    | Readonly<{
        community: string;
        code: string;
      }>
    | undefined;
}) {
  useLanguage();
  const BackControl = onboarding ? OnboardingBack : Button;
  const formId = useId();
  const destinationInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const touchOpening = useRef(false);
  const focusFrom = useRef<Element | null>(null);
  const focusProfile = useRef(false);
  const client = communities.snapshot();
  const unavailable =
    client.status !== "ready" || (mode === "join" && !client.relayAvailable);
  const [journal] = useState(() =>
    mode === "join" && nativeIdentityEnabled() && client.viewer
      ? createJoinJournal(client.viewer)
      : undefined,
  );
  const [recovery] = useState(() => {
    try {
      return { pending: journal?.latest(), error: "" };
    } catch (reason) {
      return { pending: undefined, error: String(reason) };
    }
  });
  const [url, setUrl] = useState(
    connectionFrom ??
      invite?.community ??
      (recovery.pending
        ? communityDestination(recovery.pending.community).url
        : ""),
  );
  const [destination, setDestination] =
    useState<ReturnType<typeof communityDestination>>();
  const id = destination?.id ?? "";
  const [step, setStep] = useState<"destination" | "access" | "profile">(
    mode === "profile" ? "profile" : "destination",
  );
  const [info, setInfo] = useState<CommunityInfo>();
  const [profile, setProfile] = useState<PersonalProfile>(client.profile);
  const [original, setOriginal] =
    useState<Awaited<ReturnType<typeof inspectProfile>>>();
  const [code, setCode] = useState(invite?.code ?? "");
  const [needsInvite, setNeedsInvite] = useState(!!invite?.code);
  const [agreed, setAgreed] = useState(false);
  const [adult, setAdult] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DisplayMessage>(recovery.error);
  const mounted = useRef(true);
  const attempt = useRef<AbortController>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function work(action: (signal: AbortSignal) => Promise<void>) {
    const controller = new AbortController();
    attempt.current = controller;
    const { signal } = controller;
    focusFrom.current = document.activeElement;
    setBusy(true);
    setError("");
    try {
      await action(signal);
    } catch (reason) {
      // A step that was left settles without changing anything.
      if (mounted.current && !signal.aborted) {
        if (
          step === "access" &&
          info?.membershipRequired === true &&
          readErrorKind(reason) === "denied"
        )
          setNeedsInvite(true);
        setError(errorMessage(reason));
      }
    } finally {
      if (mounted.current && !signal.aborted) setBusy(false);
    }
  }
  function abandon() {
    attempt.current?.abort();
    setBusy(false);
  }
  function leave() {
    abandon();
    close();
  }
  useLayoutEffect(() => {
    if (busy || step !== "profile" || !focusProfile.current) return;
    focusProfile.current = false;
    // The submitted step owns this handoff only while focus has not moved elsewhere.
    if (
      !touchOpening.current &&
      (document.activeElement === focusFrom.current ||
        document.activeElement === document.body)
    )
      nameInput.current?.focus();
  }, [busy, step]);
  const startedDestination = useRef(false);
  useEffect(() => {
    if (!submittedDestination || startedDestination.current || unavailable)
      return;
    startedDestination.current = true;
    void submit();
  });
  const policy = info?.policy;
  const errorText = resolveMessage(error);
  const errorSource =
    typeof error === "string"
      ? error
      : formatMessage(english[error.key], error.values, "en");
  const terms = policy?.terms_markdown ? (
    <a
      className="underline"
      href={`${destination?.url}/api/join-policy/terms`}
      target="_blank"
      rel="noreferrer"
    >
      {t("profileEditing.terms")}
    </a>
  ) : null;
  const privacy = policy?.privacy_markdown ? (
    <a
      className="underline"
      href={`${destination?.url}/api/join-policy/privacy`}
      target="_blank"
      rel="noreferrer"
    >
      {t("profileEditing.privacy")}
    </a>
  ) : null;
  const agreement =
    terms && privacy
      ? rich("profileEditing.consentBoth", { terms, privacy })
      : terms
        ? rich("profileEditing.consentTerms", { terms })
        : rich("profileEditing.consentPrivacy", { privacy });
  const agreementName =
    terms && privacy
      ? t("profileEditing.consentBoth", {
          terms: t("profileEditing.terms"),
          privacy: t("profileEditing.privacy"),
        })
      : terms
        ? t("profileEditing.consentTerms", { terms: t("profileEditing.terms") })
        : t("profileEditing.consentPrivacy", {
            privacy: t("profileEditing.privacy"),
          });
  // The signed-in account's consent covers a community its server hosts, so
  // the access step asks for none.
  const consentGiven =
    !!destination && accountConsents(federatedIdentity, destination.url);
  const asked = consentAsked(policy, consentGiven);
  const allowed = (!asked.age || adult) && (!asked.agreement || agreed);
  const current: Current = (entry) =>
    mounted.current && (!entry || journal?.current(entry) === true);
  function showProfile(
    found: Awaited<ReturnType<typeof inspectProfile>>,
    pending?: PendingJoin,
  ) {
    setOriginal(found);
    setProfile(
      pending?.profile ?? (found.exists ? found.profile : client.profile),
    );
    focusProfile.current = true;
    setStep("profile");
  }
  /**
   * The access step's admission, with the account's consent when it covers
   * `url`. `inviteCode` is given when it is newer than the rendered `code`.
   */
  async function admit(
    community: string,
    url: string,
    joinPolicy: JoinPolicy | null | undefined,
    inviteCode = code,
  ) {
    const admission = await admitCommunity({
      community,
      journal,
      code: inviteCode,
      policy: joinPolicy,
      consent: accountConsents(federatedIdentity, url)
        ? ACCOUNT_CONSENT
        : { adult, agreed },
      current,
    });
    if (admission) showProfile(admission.found, admission.entry);
  }
  async function submit() {
    if (uploading || unavailable) return;
    if (step === "destination") {
      await work(async (signal) => {
        const entered = parsePastedInvite(url);
        if (!entered)
          throw new Error(
            pastedInviteError(url, t("identityMore.addressInvalid")),
          );
        const next = communityDestination(entered.community);
        // A pasted invite link carries its code the way an opened invite does.
        // This submission uses it directly; the state serves later retries.
        const inviteCode = entered.code || code;
        if (entered.code) {
          setCode(entered.code);
          setNeedsInvite(true);
        }
        setDestination(next);
        // Transport text names neither the host nor a next step, and differs by engine.
        const explained = (reason: unknown) =>
          isTransientFailure(reason)
            ? localError("profileEditing.unreachable", { host: next.name })
            : reason;
        const value = await communityRequest<CommunityInfo>(
          next.id,
          "info",
          undefined,
          signal,
        ).catch((reason: unknown) => {
          throw explained(reason);
        });
        // A host that was left gets no signed profile read, even from a late answer.
        if (!mounted.current || signal.aborted) return;
        const pending = journal?.get(next.id);
        // Restoring an existing admitted profile is not a new join or policy acceptance.
        const found = await inspectProfile(next.id).catch((reason: unknown) => {
          if (pending && readErrorKind(reason) !== "denied")
            throw explained(reason);
          if (
            mounted.current &&
            !signal.aborted &&
            value.membershipRequired === true &&
            readErrorKind(reason) === "denied"
          )
            setNeedsInvite(true);
          return undefined;
        });
        if (!signal.aborted && current(pending)) {
          setInfo(value);
          if (found && (found.exists || pending)) showProfile(found, pending);
          else if (
            !accountConsents(federatedIdentity, next.url) ||
            (!found && !inviteCode.trim())
          )
            setStep("access");
          else {
            // The account's consent leaves the access step nothing to ask
            // (no code is needed, or one is given), so Continue goes on to its
            // admission. A refusal is shown there, where a code can be entered.
            await admit(next.id, next.url, value.policy, inviteCode).catch(
              (reason: unknown) => {
                if (current()) {
                  setStep("access");
                  if (
                    value.membershipRequired === true &&
                    readErrorKind(reason) === "denied"
                  )
                    setNeedsInvite(true);
                }
                throw reason;
              },
            );
          }
        }
      });
    } else if (step === "access") {
      if (!allowed || !destination) return;
      await work(() => admit(id, destination.url, policy));
    } else {
      if (!profile.name.trim()) return;
      await work(async () => {
        if (mode === "profile")
          communities.saveProfile({ ...profile, name: profile.name.trim() });
        else {
          if (!destination || !original)
            throw localError("profileEditing.chooseCommunity");
          const done = await completeJoin({
            community: id,
            membership: {
              id,
              name:
                info?.name && info.name !== "Buzz Relay"
                  ? info.name
                  : destination.name,
              ...(info?.icon?.startsWith("https://")
                ? { icon: info.icon }
                : {}),
            },
            found: original,
            journal,
            publish: profile,
            communities,
            current,
          });
          if (!done) return;
          onJoined?.(id);
        }
        close();
      });
    }
  }
  // Keeping an existing community profile publishes nothing, so it needs no edit validation.
  const keepsProfile =
    mode === "join" &&
    !!original?.exists &&
    profilesEqual(profile, original.profile);
  const looking = busy && step === "destination";
  // While busy, the primary action names the operation its step started.
  const [action, actionPending] =
    step === "destination"
      ? [t("profileEditing.continue"), t("profileEditing.connecting")]
      : step === "access"
        ? [t("profileEditing.continue"), t("profileEditing.joining")]
        : mode === "profile"
          ? [t("profileEditing.saveProfile"), t("profileEditing.saving")]
          : keepsProfile
            ? [t("profileEditing.continue"), t("profileEditing.joining")]
            : [t("profileEditing.publishOpen"), t("profileEditing.publishing")];

  return (
    <JoinSurface
      onboarding={onboarding}
      titleIdentity={
        mode === "profile" || step === "profile"
          ? "profile"
          : connectionFrom
            ? "connection"
            : "join"
      }
      open
      dismissOnOutsideClick={false}
      onOpenChange={(next) => {
        if (!next) leave();
      }}
      // A lookup only reads, so it can be left; access and profile steps write.
      preventClose={busy && !looking}
      initialFocus={(type) => {
        // Controlled entry has no Base UI trigger to report touch modality.
        touchOpening.current =
          type === "touch" ||
          !!window.matchMedia?.("(pointer: coarse)").matches;
        const field =
          step === "destination"
            ? destinationInput.current
            : step === "profile"
              ? nameInput.current
              : null;
        return touchOpening.current
          ? (field?.closest<HTMLElement>('[role="dialog"]') ?? null)
          : field;
      }}
      description={
        unavailable
          ? undefined
          : step === "destination"
            ? connectionFrom
              ? t("profileEditing.connectionDescription")
              : t("profileEditing.joinDescription")
            : step === "access"
              ? destination && (
                  <span className="flex items-center gap-3 rounded-[var(--radius-row)] bg-surface-inset p-4">
                    {info?.icon && (
                      <Avatar
                        alt=""
                        src={info.icon}
                        fallback={communityName(info.name, destination.name)}
                        shape="squircle"
                        size="large"
                      />
                    )}
                    <span className="min-w-0 flex-1 break-words text-body text-standard">
                      <span>{communityName(info?.name, destination.name)}</span>
                      <span className="block break-all text-body-sm text-subtle">
                        {destination.url}
                      </span>
                    </span>
                  </span>
                )
              : mode === "profile"
                ? t("profileEditing.localProfileDescription")
                : original?.exists
                  ? undefined
                  : t("profileEditing.newProfileDescription")
      }
      leadingActions={
        !unavailable && (
          <BackControl
            type="button"
            disabled={(busy && !looking) || uploading}
            onClick={() => {
              if (looking && !onboarding) {
                // Cancel keeps the address to correct or retry. The field is
                // disabled while busy, so the busy=false render must commit
                // before focus() can land on it.
                flushSync(abandon);
                destinationInput.current?.focus();
              } else if (
                step === "destination" ||
                mode === "profile" ||
                (submittedDestination && step === "access")
              )
                leave();
              else {
                setError("");
                setStep(step === "profile" ? "access" : "destination");
                setAgreed(false);
                setAdult(false);
              }
            }}
          >
            {onboarding
              ? undefined
              : t(looking ? "profileEditing.cancel" : "profileEditing.back")}
          </BackControl>
        )
      }
      actions={
        !unavailable && (
          <Button
            variant="prominent"
            {...(onboarding ? { size: "lg" as const } : {})}
            type="submit"
            form={formId}
            disabled={
              busy ||
              uploading ||
              (step === "access" && !allowed) ||
              (step === "profile" &&
                (keepsProfile
                  ? !profile.name.trim()
                  : !canSaveProfile(profile)))
            }
          >
            {busy ? actionPending : action}
          </Button>
        )
      }
      title={
        mode === "profile"
          ? t("profileEditing.yourProfile")
          : step === "profile"
            ? t("profileEditing.yourProfile")
            : connectionFrom
              ? t("profileEditing.editConnection")
              : t("profileEditing.joinCommunity")
      }
    >
      <form
        id={formId}
        noValidate
        className="w-full space-y-6 text-left"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {unavailable ? (
          <p>
            {client.status === "loading"
              ? t("profileEditing.openingIdentity")
              : client.status === "ready"
                ? t("profileEditing.connectionBuildUnavailable")
                : t("profileEditing.developmentIdentityUnavailable")}
          </p>
        ) : (
          <>
            {step === "destination" && submittedDestination && busy ? (
              <p role="status">{t("profileEditing.findingCommunity")}</p>
            ) : (
              step === "destination" && (
                <Field
                  label={t("profileEditing.communityUrl")}
                  error={errorText || undefined}
                  description={
                    connectionFrom
                      ? undefined
                      : t("profileEditing.communityUrlDescription")
                  }
                >
                  <Input
                    ref={destinationInput}
                    type="url"
                    required
                    autoComplete="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="wss://communities.buzz.xyz"
                    maxLength={2048}
                    disabled={busy}
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setDestination(undefined);
                      setCode("");
                      setNeedsInvite(false);
                      setAgreed(false);
                      setAdult(false);
                      setInfo(undefined);
                      setOriginal(undefined);
                      setProfile(client.profile);
                      setError("");
                    }}
                  />
                </Field>
              )
            )}
            {step === "access" && (
              <>
                {needsInvite && (
                  <Field label={t("profileEditing.inviteCode")}>
                    <Input
                      disabled={busy}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      maxLength={256}
                    />
                  </Field>
                )}
                {policy && !consentGiven && (
                  <div className={styles.policy}>
                    {(policy.terms_markdown || policy.privacy_markdown) && (
                      <Checkbox
                        checked={agreed}
                        aria-label={agreementName}
                        onCheckedChange={setAgreed}
                        label={agreement}
                      />
                    )}
                    {policy.age_attestation_required && (
                      <Checkbox
                        checked={adult}
                        onCheckedChange={setAdult}
                        label={t("profileEditing.adult")}
                      />
                    )}
                  </div>
                )}
              </>
            )}
            {step === "profile" && (
              <ProfileFields
                showAbout={!onboarding}
                {...(onboarding
                  ? { emptyAvatarStyle: "dotted-circle" as const }
                  : {})}
                nameRef={nameInput}
                community={mode === "profile" ? undefined : id}
                onBusyChange={setUploading}
                profile={profile}
                onChange={setProfile}
                disabled={busy}
              />
            )}
            {error && step !== "destination" && (
              <p role="alert" className={styles.error}>
                {errorText}
              </p>
            )}
            {error && (
              <CommunitySignIn
                identity={
                  (destination &&
                    federatedIdentity?.forCommunity?.(destination.url)) ||
                  federatedIdentity
                }
                error={errorSource}
                relay={destination?.url}
                memberships={client.memberships}
                // Sign-in only clears the refusal: Continue then runs the current
                // step with current input, never one captured before the login.
                retry={() => setError("")}
              />
            )}
          </>
        )}
      </form>
    </JoinSurface>
  );
}

/** First-run joins share the admission form with Add community, without a modal. */
function JoinSurface({
  onboarding,
  titleIdentity,
  ...props
}: DialogProps & {
  onboarding: boolean;
  titleIdentity: "profile" | "connection" | "join";
}) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    void titleIdentity;
    if (onboarding) heading.current?.focus();
  }, [onboarding, titleIdentity]);
  if (!onboarding) return <Dialog {...props} />;
  return (
    <OnboardingScreen
      labelledBy={titleId}
      intro={
        <>
          <h1 ref={heading} tabIndex={-1} id={titleId} className="text-heading">
            {props.title}
          </h1>
          {props.description && (
            <p className="text-body text-subtle">{props.description}</p>
          )}
        </>
      }
    >
      {props.children}
      <div data-onboarding-actions="" className="w-full">
        {props.leadingActions}
        {props.actions}
      </div>
    </OnboardingScreen>
  );
}
