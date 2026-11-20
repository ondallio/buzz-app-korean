import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t, useLanguage, type TranslationKey } from "../../shared/i18n";
import { Button } from "../../shared/design-system/ui/Button";
import { Combobox } from "../../shared/design-system/ui/Combobox";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { Radio, RadioGroup } from "../../shared/design-system/ui/RadioGroup";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import {
  unresolved,
  unsupported,
  type EventPreviewDto,
  type MemberDetailDto,
  type MemberSearchDto,
  type StaffFailure,
  type StaffRequest,
} from "../../features/relay-staff/contract";
import { npubEncode } from "nostr-tools/nip19";
import { PeopleScope, Person, PersonName, usePeople } from "./people";
import { reasonAudience } from "./Reports";
import {
  describe,
  useRead,
  useSession,
  useWrite,
  type Read,
  type Tracked,
} from "./session";
import {
  absoluteTime,
  CommunityBadge,
  containsSecretKey,
  eventIdInput,
  NotConnected,
  secretKeyWarning,
  time,
  unsupportedBrowsing,
  useRetry,
  type CommunityRef,
} from "./ui";
import { searchable, useDebounced } from "../../shared/search-debounce";
import { typedPublicKey } from "../../shared/identity/public-key";

type Action = "ban" | "timeout" | "delete";
type Intent = Extract<StaffRequest, { route: "directAction" }>;

const LABEL_KEYS = {
  ban: "furs.direct.ban",
  timeout: "furs.direct.timeout",
  delete: "furs.direct.delete",
} as const satisfies Record<Action, TranslationKey>;
const ACTIONS = Object.keys(LABEL_KEYS) as Action[];
const actionLabel = (action: Action) => t(LABEL_KEYS[action]);

export const staffCopy = () => t("furs.staffTarget");
export const unsupportedActions = () => t("furs.unsupportedActions");

export function directFailure(failure: StaffFailure) {
  if (failure.code === "target_is_staff") return staffCopy();
  if (failure.code === "request_id_conflict")
    return t("furs.requestIdConflict");
  if (unsupported(failure)) return unsupportedActions();
  return describe(failure);
}

/** Why a lookup failed; "not found" only when the relay said so. */
function lookupFailure(failure: StaffFailure) {
  if (unsupported(failure)) return unsupportedBrowsing();
  if (failure.code === "event_not_found" || failure.code === "not_found")
    return t("furs.notFound");
  return describe(failure);
}

/** `keyLabel` is the distinct short key from the list the member was picked in. */
type Member = { pubkey: string; name: string | null; keyLabel?: string };
type Draft = {
  host: string;
  action: Action;
  target: string;
  member: Member | null;
  secs: string;
  reason: string;
  /** Review was tried, so field errors show and track the input. */
  checked: boolean;
};
const emptyDraft = (host: string): Draft => ({
  host,
  action: "ban",
  target: "",
  member: null,
  secs: "",
  reason: "",
  checked: false,
});

/** A reviewed action. Its intent, including `requestId`, never changes. */
type Frozen = {
  intent: Intent;
  community: CommunityRef;
  name: string | null;
  keyLabel: string | null;
  member: MemberDetailDto | null;
  preview: EventPreviewDto | null;
};

const DIRECT = "direct action";

type Controller = {
  draftFor(host: string): Draft;
  setDraft(draft: Draft): void;
  frozen: Frozen | null;
  pending: boolean;
  /** The last failure, only on the form of the community it was sent to. */
  errorFor(host: string): string | null;
  submitting: boolean;
  review(
    frozen: Omit<Frozen, "intent">,
    intent: Omit<Intent, "route" | "requestId">,
  ): void;
  confirm(): void;
  discard(): void;
  /** Host whose Actions section is on screen, for the off-screen failure toast. */
  shownHost: { current: string | null };
};
const ControllerContext = createContext<Controller | null>(null);

function useController() {
  const controller = useContext(ControllerContext);
  if (!controller) throw new Error("Direct actions controller is missing");
  return controller;
}

/**
 * Owns the draft and the reviewed action for every community page. Mounted
 * above the tabs, so leaving a page mid-action keeps the same request. The
 * reviewed action, its sending state and its last outcome are held per
 * identity, admin host and relay (`Staff.writes`), so closing the card or
 * losing then regaining access shows the same request and its real state.
 */
