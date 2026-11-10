import { useState } from "react";
import { t, useLanguage } from "../../shared/i18n";
import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { Button } from "../../shared/design-system/ui/Button";
import type {
  WorkflowDefinition,
  WorkflowDefinitions,
  WorkflowOperation,
  WorkflowView,
} from "../../features/workflows/types";
import { ConfirmAction } from "./ConfirmAction";
import { confirmedDeletion, deletionStatus } from "./editor-model";

export const messages = {
  save: {
    pending: "Saving configuration…",
    succeeded: "Configuration saved.",
    rejected: "Configuration was not saved.",
    unknown:
      "Save response was lost. Check the saved configuration before trying again.",
  },
  trigger: {
    pending: "Requesting a run…",
    succeeded: "Run requested. Inspect run history for its result.",
    rejected: "Failed to trigger workflow",
    unknown:
      "The run may have started, but its response was lost. Checking configuration or dismissing this notice cannot confirm a run.",
  },
} as const;

const statusKeys = {
  save: {
    pending: "workflowOperations.save.pending",
    succeeded: "workflowOperations.save.succeeded",
    rejected: "workflowOperations.save.rejected",
    unknown: "workflowOperations.save.unknown",
  },
  trigger: {
    pending: "workflowOperations.trigger.pending",
    succeeded: "workflowOperations.trigger.succeeded",
    rejected: "workflowOperations.trigger.rejected",
    unknown: "workflowOperations.trigger.unknown",
  },
} as const;
const actionKeys = {
  save: "workflowOperations.action.save",
  delete: "workflowOperations.action.delete",
  trigger: "workflowOperations.action.trigger",
} as const;
const outcomeKeys = {
  pending: "workflowOperations.outcome.pending",
  succeeded: "workflowOperations.outcome.succeeded",
  rejected: "workflowOperations.outcome.rejected",
  unknown: "workflowOperations.outcome.unknown",
} as const;
const deliveryKeys = {
  sending: "workflowOperations.delivery.sending",
  accepted: "workflowOperations.delivery.accepted",
  unknown: "workflowOperations.delivery.unknown",
  failed: "workflowOperations.delivery.failed",
  seen: "workflowOperations.delivery.seen",
} as const;

// Only this canonical helper's finite results are display copy, never operation.error.
function deletionMessage(
  operation: WorkflowOperation,
  snapshot: ReturnType<WorkflowView<WorkflowDefinitions>["snapshot"]>,
) {
  const message = deletionStatus(operation, snapshot);
  switch (message) {
    case "Deleting…":
      return t("workflowsList.deleting");
    case "Couldn't delete this workflow. Review the delivery details.":
      return t("workflowOperations.delete.rejected");
    case "Saved workflow deleted. Work already running may continue.":
      return t("workflowOperations.delete.confirmed");
    case "Checking deletion…":
      return t("workflowsList.checkingDeletion");
    case "This workflow is still in saved configuration. Check again before deleting.":
      return t("workflowOperations.delete.stillSaved");
    case "Couldn't confirm deletion. Check saved configuration before deleting again.":
      return t("workflowOperations.delete.unconfirmed");
    default:
      return message;
  }
}

