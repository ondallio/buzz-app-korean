import { useEffect, useState } from "react";
import { t, useLanguage, type TranslationKey } from "../../shared/i18n";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { Radio, RadioGroup } from "../../shared/design-system/ui/RadioGroup";
import { Select } from "../../shared/design-system/ui/Select";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import {
  ArrowLeftIcon,
  CircleNotchIcon,
} from "../../shared/design-system/icons";
import type {
  ActionRecordDto,
  ReportAction,
  ReportDetailDto,
  ReportDto,
  ReportResolution,
  StaffOutcome,
  StaffRequest,
} from "../../features/relay-staff/contract";
import { unresolved } from "../../features/relay-staff/contract";
import {
  NamesSource,
  Person,
  PeopleScope,
  PersonName,
  usePeople,
} from "./people";
import { describe, useWrite, useRead, useSession } from "./session";
import {
  CommunityBadge,
  containsSecretKey,
  GroupedList,
  listButton,
  Loaded,
  NotConnected,
  Row,
  secretKeyWarning,
  time,
} from "./ui";

const LABEL_KEYS = {
  delete: "furs.action.delete",
  kick: "furs.action.kick",
  ban: "furs.action.ban",
  timeout: "furs.action.timeout",
  dismiss: "furs.action.dismiss",
  escalate: "furs.action.escalate",
} as const satisfies Record<ReportAction, TranslationKey>;
const actionLabel = (action: ReportAction) => t(LABEL_KEYS[action]);

/** Where a reason is delivered, so staff know who reads it. */
export function reasonAudience(action: ReportAction) {
  if (action === "delete") return t("furs.audience.delete");
  if (action === "dismiss" || action === "escalate")
    return t("furs.audience.reporter");
  return t("furs.audience.affected");
}

/** Kick needs the report's channel; a blob can only be dismissed or escalated. */
function allowedActions(report: ReportDto): ReportAction[] {
  switch (report.targetKind.toLowerCase()) {
    case "event":
      return ["delete", "kick", "ban", "timeout", "dismiss", "escalate"].filter(
        (action) => action !== "kick" || report.channelId != null,
      ) as ReportAction[];
    case "pubkey":
      return ["ban", "timeout", "dismiss", "escalate"];
    default:
      return ["dismiss", "escalate"];
  }
}

function resolutionLabel(resolution: ReportResolution) {
  if (resolution.activeAction)
    return actionLabel(resolution.activeAction.action);
  if (resolution.status === "dismissed") return actionLabel("dismiss");
  if (resolution.status === "escalated") return actionLabel("escalate");
  return statusLabel(resolution.status);
}

function Target({ report }: { report: ReportDto }) {
  const kind = report.targetKind.toLowerCase();
  if (kind === "event")
    return report.targetAuthorPubkey ? (
      <>
        {t("furs.messageBy")} <PersonName pubkey={report.targetAuthorPubkey} />
      </>
    ) : (
      <>{t("furs.messageId", { id: report.target.slice(0, 12) })}</>
    );
  return kind === "pubkey" ? (
    <PersonName pubkey={report.target} />
  ) : (
    report.target
  );
}

/** The relay's maximum page; it returns no total and the list isn't paged. */
export const REPORT_LIMIT = 200;

const STATUS_KEYS = {
  open: "furs.reportStatus.open",
  processing: "furs.reportStatus.processing",
  resolved: "furs.reportStatus.resolved",
  dismissed: "furs.reportStatus.dismissed",
  escalated: "furs.reportStatus.escalated",
} as const satisfies Record<string, TranslationKey>;
const STATUSES = Object.keys(STATUS_KEYS) as (keyof typeof STATUS_KEYS)[];
function statusLabel(status: string) {
  return status in STATUS_KEYS
    ? t(STATUS_KEYS[status as keyof typeof STATUS_KEYS])
    : status;
}