export function DirectActionsProvider({ children }: { children: ReactNode }) {
  const notify = useToastNotification();
  const [draft, setDraft] = useState<Draft | null>(null);
  const shownHost = useRef<string | null>(null);
  const write = useWrite<Intent, Omit<Frozen, "intent">>(
    DIRECT,
    (outcome, intent) => {
      if (outcome.ok && outcome.value.state === "succeeded") {
        notify(
          t("furs.actionDone", { action: actionLabel(intent.action) }),
          "success",
        );
        setDraft(emptyDraft(intent.communityHost));
        return;
      }
      if (!outcome.ok && shownHost.current !== intent.communityHost)
        notify(
          t("furs.actionFailed", {
            action: actionLabel(intent.action),
            host: intent.communityHost,
            reason: directFailure(outcome.failure),
          }),
          "error",
        );
    },
  );
  const { held } = write;
  const frozen = held?.request ? { ...held.meta, intent: held.request } : null;
  const outcome = held?.outcome ?? null;
  const pending = outcome?.ok === true && unresolved(outcome);
  const errorFor = (host: string) =>
    outcome?.ok === false && held?.sent?.communityHost === host
      ? directFailure(outcome.failure)
      : null;

  const confirm = () => write.run();

  const value: Controller = {
    draftFor: (host) => (draft?.host === host ? draft : emptyDraft(host)),
    setDraft,
    frozen,
    pending,
    errorFor,
    submitting: write.busy,
    review(lookup, intent) {
      write.freeze(
        { route: "directAction", ...intent, requestId: crypto.randomUUID() },
        lookup,
      );
    },
    confirm,
    discard: write.discard,
    shownHost,
  };
  return (
    <ControllerContext.Provider value={value}>
      {children}
    </ControllerContext.Provider>
  );
}

type Problems = Partial<
  Record<"target" | "member" | "secs" | "reason", string>
>;

/** What each field still needs before the action can be reviewed. */
function validate(draft: Draft, eventId: string | null): Problems {
  const secs = Number(draft.secs);
  return {
    ...(draft.action === "delete" && !eventId
      ? { target: t("furs.needEventId") }
      : {}),
    ...(draft.action !== "delete" && !draft.member
      ? { member: t("furs.needMember") }
      : {}),
    ...(draft.action === "timeout" && !(Number.isInteger(secs) && secs > 0)
      ? { secs: t("furs.needDuration") }
      : {}),
    ...(containsSecretKey(draft.reason) ? { reason: secretKeyWarning() } : {}),
  };
}

/**
 * A failed lookup's message with Retry beside it. Mounted for the whole life
 * of one lookup target, so the Retry keeps focus while its attempt runs.
 */
function LookupFailure({
  read,
  reload,
}: {
  read: Tracked<unknown>;
  reload(): void;
}) {
  useLanguage();
  const retry = useRetry(
    read.state === "failed" ? read.failure : null,
    read.settled,
    reload,
  );
  if (!retry.failure) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-body-sm text-danger" role="alert">
        {lookupFailure(retry.failure)}
      </p>
      <Button size="sm" loading={retry.retrying} onClick={retry.retry}>
        {t("adminStaff.retry")}
      </Button>
    </div>
  );
}

function MemberState({ member }: { member: MemberDetailDto }) {
  useLanguage();
  const facts = [
    member.role === null
      ? t("furs.notOnRoster")
      : t("furs.memberRole", { role: member.role }),
    member.banned ? t("furs.currentlyBanned") : null,
    member.mutedUntil
      ? t("furs.timedOutUntil", { time: absoluteTime(member.mutedUntil) })
      : null,
    member.isStaff ? t("furs.relayStaff") : null,
  ].filter(Boolean);
  return <p className="text-caption text-secondary">{facts.join(" · ")}</p>;
}

