import { t } from "../../shared/i18n";
import { en } from "../../shared/i18n/catalogs/workflow-form";
import type { WorkflowDraftIssue } from "./editor-model";

const DRAFT_MESSAGES = [
  [undefined, "workflowForm.draft.tooLarge"],
  [undefined, "workflowForm.draft.yaml"],
  [undefined, "workflowForm.draft.object"],
  ["name", "workflowForm.draft.name"],
  [undefined, "workflowForm.draft.enabled"],
  [undefined, "workflowForm.draft.trigger"],
  [undefined, "workflowForm.draft.noSteps"],
  [undefined, "workflowForm.draft.maxSteps"],
  [undefined, "workflowForm.draft.ids"],
  [undefined, "workflowForm.draft.action"],
  ["timeout", "workflowForm.draft.timeout"],
  ["text", "workflowForm.draft.text"],
  ["url", "workflowForm.draft.url"],
  ["headers", "workflowForm.draft.headers"],
  ["duration", "workflowForm.draft.duration"],
] as const;

/** Displays only the finite app-owned draftIssue result; never pass opaque errors. */
export function displayWorkflowDraftIssue(
  issue: WorkflowDraftIssue | null | undefined,
): string | null | undefined {
  if (issue == null) return issue;
  const match = DRAFT_MESSAGES.find(
    ([field, key]) => issue.field === field && issue.message === en[key],
  );
  return match ? t(match[1]) : issue.message;
}