export function Reports({ communityId }: { communityId?: string }) {
  useLanguage();
  const { context } = useSession();
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [list, reload] = useRead(
    {
      route: "listReports",
      // The relay's default is escalated-only; the console works the whole queue.
      query: {
        scope: "all",
        limit: REPORT_LIMIT,
        ...(communityId ? { communityId } : {}),
        ...(status ? { status: status as ReportDto["status"] } : {}),
      },
    },
    [context, communityId, status],
  );
  const people = usePeople(
    list.state === "ok"
      ? list.value.flatMap((report) => [
          report.reporterPubkey,
          report.targetKind.toLowerCase() === "pubkey" ? report.target : null,
          report.targetAuthorPubkey,
        ])
      : [],
  );

  if (selected)
    return (
      <ReportDetail
        id={selected}
        onBack={() => {
          // Returning to the list shows fresh statuses.
          setSelected(null);
          reload();
        }}
        onChanged={reload}
      />
    );
  return (
    <div className="flex flex-col gap-3">
      <Select
        label={t("furs.status")}
        variant="compact"
        value={status}
        groups={[
          {
            label: "",
            options: [
              { value: "", label: t("furs.allStatuses") },
              ...STATUSES.map((value) => ({
                value,
                label: statusLabel(value),
              })),
            ],
          },
        ]}
        onValueChange={setStatus}
      />
      <Loaded read={list} onRetry={reload}>
        {(reports) =>
          reports.length === 0 ? (
            <p className="text-body-sm text-secondary">{t("furs.noReports")}</p>
          ) : (
            <PeopleScope people={people}>
              <NamesSource />
              <GroupedList
                items={reports}
                limit={REPORT_LIMIT}
                headings={!communityId}
                render={(report) => (
                  <li key={report.id}>
                    <button
                      type="button"
                      className={listButton}
                      onClick={() => setSelected(report.id)}
                    >
                      <span className="block font-medium">
                        {report.reportType || t("furs.report")}
                      </span>
                      <span className="block truncate text-caption text-secondary">
                        {t("furs.reporterInline")}{" "}
                        <PersonName pubkey={report.reporterPubkey} /> ·{" "}
                        {t("furs.targetInline")} <Target report={report} />
                      </span>
                      <span className="flex items-center gap-1.5 text-caption text-secondary">
                        {statusLabel(report.status)}
                        {report.status === "processing" && (
                          <CircleNotchIcon className="animate-spin" />
                        )}
                      </span>
                      <span className="block text-caption text-secondary">
                        {time(report.createdAt)}
                      </span>
                    </button>
                  </li>
                )}
              />
            </PeopleScope>
          )
        }
      </Loaded>
    </div>
  );
}

type ResolveRequest = Extract<StaffRequest, { route: "resolveReport" }>;
type ReopenRequest = Extract<StaffRequest, { route: "reopenReport" }>;
type CancelRequest = Extract<StaffRequest, { route: "cancelReport" }>;