export function WorkflowOperations({
  operations,
  snapshot,
  onCheckSaved,
  onReviewSaved,
  onDismiss,
}: {
  operations: readonly WorkflowOperation[];
  snapshot: ReturnType<WorkflowView<WorkflowDefinitions>["snapshot"]>;
  onCheckSaved: () => Promise<void>;
  onReviewSaved: (definition: WorkflowDefinition) => void;
  onDismiss: (eventId: string) => Promise<void>;
}) {
  useLanguage();
  const [error, setError] = useState<DisplayMessage | null>(null);
  const [acknowledge, setAcknowledge] = useState<WorkflowOperation | null>(
    null,
  );
  const [working, setWorking] = useState(false);
  const perform = async (action: () => Promise<void>) => {
    setWorking(true);
    try {
      await action();
      setError(null);
      setAcknowledge(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localMessage("workflowOperations.requestFailed"),
      );
    } finally {
      setWorking(false);
    }
  };
  const errorText = resolveMessage(error);
  if (!operations.length && !acknowledge) return null;
  return (
    <section
      aria-label={t("workflowOperations.region")}
      className="workflow-operations"
    >
      <h3 className="text-heading">{t("workflowOperations.recent")}</h3>
      {errorText && !acknowledge && <p role="alert">{errorText}</p>}
      {operations.map((operation) => {
        const current = (
          snapshot.status === "ready" ? snapshot.data.items : []
        ).find(
          (definition) =>
            definition.id === operation.workflow.id &&
            definition.owner === operation.workflow.owner &&
            definition.channelId === operation.workflow.channelId,
        );
        return (
          <div key={operation.eventId}>
            <p role="status">
              {operation.action === "delete"
                ? deletionMessage(operation, snapshot)
                : t(statusKeys[operation.action][operation.outcome])}
            </p>
            {operation.action === "trigger" &&
            operation.outcome === "rejected" ? (
              <p className="text-danger">
                {operation.error || t("workflowOperations.noRun")}
              </p>
            ) : (
              operation.action !== "delete" &&
              operation.error && (
                <p className="text-danger">{operation.error}</p>
              )
            )}
            <div className="workflow-toolbar">
              {(operation.action === "save" || operation.action === "delete") &&
                (operation.outcome === "unknown" ||
                  operation.outcome === "succeeded") &&
                !confirmedDeletion(operation, snapshot) && (
                  <>
                    <Button
                      size="compact"
                      disabled={working || snapshot.status === "loading"}
                      onClick={() => void perform(onCheckSaved)}
                    >
                      {t("workflowsList.checkSaved")}
                    </Button>
                    {current && current.revision !== operation.eventId && (
                      <Button
                        size="compact"
                        disabled={working}
                        onClick={() => onReviewSaved(current)}
                      >
                        {t("workflowOperations.reviewSaved")}
                      </Button>
                    )}
                  </>
                )}
              {operation.outcome !== "pending" && (
                <Button
                  size="compact"
                  disabled={working}
                  onClick={() => setAcknowledge(operation)}
                >
                  {t("workflowsList.dismissNotice")}
                </Button>
              )}
            </div>
            <details>
              <summary>{t("workflowsList.deliveryDetails")}</summary>
              {operation.action === "delete" && operation.error && (
                <p className="text-danger">{operation.error}</p>
              )}
              <p className="text-body-sm">
                {t("workflowOperations.delivery", {
                  action: t(actionKeys[operation.action]),
                  outcome: t(outcomeKeys[operation.outcome]),
                  delivery: t(deliveryKeys[operation.delivery]),
                })}
              </p>
              <p className="text-mono-sm workflow-key">
                {t("workflowOperations.eventId", { id: operation.eventId })}
              </p>
              {operation.runId && (
                <p className="text-mono-sm workflow-key">
                  {t("workflowOperations.runId", { id: operation.runId })}
                </p>
              )}
            </details>
          </div>
        );
      })}
      {acknowledge && (
        <ConfirmAction
          title={t("workflowsList.dismissTitle")}
          pending={working}
          error={errorText}
          description={
            acknowledge.action === "delete"
              ? t("workflowOperations.dismissDelete")
              : t("workflowOperations.dismissCommand")
          }
          action={
            working
              ? t("workflowsList.dismissing")
              : t("workflowsList.dismissContinue")
          }
          cancel={t("workflowsList.keepEditing")}
          onConfirm={() => {
            if (!working) void perform(() => onDismiss(acknowledge.eventId));
          }}
          onCancel={() => {
            if (!working) setAcknowledge(null);
          }}
        />
      )}
    </section>
  );
}
