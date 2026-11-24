import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  CaretDownIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  DotsThreeIcon,
  GitMergeIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "../../shared/design-system/icons/index";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import {
  MenuItem,
  MenuPopup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import inlineStyles from "../../shared/InlineReference.module.css";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import type { CheckSummary } from "./checks";
import type { GitHubDetails } from "./data";
import type { GitHubCli } from "./gh";
import { readable } from "./object";
import {
  changePull,
  mergeLabel,
  type MergeMethod,
  type PullAction,
  type PullChecklist as Checklist,
} from "./pull";
import styles from "./GitHub.module.css";
import { t, useLanguage } from "../../shared/i18n";
import { rich } from "../../shared/i18n/rich";

type Tone = "success" | "failure" | "pending" | "neutral";
const toneIcons = {
  success: CheckCircleIcon,
  failure: XCircleIcon,
  pending: WarningCircleIcon,
  neutral: CircleDashedIcon,
};

function Row({
  tone,
  label,
  action,
  details,
  children,
}: {
  tone: Tone;
  label: string;
  action?: ReactNode;
  details?: ReactNode;
  children: ReactNode;
}) {
  const Icon = toneIcons[tone];
  return (
    <li
      className={styles.checklistRow}
      data-tone={tone}
      data-action={!!action || undefined}
    >
      <Icon size={16} aria-hidden="true" />
      <span className={styles.checklistLabel}>{label}</span>
      <div className={styles.checklistContent}>
        <span className={styles.checklistValue}>{children}</span>
        {details}
        {action && <span className={styles.checklistAction}>{action}</span>}
      </div>
    </li>
  );
}

const names = (people: readonly string[]) =>
  people.length > 3
    ? t("v1wf.gh.namesMore", {
        names: people.slice(0, 2).join(", "),
        count: people.length - 2,
      })
    : people.join(", ");

function ChecksRow({
  checks,
  url,
  action,
}: {
  checks: CheckSummary;
  url: string;
  action?: ReactNode;
}) {
  const count = (category: string) =>
    checks.checks?.filter((check) => check.category === category).length ?? 0;
  const failing =
    checks.checks?.filter(
      (check) => check.category === "failing" || check.category === "cancelled",
    ) ?? [];
  const passed = count("successful");
  const running = count("pending");
  const tone: Tone =
    checks.state === "success"
      ? "success"
      : checks.state === "failure"
        ? "failure"
        : checks.state === "pending"
          ? "pending"
          : "neutral";
  const parts = [
    running && t("v1wf.gh.checksRunning", { count: running }),
    passed && t("v1wf.gh.checksPassed", { count: passed }),
    count("skipped") && t("v1wf.gh.checksSkipped", { count: count("skipped") }),
  ].filter(Boolean);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return (
    <Row
      tone={tone}
      label={t("v1wf.gh.checks")}
      action={action}
      details={
        expanded && failing.length > 0 ? (
          <div id={detailsId} className={styles.checklistDetails}>
            <ul aria-label={t("v1wf.gh.failedChecks")}>
              {failing.map((check) => (
                <li key={check.key}>
                  {check.url ? (
                    <a
                      className={inlineStyles.link}
                      href={check.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {check.name}
                    </a>
                  ) : (
                    check.name
                  )}
                  {check.description && <> — {check.description}</>}
                </li>
              ))}
            </ul>
            <a
              className={inlineStyles.link}
              href={`${url}/checks`}
              target="_blank"
              rel="noreferrer"
            >
              {t("v1wf.gh.viewAllChecks")}
            </a>
          </div>
        ) : undefined
      }
    >
      {checks.state === "unavailable" && !failing.length ? (
        t("v1wf.gh.checksPartial")
      ) : !checks.checks?.length ? (
        t("v1wf.gh.noChecks")
      ) : failing.length ? (
        <Button
          variant="plain"
          size="inline"
          aria-expanded={expanded}
          aria-controls={expanded ? detailsId : undefined}
          onClick={() => setExpanded(!expanded)}
        >
          {[
            t("v1wf.gh.checksFailed", { count: failing.length }),
            ...parts,
          ].join(" · ")}
          {expanded ? (
            <CaretDownIcon size={14} />
          ) : (
            <CaretRightIcon size={14} />
          )}
        </Button>
      ) : !running && passed ? (
        [
          t("v1wf.gh.checksAllPassed", { count: passed }),
          count("skipped") &&
            t("v1wf.gh.checksSkipped", { count: count("skipped") }),
        ]
          .filter(Boolean)
          .join(" · ")
      ) : (
        parts.join(" · ")
      )}
    </Row>
  );
}

function ReviewRow({ review }: { review: Checklist["review"] }) {
  if (review.decision === "CHANGES_REQUESTED")
    return (
      <Row tone="failure" label={t("v1wf.gh.review")}>
        {t("v1wf.gh.changesRequestedBy", { names: names(review.changes) })}
      </Row>
    );
  // GitHub's decision comes first: an approval can still leave a required
  // review (a code owner, or a second approver) outstanding.
  if (review.decision === "REVIEW_REQUIRED")
    return (
      <Row tone="pending" label={t("v1wf.gh.review")}>
        {t("v1wf.gh.reviewRequired")}
        {!!review.approved.length &&
          ` · ${t("v1wf.gh.approvedByLower", { names: names(review.approved) })}`}
        {!!review.waiting.length &&
          ` · ${t("v1wf.gh.waitingOnLower", { names: names(review.waiting) })}`}
      </Row>
    );
  if (review.decision === "APPROVED" || review.approved.length)
    return (
      <Row tone="success" label={t("v1wf.gh.review")}>
        {t("v1wf.gh.approvedBy", { names: names(review.approved) })}
      </Row>
    );
  return (
    <Row tone="neutral" label={t("v1wf.gh.review")}>
      {review.waiting.length
        ? t("v1wf.gh.waitingOn", { names: names(review.waiting) })
        : t("v1wf.gh.reviewNotRequired")}
    </Row>
  );
}

function MergeRow({ pull, action }: { pull: Checklist; action?: ReactNode }) {
  const base = <span className={styles.branchLabel}>{pull.base}</span>;
  const [tone, text]: [Tone, ReactNode] = (() => {
    if (pull.queued) return ["pending", rich("v1wf.gh.queuedInto", { base })];
    switch (pull.merge) {
      case "CLEAN":
      case "HAS_HOOKS":
        return ["success", rich("v1wf.gh.readyInto", { base })];
      case "UNSTABLE":
        return ["success", rich("v1wf.gh.canMergeOptionalFailed", { base })];
      case "BLOCKED":
        return [
          "pending",
          <>
            {rich("v1wf.gh.blockedByRules", { base })}
            {pull.canBypass &&
              !pull.queueRequired &&
              ` · ${t("v1wf.gh.canBypass")}`}
          </>,
        ];
      case "BEHIND":
        return ["pending", rich("v1wf.gh.behind", { base })];
      case "DIRTY":
        return ["failure", rich("v1wf.gh.conflicts", { base })];
      case "DRAFT":
        return ["neutral", t("v1wf.gh.draftCantMerge")];
      default:
        return ["neutral", t("v1wf.gh.stillChecking")];
    }
  })();
  return (
    <Row tone={tone} label={t("v1wf.gh.mergeLabel")} action={action}>
      {text}
    </Row>
  );
}

/** Whether the merge button can merge now, and whether that bypasses rules. */
function mergeability(pull: Checklist) {
  if (pull.state !== "open" || pull.queued)
    return { now: false, bypass: false };
  // A queue-required branch can report BLOCKED until enqueued; GitHub
  // validates its prerequisites when accepting the enqueue request. Missing
  // reviews and unfinished or failing checks would be rejected, so those wait
  // for auto-merge to enqueue instead, as do checks that could not be read
  // and unresolved conversations (the branch may require resolving them).
  if (pull.queueRequired) {
    const waiting =
      pull.review.decision === "REVIEW_REQUIRED" ||
      pull.review.decision === "CHANGES_REQUESTED" ||
      pull.checks.state === "failure" ||
      pull.checks.state === "pending" ||
      pull.checks.state === "unavailable" ||
      pull.unresolved > 0 ||
      pull.moreThreads;
    return {
      now:
        ["CLEAN", "HAS_HOOKS", "UNSTABLE"].includes(pull.merge) ||
        (["BLOCKED", "BEHIND"].includes(pull.merge) && !waiting),
      bypass: false,
    };
  }
  if (["CLEAN", "HAS_HOOKS", "UNSTABLE"].includes(pull.merge))
    return { now: true, bypass: false };
  if (["BLOCKED", "BEHIND"].includes(pull.merge) && pull.canBypass)
    return { now: true, bypass: true };
  return { now: false, bypass: false };
}

function Actions({
  pull,
  number,
  title,
  gh,
  refresh,
}: {
  pull: Checklist;
  number: string;
  title: string;
  gh: GitHubCli;
  refresh(): Promise<void>;
}) {
  const [busy, setBusy] = useState<PullAction["type"]>();
  const [error, setError] = useState<string>();
  // What the merge was confirmed against. A refresh that brings a newer push,
  // a new base branch, or a change in whether the merge bypasses branch rules
  // closes the dialog, and the merge itself names the confirmed head.
  const [asked, setConfirming] =
    useState<
      Readonly<{
        method: MergeMethod;
        head: string;
        base: string;
        bypass: boolean;
        queue: boolean;
      }>
    >();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run(action: PullAction, head = pull.head) {
    setBusy(action.type);
    setError(undefined);
    try {
      await changePull(gh, { id: pull.id, head }, action);
      await refresh();
      if (alive.current) setConfirming(undefined);
    } catch (failure) {
      if (alive.current) setError(readable(failure).message);
    } finally {
      if (alive.current) setBusy(undefined);
    }
  }
  const merge = mergeability(pull);
  // A new confirmation starts without an earlier action's error.
  const confirm = (method: MergeMethod) => {
    setError(undefined);
    setConfirming({
      method,
      head: pull.head,
      base: pull.base,
      bypass: merge.bypass,
      queue: pull.queueRequired,
    });
  };
  const confirming =
    merge.now &&
    asked?.head === pull.head &&
    asked.base === pull.base &&
    asked.bypass === merge.bypass &&
    asked.queue === pull.queueRequired
      ? asked
      : undefined;
  // Forgotten during render, so changing back does not reopen it.
  if (asked && !confirming) setConfirming(undefined);
  const canAutoMerge =
    !pull.queued &&
    pull.canEnableAutoMerge &&
    !pull.autoMerge &&
    pull.state === "open" &&
    !["CLEAN", "HAS_HOOKS", "DIRTY", "UNKNOWN"].includes(pull.merge);
  const others =
    pull.queueRequired || pull.queued
      ? []
      : pull.methods.filter((method) => method !== pull.method);
  const menu = [
    ...(merge.now
      ? others.map((method) => (
          <MenuItem key={method} onClick={() => confirm(method)}>
            {mergeLabel(method)}
          </MenuItem>
        ))
      : []),
    // A queue branch that can be queued already has its one way in.
    ...(canAutoMerge && merge.now && !pull.queueRequired
      ? [
          <MenuItem
            key="auto"
            onClick={() =>
              void run({ type: "auto-merge", method: pull.method })
            }
          >
            {t("v1wf.gh.autoMergeWhenReady")}
          </MenuItem>,
        ]
      : []),
    ...(pull.state === "open" && pull.canUpdate
      ? [
          ...(merge.now || canAutoMerge ? [<MenuSeparator key="split" />] : []),
          <MenuItem key="draft" onClick={() => void run({ type: "draft" })}>
            {t("v1wf.gh.convertToDraft")}
          </MenuItem>,
        ]
      : []),
  ];
  return (
    <>
      <div className={styles.pullActions}>
        {pull.state === "draft" && pull.canUpdate && (
          <Button
            variant="prominent"
            size="sm"
            loading={busy === "ready"}
            disabled={!!busy}
            onClick={() => void run({ type: "ready" })}
          >
            {t("v1wf.gh.readyForReview")}
          </Button>
        )}
        {pull.queued ? (
          <span className={styles.pullActionNote}>
            {t("v1wf.gh.queuedForMerge")}
          </span>
        ) : pull.autoMerge ? (
          <>
            <span className={styles.pullActionNote}>
              {/* GitHub enqueues a queue branch's pull request, not merges it. */}
              {pull.queueRequired
                ? t("v106ag.gh.joinsQueueWhenReady")
                : t("v1wf.gh.mergesWhenReady")}
              {pull.autoMerge.by &&
                ` · ${t("v1wf.gh.setBy", { name: pull.autoMerge.by })}`}
            </span>
            {pull.canDisableAutoMerge && (
              <Button
                size="sm"
                loading={busy === "cancel-auto-merge"}
                disabled={!!busy}
                onClick={() => void run({ type: "cancel-auto-merge" })}
              >
                {t("v1wf.gh.cancel")}
              </Button>
            )}
          </>
        ) : merge.now ? (
          <Button
            variant={merge.bypass ? "attention" : "prominent"}
            size="sm"
            disabled={!!busy}
            onClick={() => confirm(pull.method)}
          >
            {pull.queueRequired
              ? t("v1wf.gh.queueForMerge")
              : mergeLabel(pull.method)}
          </Button>
        ) : (
          canAutoMerge && (
            <Button
              variant="prominent"
              size="sm"
              loading={busy === "auto-merge"}
              disabled={!!busy}
              onClick={() =>
                void run({ type: "auto-merge", method: pull.method })
              }
            >
              {t("v1wf.gh.mergeWhenReady")}
            </Button>
          )
        )}
        {pull.merge === "BEHIND" && pull.canUpdateBranch && (
          <Button
            size="sm"
            loading={busy === "update-branch"}
            disabled={!!busy}
            onClick={() => void run({ type: "update-branch" })}
          >
            {t("v1wf.gh.updateBranch")}
          </Button>
        )}
        {!!menu.length && (
          <MenuRoot>
            <MenuTrigger
              render={
                <IconButton
                  aria-label={t("v1wf.gh.moreActions")}
                  size="sm"
                  icon={<DotsThreeIcon />}
                  disabled={!!busy}
                />
              }
            />
            <MenuPopup align="end">{menu}</MenuPopup>
          </MenuRoot>
        )}
      </div>
      {error && !confirming && (
        <p role="alert" className={styles.pullActionError}>
          {error}
        </p>
      )}
      {confirming && (
        <AlertDialog
          title={t("v1wf.gh.confirmTitle", {
            action: confirming.queue
              ? t("v1wf.gh.queueForMerge")
              : mergeLabel(confirming.method),
            number,
          })}
          description={
            confirming.queue
              ? t("v1wf.gh.confirmQueue", { title, base: pull.base })
              : confirming.bypass
                ? t("v1wf.gh.confirmBypass", { title, base: pull.base })
                : t("v1wf.gh.confirmMerge", { title, base: pull.base })
          }
          pending={busy === "merge" || busy === "enqueue"}
          onClose={() => {
            setConfirming(undefined);
            setError(undefined);
          }}
          actions={
            <>
              <Button
                disabled={busy === "merge" || busy === "enqueue"}
                onClick={() => {
                  setConfirming(undefined);
                  setError(undefined);
                }}
              >
                {t("v1wf.gh.cancel")}
              </Button>
              <Button
                variant={confirming.bypass ? "attention" : "prominent"}
                loading={busy === "merge" || busy === "enqueue"}
                onClick={() =>
                  void run(
                    confirming.queue
                      ? { type: "enqueue" }
                      : { type: "merge", method: confirming.method },
                    confirming.head,
                  )
                }
              >
                {confirming.queue
                  ? t("v1wf.gh.queueForMerge")
                  : t("v1wf.gh.mergeLabel")}
              </Button>
            </>
          }
        >
          {error && (
            <p role="alert" className={styles.pullActionError}>
              {error}
            </p>
          )}
        </AlertDialog>
      )}
    </>
  );
}

/** The pull request's state as a short checklist, with the actions that
 * move it on: what someone needs when their agents read the details. */
export function PullChecklist({
  url,
  details,
  checklist,
  gh,
  refresh,
  resolveAction,
}: {
  url: string;
  details: GitHubDetails;
  checklist: Checklist;
  gh: GitHubCli;
  refresh(): Promise<void>;
  resolveAction?: ((action: "failures" | "conflicts") => ReactNode) | undefined;
}) {
  useLanguage();
  if (checklist.state === "merged" || checklist.state === "closed")
    return (
      <ul className={styles.checklist} aria-label={t("v1wf.gh.pullState")}>
        {checklist.state === "merged" ? (
          <li className={styles.checklistRow} data-tone="merged">
            <GitMergeIcon size={16} aria-hidden="true" />
            <span className={styles.checklistValue}>
              {rich("v1wf.gh.mergedInto", {
                base: (
                  <span className={styles.branchLabel}>{checklist.base}</span>
                ),
              })}
              {details.mergedBy &&
                ` ${t("v1wf.gh.byName", { name: details.mergedBy })}`}
              {details.mergedAt &&
                ` ${relativeTimestamp(Date.parse(details.mergedAt) / 1000)}`}
            </span>
          </li>
        ) : (
          <Row tone="neutral" label={t("v1wf.gh.closed")}>
            {t("v1wf.gh.withoutMerging")}
          </Row>
        )}
      </ul>
    );
  return (
    <>
      <ul className={styles.checklist} aria-label={t("v1wf.gh.pullChecklist")}>
        <ChecksRow
          checks={checklist.checks}
          url={url}
          action={
            checklist.checks.state === "failure" ||
            checklist.checks.checks?.some((check) =>
              ["failing", "cancelled"].includes(check.category),
            )
              ? resolveAction?.("failures")
              : undefined
          }
        />
        <ReviewRow review={checklist.review} />
        <Row
          tone={
            checklist.unresolved || checklist.moreThreads
              ? "pending"
              : "success"
          }
          label={t("v1wf.gh.threads")}
        >
          {checklist.unresolved || checklist.moreThreads ? (
            <a
              className={inlineStyles.link}
              href={`${url}/files`}
              target="_blank"
              rel="noreferrer"
            >
              {checklist.moreThreads
                ? t("v1wf.gh.unresolvedLatest", {
                    count: checklist.unresolved,
                  })
                : t("v1wf.gh.unresolved", { count: checklist.unresolved })}
            </a>
          ) : (
            t("v1wf.gh.noneUnresolved")
          )}
        </Row>
        <MergeRow
          pull={checklist}
          action={
            checklist.merge === "DIRTY"
              ? resolveAction?.("conflicts")
              : undefined
          }
        />
      </ul>
      <Actions
        pull={checklist}
        number={url.split("/").at(-1) ?? ""}
        title={details.title}
        gh={gh}
        refresh={refresh}
      />
    </>
  );
}

/** Without `gh`, only CI can be read for the checklist, from the public API,
 * as the store reads the rest of the pull request. */
export function PublicChecklist({
  url,
  sha,
  checks,
}: {
  url: string;
  sha: string | undefined;
  checks: CheckSummary | undefined;
}) {
  useLanguage();
  return (
    <ul className={styles.checklist} aria-label={t("v1wf.gh.pullChecklist")}>
      {checks ? (
        <ChecksRow checks={checks} url={url} />
      ) : (
        <Row tone="neutral" label={t("v1wf.gh.checks")}>
          {sha ? t("v1wf.gh.loading") : t("v1wf.gh.unavailable")}
        </Row>
      )}
    </ul>
  );
}