function ReportDetail({
  id,
  onBack,
  onChanged,
}: {
  id: string;
  onBack(): void;
  onChanged(): void;
}) {
  useLanguage();
  const { context, canMutate } = useSession();
  const [detail, reload] = useRead({ route: "getReport", id }, [context, id]);
  const notify = useToastNotification();
  const changed = () => {
    reload();
    onChanged();
  };
  // The detail, not the action forms, handles finished writes: a form is
  // gone once its action changes the report's status.
  const resolve = useWrite<ResolveRequest>(`resolve ${id}`, (outcome, sent) => {
    if (outcome.ok) {
      notify(
        t("furs.reportResolved", { action: resolutionLabel(outcome.value) }),
        "success",
      );
      return changed();
    }
    // Dismiss and Escalate carry no replay protection on the relay: a retry
    // after the report was reopened would close the new cycle too. Drop the
    // held request and ask for a fresh decision against the reloaded report.
    if (decisionOnly(sent.action) && unresolved(outcome)) {
      resolve.discard();
      notify(t("furs.decideAgain"), "error");
      return changed();
    }
    notify(describe(outcome.failure), "error");
    // A failure may follow a resolve that landed (a retry then conflicts) or
    // a recorded enforcement failure: show the report as it is now.
    changed();
  });
  // A reopen's 200 confirms the original reopen, not the current status: a
  // retry is answered `open` even if the report was resolved again since.
  // The reloaded report decides what to announce.
  const [reopened, setReopened] = useState<number | null>(null);
  const reopen = useWrite<ReopenRequest>(`reopen ${id}`, (outcome) => {
    if (outcome.ok) setReopened(detail.settled);
    else notify(describe(outcome.failure), "error");
    changed();
  });
  useEffect(() => {
    if (reopened === null || detail.state === "loading") return;
    // A failed reload keeps the confirmation for the next successful read.
    if (detail.settled <= reopened || detail.state !== "ok") return;
    setReopened(null);
    const now = detail.value.status;
    notify(
      now === "open" || now === "processing"
        ? t("furs.reportReopened")
        : t("furs.reopenedSince", { status: statusLabel(now) }),
      "success",
    );
  }, [reopened, detail, notify]);
  useWrite<CancelRequest>(`cancel ${id}`, (outcome) => {
    // A cancel proves the action it names landed and was undone; on `open`
    // the relay would reject that request id. Release the held resolve only
    // if it is that action: a newer resolve keeps its own uncertain outcome.
    const undone = outcome.ok ? outcome.value.activeAction?.requestId : null;
    if (undone) resolve.release(undone);
    notify(
      outcome.ok
        ? t("furs.enforcementCancelled")
        : t("furs.cancelRejected", { reason: describe(outcome.failure) }),
      outcome.ok ? "success" : "error",
    );
    changed();
  });
  // An enforcement resolve replays its request id only while the report is
  // `processing`; a reopen replays its original success even after the report
  // is resolved again. A held write whose report has moved on can only
  // conflict or answer without acting, so release it: a resolve once the
  // report is past processing, a reopen once it is open again. A resolve that
  // landed and whose report was reopened by someone else before we saw it
  // stays held, and its Retry keeps failing; Discard is the way out. Our own
  // Cancel and reopen releases it when the action it undid is that resolve.
  const status = detail.state === "ok" ? detail.value.status : null;
  const active = status === "open" || status === "processing";
  const releaseResolve =
    !!resolve.frozen && !resolve.busy && !!status && !active;
  const releaseReopen = !!reopen.frozen && !reopen.busy && active;
  const { discard: discardResolve } = resolve;
  const { discard: discardReopen } = reopen;
  useEffect(() => {
    if (releaseResolve) discardResolve();
  }, [releaseResolve, discardResolve]);
  useEffect(() => {
    if (releaseReopen) discardReopen();
  }, [releaseReopen, discardReopen]);
  return (
    <div className="flex flex-col gap-4">
      <Button size="sm" variant="ghost" onClick={onBack}>
        <ArrowLeftIcon /> {t("furs.backToReports")}
      </Button>
      <Loaded read={detail} onRetry={reload}>
        {(report) => (
          <>
            <ReportFields report={report} />
            {report.activeAction && (
              <Enforcement reportId={report.id} action={report.activeAction} />
            )}
            {/* A reopened report may carry succeeded history and still be open. */}
            {canMutate && report.status === "open" && (
              <Resolve key={report.id} report={report} />
            )}
            {canMutate &&
              ["resolved", "dismissed", "escalated"].includes(
                report.status,
              ) && <Reopen report={report} />}
          </>
        )}
      </Loaded>
    </div>
  );
}

