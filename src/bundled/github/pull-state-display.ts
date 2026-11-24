import { t } from "../../shared/i18n";
import { issueState, type describePull } from "./pull-state-view";

type Read = Parameters<typeof describePull>[0];

function pullKey<P extends "pull" | "launcher">(prefix: P, read: Read) {
  const state = read.state;
  if (read.failed) return `githubPullLinks.${prefix}.unavailable` as const;
  if (!state) return `githubPullLinks.${prefix}.unknown` as const;
  if (state.state === "merged" || state.state === "closed")
    return `githubPullLinks.${prefix}.${state.state}` as const;
  const checks =
    state.checks === "failure" || state.checks === "pending"
      ? state.checks
      : "none";
  return state.conflicts
    ? (`githubPullLinks.${prefix}.${state.state}.${checks}.conflicts` as const)
    : (`githubPullLinks.${prefix}.${state.state}.${checks}` as const);
}

/** Puts an open or draft pull request's review right after its state, as
 * `describePull` lists it: the plain state's wording is the full one's start. */
function withReview(word: (read: Read) => string, read: Read) {
  const full = word(read);
  const review = read.state?.review;
  if (!review || read.failed) return full;
  if (read.state?.state !== "open" && read.state?.state !== "draft")
    return full;
  const plain = word({
    ...read,
    state: { ...read.state, checks: undefined, conflicts: false },
  });
  const note = t(
    review === "approved"
      ? "v106ag.gh.review.approved"
      : "v106ag.gh.review.changesRequested",
  );
  return full.startsWith(plain)
    ? `${plain}, ${note}${full.slice(plain.length)}`
    : `${full}, ${note}`;
}

/** Render-only PR wording; inputs and the canonical English producer stay unchanged. */
export function displayPull(read: Read): string {
  return withReview((value) => t(pullKey("pull", value)), read);
}

/** The linked pull request launcher's label, as `displayPull` words it. */
export function displayPullLauncher(read: Read): string {
  return withReview((value) => t(pullKey("launcher", value)), read);
}

/** Render-only issue wording, as `describeIssue` words it in English. */
export function displayIssue(read: Read): string {
  if (read.failed) return t("githubPullLinks.issue.unavailable");
  if (!read.state) return t("githubPullLinks.issue.unknown");
  const shown = issueState(read.state);
  return t(
    shown === "open"
      ? "githubPullLinks.issue.open"
      : shown === "completed"
        ? "githubPullLinks.issue.completed"
        : "githubPullLinks.issue.notPlanned",
  );
}
