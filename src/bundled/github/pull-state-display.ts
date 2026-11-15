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

/** Render-only PR wording; inputs and the canonical English producer stay unchanged. */
export function displayPull(read: Read): string {
  return t(pullKey("pull", read));
}

/** The linked pull request launcher's label, as `displayPull` words it. */
export function displayPullLauncher(read: Read): string {
  return t(pullKey("launcher", read));
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