function ReportFields({ report }: { report: ReportDetailDto }) {
  useLanguage();
  const people = usePeople([
    report.reporterPubkey,
    report.targetKind.toLowerCase() === "pubkey" ? report.target : null,
    report.targetAuthorPubkey,
    report.resolvedBy,
    report.message?.authorPubkey,
  ]);
  return (
    <PeopleScope people={people}>
      <div className="flex flex-col gap-1.5 rounded-md border px-3 py-2.5">
        <p className="mb-2 text-body-sm font-medium">
          {report.reportType} · {statusLabel(report.status)}
        </p>
        <Row label={t("furs.row.id")} mono>
          {report.id}
        </Row>
        <Row label={t("furs.row.community")}>
          <CommunityBadge id={report.communityId} host={report.communityHost} />
        </Row>
        <Row label={t("furs.row.eventId")} mono>
          {report.reportEventId}
        </Row>
        <Row label={t("furs.row.reporter")}>
          <Person pubkey={report.reporterPubkey} />
        </Row>
        <Row label={t("furs.row.targetKind")}>{report.targetKind}</Row>
        {report.targetKind.toLowerCase() === "pubkey" ? (
          <Row label={t("furs.row.target")}>
            <Person pubkey={report.target} />
          </Row>
        ) : (
          <Row label={t("furs.row.target")} mono>
            {report.target}
          </Row>
        )}
        <Row label={t("furs.row.channel")} mono>
          {report.channelId}
        </Row>
        <Row label={t("furs.row.note")}>{report.note}</Row>
        <Row label={t("furs.row.resolvedBy")}>
          {report.resolvedBy && <Person pubkey={report.resolvedBy} />}
        </Row>
        <Row label={t("furs.row.resolvedAt")}>{time(report.resolvedAt)}</Row>
        <Row label={t("furs.row.actionId")} mono>
          {report.actionId}
        </Row>
        <Row label={t("furs.row.created")}>{time(report.createdAt)}</Row>
        {report.message && (
          <div className="mt-3 flex flex-col gap-1.5 rounded-md border px-3 py-2.5">
            <p className="text-caption font-semibold text-secondary">
              {t("furs.reportedMessage")}
              {report.message.deletedAt && (
                <span className="ml-1.5 text-danger">{t("furs.deleted")}</span>
              )}
            </p>
            <Row label={t("furs.row.author")}>
              <Person pubkey={report.message.authorPubkey} />
            </Row>
            <Row label={t("furs.row.content")}>{report.message.content}</Row>
            <Row label={t("furs.row.sent")}>
              {time(report.message.createdAt)}
            </Row>
          </div>
        )}
        <NamesSource />
      </div>
    </PeopleScope>
  );
}

const ENFORCEMENT = {
  pending: "furs.enforcement.pending",
  enforcing: "furs.enforcement.enforcing",
  succeeded: "furs.enforcement.succeeded",
  failed: "furs.enforcement.failed",
  cancelled: "furs.enforcement.cancelled",
} as const satisfies Record<ActionRecordDto["status"], TranslationKey>;

/**
 * Only a failed action can be cancelled, which reopens the report. Pending
 * and enforcing actions belong to the relay's recovery worker.
 */
function Enforcement({
  reportId,
  action,
}: {
  reportId: string;
  action: ActionRecordDto;
}) {
  useLanguage();
  const { canMutate } = useSession();
  const write = useWrite<CancelRequest>(`cancel ${reportId}`);
  const cancel = () =>
    write.run({ route: "cancelReport", id: reportId, actionId: action.id });
  const message = action.errorMessage?.includes(
    "kick target was already absent",
  )
    ? t("furs.kickAbsent")
    : action.errorMessage;
  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-2.5 text-body-sm">
      <p className="flex items-center gap-2">
        {(action.status === "pending" || action.status === "enforcing") && (
          <CircleNotchIcon className="animate-spin" />
        )}
        {t(ENFORCEMENT[action.status])}
        <span className="font-mono text-caption text-secondary">
          {action.action}
        </span>
      </p>
      {message && <p className="text-caption text-secondary">{message}</p>}
      {action.status === "failed" && canMutate && (
        <Button size="sm" loading={write.busy} onClick={() => cancel()}>
          {t("furs.cancelAndReopen")}
        </Button>
      )}
    </div>
  );
}