function EventPreview({ event }: { event: EventPreviewDto }) {
  useLanguage();
  return (
    <div className="flex flex-col gap-1 rounded-md border px-3 py-2 text-caption">
      <Person pubkey={event.authorPubkey} />
      <p className="whitespace-pre-wrap break-words">{event.content}</p>
      {event.deletedAt && (
        <p className="text-secondary">
          {t("furs.alreadyDeleted", { time: time(event.deletedAt) })}
        </p>
      )}
    </div>
  );
}

/** A lookup that only runs for `key`; null when there is nothing to look up. */
function useLookup<R extends StaffRequest>(
  request: R | null,
  key: string | null,
) {
  const [read, reload] = useRead(request, [key]);
  return request && key ? { read, reload, key } : null;
}

export function ActionsSection({ community }: { community: CommunityRef }) {
  useLanguage();
  const { context, canMutate } = useSession();
  const c = useController();
  const host = community.host;
  const draft = c.draftFor(host);
  const set = (patch: Partial<Draft>) => c.setDraft({ ...draft, ...patch });

  useEffect(() => {
    c.shownHost.current = host;
    return () => {
      c.shownHost.current = null;
    };
  }, [c.shownHost, host]);

  const eventId = draft.action === "delete" ? eventIdInput(draft.target) : null;
  const memberKey =
    draft.action !== "delete" ? (draft.member?.pubkey ?? null) : null;
  const fence = `${context.signer} ${context.origin} ${host}`;
  const memberLookup = useLookup(
    memberKey
      ? { route: "getMember", communityHost: host, pubkey: memberKey }
      : null,
    memberKey && `${fence} member ${memberKey}`,
  );
  const previewLookup = useLookup(
    eventId ? { route: "getEvent", communityHost: host, id: eventId } : null,
    eventId && `${fence} event ${eventId}`,
  );
  const member = memberLookup?.read ?? null;
  const preview = previewLookup?.read ?? null;
  const active = draft.action === "delete" ? previewLookup : memberLookup;
  const lookup: Read<unknown> | null = active?.read ?? null;
  const problems = draft.checked ? validate(draft, eventId) : {};
  const blocked =
    draft.action !== "delete" && member?.state === "ok" && member.value.isStaff
      ? staffCopy()
      : null;

  if (c.frozen && c.frozen.intent.communityHost !== host)
    return (
      <div className="flex flex-col gap-2 text-body-sm">
        <p>
          {t("furs.finishPending", { host: c.frozen.intent.communityHost })}
        </p>
        <ConfirmStep readOnly />
      </div>
    );

  const locked = !!c.frozen || c.submitting || !canMutate;
  // While an action is held, its fields show the held intent, not the draft.
  const intent = c.frozen?.intent;
  const shown = intent
    ? {
        action: intent.action,
        target: intent.target,
        member:
          intent.action === "delete"
            ? null
            : {
                pubkey: intent.target,
                name: c.frozen?.name ?? null,
                ...(c.frozen?.keyLabel ? { keyLabel: c.frozen.keyLabel } : {}),
              },
        secs: intent.action === "timeout" ? String(intent.expirationSecs) : "",
        reason: intent.reason ?? "",
      }
    : draft;
  const review = () => {
    set({ checked: true });
    if (Object.keys(validate(draft, eventId)).length > 0) return;
    if (lookup?.state !== "ok" || blocked) return;
    const target = eventId ?? memberKey ?? "";
    const reason = draft.reason.trim();
    c.review(
      {
        community,
        name: draft.member?.name ?? null,
        keyLabel: draft.member?.keyLabel ?? null,
        member: member?.state === "ok" ? member.value : null,
        preview: preview?.state === "ok" ? preview.value : null,
      },
      {
        communityHost: host,
        action: draft.action,
        target,
        ...(reason ? { reason } : {}),
        ...(draft.action === "timeout"
          ? { expirationSecs: Number(draft.secs) }
          : {}),
      },
    );
  };
  const error = c.errorFor(host);

  return (
    <div className="flex flex-col gap-3">
      <Field label={t("furs.actionField")} nativeLabel={false}>
        <RadioGroup<Action>
          name={`direct-action-${host}`}
          value={shown.action}
          disabled={locked}
          onValueChange={(action) => set({ action })}
        >
          {ACTIONS.map((action) => (
            <Radio key={action} value={action} label={actionLabel(action)} />
          ))}
        </RadioGroup>
      </Field>
      {shown.action === "delete" ? (
        <Field
          label={t("furs.eventIdField")}
          description={t("furs.eventIdHint")}
          error={problems.target}
        >
          <Input
            disabled={locked}
            value={shown.target}
            onChange={(event) => set({ target: event.target.value })}
          />
        </Field>
      ) : (
        <MemberPicker
          communityHost={host}
          disabled={locked}
          member={shown.member}
          error={problems.member}
          onChange={(picked) => set({ member: picked })}
        />
      )}
      {!c.frozen && member?.state === "ok" && draft.action !== "delete" && (
        <MemberState member={member.value} />
      )}
      {!c.frozen && preview?.state === "ok" && draft.action === "delete" && (
        <EventPreview event={preview.value} />
      )}
      {!c.frozen && active && (
        <LookupFailure
          key={active.key}
          read={active.read}
          reload={active.reload}
        />
      )}
      {!c.frozen && blocked && (
        <p className="text-body-sm text-danger" role="alert">
          {blocked}
        </p>
      )}
      {shown.action === "timeout" && (
        <Field label={t("furs.durationSeconds")} error={problems.secs}>
          <Input
            type="number"
            disabled={locked}
            value={shown.secs}
            onChange={(event) => set({ secs: event.target.value })}
          />
        </Field>
      )}
      <Field
        label={t("furs.reasonOptional")}
        description={reasonAudience(shown.action)}
        error={problems.reason}
      >
        <Input
          disabled={locked}
          value={shown.reason}
          onChange={(event) => set({ reason: event.target.value })}
        />
      </Field>
      {error && (
        <p className="text-body-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {c.frozen ? (
        <ConfirmStep />
      ) : (
        <div>
          <Button
            size="sm"
            disabled={
              !canMutate ||
              c.submitting ||
              (lookup !== null && lookup.state !== "ok") ||
              blocked !== null
            }
            onClick={review}
          >
            {t("furs.review")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The reviewed intent, leading with its community. */
function ConfirmStep({ readOnly = false }: { readOnly?: boolean }) {
  useLanguage();
  const { canMutate } = useSession();
  const c = useController();
  if (!c.frozen) return null;
  const { intent, community, name, keyLabel, member, preview } = c.frozen;
  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-2 text-body-sm">
      <p className="flex flex-wrap items-center gap-1.5">
        {t("furs.in")}{" "}
        <CommunityBadge id={community.id} host={community.host} />
        <NotConnected host={intent.communityHost} />
      </p>
      <p>
        {t("furs.actionLead", { action: actionLabel(intent.action) })}{" "}
        {intent.action === "delete" ? (
          <code className="break-all">{intent.target}</code>
        ) : (
          <PersonName pubkey={intent.target} name={name} label={keyLabel} />
        )}
        {intent.expirationSecs
          ? t("furs.forSeconds", { secs: intent.expirationSecs })
          : ""}
        ?
      </p>
      {intent.action !== "delete" && (
        <code className="break-all font-mono text-caption text-secondary">
          {npubEncode(intent.target)}
        </code>
      )}
      {member && <MemberState member={member} />}
      {preview && <EventPreview event={preview} />}
      <p>
        {t("furs.reasonLine", { reason: intent.reason ?? t("furs.noReason") })}
      </p>
      {c.pending && (
        <p className="text-secondary" role="status">
          {t("furs.stillApplying")}
        </p>
      )}
      <div className="flex gap-1.5">
        {!readOnly && (
          <Button
            size="sm"
            variant="destructive"
            loading={c.submitting}
            disabled={!canMutate}
            onClick={c.confirm}
          >
            {c.errorFor(intent.communityHost) || c.pending
              ? t("adminStaff.retry")
              : t("furs.confirm")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={c.submitting}
          onClick={c.discard}
        >
          {t("furs.discard")}
        </Button>
      </div>
    </div>
  );
}

const label = (m: MemberSearchDto) => m.displayName || m.nip05 || null;

/**
 * Search the community's profiles (including former members), or paste an
 * npub or hex key. A pasted secret key never leaves the device.
 */
export function MemberPicker({
  communityHost,
  disabled,
  member,
  error,
  onChange,
}: {
  communityHost: string;
  disabled: boolean;
  member: Member | null;
  /** Why the form still needs a member, shown on the search field. */
  error?: string | undefined;
  onChange(member: Member | null): void;
}) {
  useLanguage();
  const { context } = useSession();
  const [query, setQuery] = useState("");
  /** Results open as they arrive; Escape or a click away closes them. */
  const [dismissed, setDismissed] = useState(false);
  const typed = query.trim();
  const q = useDebounced(typed);
  const secret = containsSecretKey(query);
  const pasted = typedPublicKey(typed);
  const searching = searchable(q) && q === typed && !secret && !pasted;
  const [results, reload] = useRead(
    searching ? { route: "searchMembers", communityHost, q } : null,
    [context, communityHost, searching ? q : null],
  );

  const candidates: Member[] = pasted
    ? [{ pubkey: pasted, name: null }]
    : searching && results.state === "ok"
      ? results.value.items.map((m) => ({ pubkey: m.pubkey, name: label(m) }))
      : [];
  const people = usePeople(candidates.map((candidate) => candidate.pubkey));
  const failed = searching && results.state === "failed";
  const retry = useRetry(
    failed ? results.failure : null,
    results.settled,
    reload,
  );

  if (member)
    return (
      <div className="flex items-center gap-2 text-body-sm">
        <PersonName
          pubkey={member.pubkey}
          name={member.name}
          label={member.keyLabel}
        />
        <Button
          size="sm"
          variant="link"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          {t("furs.change")}
        </Button>
      </div>
    );
  return (
    <PeopleScope people={people}>
      <Combobox.Root<Member>
        disabled={disabled}
        items={candidates}
        filteredItems={candidates}
        value={null}
        open={candidates.length > 0 && !dismissed}
        onOpenChange={(open) => setDismissed(!open)}
        inputValue={query}
        modal={false}
        itemToStringLabel={(candidate) => people.text(candidate.pubkey)}
        isItemEqualToValue={(a, b) => a.pubkey === b.pubkey}
        onInputValueChange={(next, details) => {
          if (
            details.reason === "input-change" ||
            details.reason === "input-clear"
          ) {
            setQuery(next);
            setDismissed(false);
          }
        }}
        onValueChange={(picked) => {
          if (!picked) return;
          onChange({ ...picked, keyLabel: people.label(picked.pubkey) });
          setQuery("");
        }}
      >
        <Combobox.Control
          label={t("furs.member")}
          triggerLabel={t("furs.showMembers")}
          loading={searching && results.state === "loading"}
          placeholder={t("furs.memberPlaceholder")}
          error={
            secret
              ? secretKeyWarning()
              : searching && retry.failure
                ? lookupFailure(retry.failure)
                : error
          }
        />
        <Combobox.Popup empty={t("furs.noMembers")}>
          <Combobox.List>
            {(candidate: Member) => (
              <Combobox.Item key={candidate.pubkey} value={candidate}>
                <PersonName
                  pubkey={candidate.pubkey}
                  name={candidate.name}
                  label={people.label(candidate.pubkey)}
                />
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
      {searching && retry.failure && (
        <div>
          <Button size="sm" loading={retry.retrying} onClick={retry.retry}>
            {t("furs.retrySearch")}
          </Button>
        </div>
      )}
    </PeopleScope>
  );
}

/** Members section: pick someone, then ban or time them out from Actions. */
export function MembersSection({
  communityHost,
  onAct,
}: {
  communityHost: string;
  onAct(): void;
}) {
  useLanguage();
  const { canMutate } = useSession();
  const c = useController();
  const [member, setMember] = useState<Member | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <MemberPicker
        communityHost={communityHost}
        disabled={false}
        member={member}
        onChange={setMember}
      />
      {member && (
        <div className="flex gap-1.5">
          {(["ban", "timeout"] as const).map((action) => (
            <Button
              key={action}
              size="sm"
              variant="outline"
              disabled={!canMutate || !!c.frozen}
              onClick={() => {
                c.setDraft({ ...emptyDraft(communityHost), action, member });
                onAct();
              }}
            >
              {action === "ban" ? t("furs.ban") : t("furs.timeOut")}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