function Resolve({ report }: { report: ReportDto }) {
  useLanguage();
  const write = useWrite<ResolveRequest>(`resolve ${report.id}`);
  const [action, setAction] = useState<ReportAction | null>(null);
  const [reason, setReason] = useState("");
  const [secs, setSecs] = useState("");
  const locked = write.frozen !== null || write.busy;
  const shown = write.frozen?.action ?? action;
  const secret = containsSecretKey(reason);
  const duration = Number(secs);
  const validDuration =
    action !== "timeout" || (Number.isInteger(duration) && duration > 0);

  const submit = () =>
    // A frozen request is resent as is; only a new action reads the form.
    write.run(
      action
        ? {
            route: "resolveReport",
            id: report.id,
            action,
            requestId: crypto.randomUUID(),
            ...(reason.trim() ? { reason: reason.trim() } : {}),
            ...(action === "timeout" ? { expirationSecs: duration } : {}),
          }
        : undefined,
    );

  return (
    <div className="flex flex-col gap-3 rounded-md border px-3 py-2.5">
      <Field label={t("furs.resolveReport")} nativeLabel={false}>
        <RadioGroup<ReportAction | null>
          name={`resolve-${report.id}`}
          value={shown}
          disabled={locked}
          onValueChange={setAction}
        >
          {allowedActions(report).map((option) => (
            <Radio key={option} value={option} label={actionLabel(option)} />
          ))}
        </RadioGroup>
      </Field>
      {shown === "timeout" && (
        <Field label={t("furs.durationSeconds")}>
          <Input
            placeholder={t("furs.durationPlaceholder")}
            type="number"
            min={1}
            disabled={locked}
            value={write.frozen?.expirationSecs?.toString() ?? secs}
            onChange={(event) => setSecs(event.target.value)}
          />
        </Field>
      )}
      <Field
        label={t("furs.reasonOptional")}
        description={shown ? reasonAudience(shown) : undefined}
        error={secret ? secretKeyWarning() : undefined}
      >
        <Input
          disabled={locked}
          value={write.frozen?.reason ?? reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {shown && (
        <>
          <p className="flex flex-wrap items-center gap-1.5 text-caption text-secondary">
            {t("furs.in")}{" "}
            <CommunityBadge
              id={report.communityId}
              host={report.communityHost}
            />
            <NotConnected host={report.communityHost} />
          </p>
          <Button
            size="sm"
            variant="prominent"
            loading={write.busy}
            disabled={!write.frozen && (secret || !validDuration)}
            onClick={() => submit()}
          >
            {t(write.frozen ? "furs.retryIn" : "furs.confirmIn", {
              action: actionLabel(shown),
              host: report.communityHost,
            })}
          </Button>
          {write.frozen && !write.busy && (
            <Button size="sm" variant="ghost" onClick={write.discard}>
              {t("furs.discard")}
            </Button>
          )}
          <WriteError write={write} />
        </>
      )}
    </div>
  );
}

/** Re-triage only: reopening never reverses enforcement already taken. */
function Reopen({ report }: { report: ReportDto }) {
  useLanguage();
  const write = useWrite<ReopenRequest>(`reopen ${report.id}`);
  const [reason, setReason] = useState("");
  const secret = containsSecretKey(reason);
  const submit = () =>
    write.run({
      route: "reopenReport",
      id: report.id,
      requestId: crypto.randomUUID(),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
  return (
    <div className="flex flex-col gap-3 rounded-md border px-3 py-2.5">
      <p className="text-caption font-medium text-secondary">
        {t("furs.reopenReport")}
      </p>
      <p className="text-caption text-secondary">
        {t("furs.reopenExplain")}{" "}
        {report.actionId
          ? t("furs.reopenKeepsAction")
          : t("furs.reopenNoReverse")}
      </p>
      <Field
        label={t("furs.reopenReason")}
        error={secret ? secretKeyWarning() : undefined}
      >
        <Input
          disabled={write.frozen !== null}
          value={write.frozen?.reason ?? reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <Button
        size="sm"
        loading={write.busy}
        disabled={!write.frozen && secret}
        onClick={() => submit()}
      >
        {write.frozen ? t("furs.retryReopen") : t("furs.reopenReport")}
      </Button>
      {write.frozen && !write.busy && (
        <Button size="sm" variant="ghost" onClick={write.discard}>
          {t("furs.discard")}
        </Button>
      )}
      <WriteError write={write} />
    </div>
  );
}

/** The last attempt's failure, beside its Retry, until another attempt starts. */
function WriteError({
  write,
}: {
  write: {
    held: { outcome: StaffOutcome<unknown> | null } | null;
    busy: boolean;
  };
}) {
  const outcome = write.held?.outcome;
  if (write.busy || !outcome || outcome.ok) return null;
  return (
    <p className="text-body-sm text-danger" role="alert">
      {describe(outcome.failure)}
    </p>
  );
}

/** Report decisions the relay applies without deduplicating `requestId`. */
function decisionOnly(action: ReportAction) {
  return action === "dismiss" || action === "escalate";
}
