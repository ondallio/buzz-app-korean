import { t, useLanguage } from "../../shared/i18n";
import {
  errorMessage,
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { useEffect, useState } from "react";
import type {
  WorkflowDefinitions,
  WorkflowOperation,
  WorkflowView,
} from "../../features/workflows/types";
import { Button } from "../../shared/design-system/ui/Button";
import { ToastNotice } from "../../shared/design-system/ui/Toast";
import { ConfirmAction } from "./ConfirmAction";
import { confirmedDeletion } from "./editor-model";
import { readWorkflowDocumentFields } from "./workflowYamlDocument";

type Snapshot = ReturnType<WorkflowView<WorkflowDefinitions>["snapshot"]>;

/** Recovery stays on the grid and never needs to mount a workflow editor. */
export function WorkflowDeletionNotices({
  operations,
  snapshots,
  onCheck,
  onDismiss,
}: {
  operations: readonly WorkflowOperation[];
  snapshots: Readonly<Record<string, Snapshot>>;
  onCheck: (channelIds: readonly string[]) => void;
  onDismiss: (operation: WorkflowOperation) => Promise<void>;
}) {
  useLanguage();
  const [acknowledge, setAcknowledge] = useState<WorkflowOperation>();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<DisplayMessage>();
  const dismiss = async () => {
    if (!acknowledge || working) return;
    setWorking(true);
    try {
      await onDismiss(acknowledge);
      setAcknowledge(undefined);
      setError(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorMessage(cause)
          : localMessage("workflowsList.dismissError"),
      );
    } finally {
      setWorking(false);
    }
  };
  const acknowledgeSnapshot =
    acknowledge && snapshots[acknowledge.workflow.channelId];
  useEffect(() => {
    if (
      !acknowledgeSnapshot ||
      acknowledgeSnapshot.status === "idle" ||
      acknowledgeSnapshot.status === "unavailable"
    ) {
      setAcknowledge(undefined);
      setError(undefined);
    }
  }, [acknowledgeSnapshot]);
  return (
    <>
      {operations
        .filter(
          (operation) =>
            operation.action === "delete" &&
            // Completed outbox entries can move ahead of rejected ones. A newer
            // non-rejected attempt supersedes the old failure regardless of order.
            (operation.outcome !== "rejected" ||
              !operations.some(
                (other) =>
                  other.action === "delete" &&
                  other.outcome !== "rejected" &&
                  other.workflow.id === operation.workflow.id &&
                  other.workflow.owner === operation.workflow.owner &&
                  other.workflow.channelId === operation.workflow.channelId,
              )),
        )
        .map((operation) => {
          const snapshot = snapshots[operation.workflow.channelId];
          const definition = snapshot?.data.items.find(
            (row) =>
              row.id === operation.workflow.id &&
              row.owner === operation.workflow.owner,
          );
          if (operation.outcome === "pending") {
            if (definition) return null;
            return (
              <ToastNotice
                key={operation.eventId}
                title={t("workflowsList.deletingWorkflow")}
                description={t("workflowsList.waitingDeletion")}
                tone="info"
              />
            );
          }
          if (
            !snapshot ||
            snapshot.status === "idle" ||
            snapshot.status === "unavailable" ||
            confirmedDeletion(operation, snapshot)
          )
            return null;
          const rejected = operation.outcome === "rejected";
          const name = readWorkflowDocumentFields(definition?.yaml ?? "").name;
          return (
            <ToastNotice
              key={operation.eventId}
              title={
                rejected
                  ? name
                    ? t("workflowsList.deleteNamed", { name })
                    : t("workflowsList.deleteUnnamed")
                  : name
                    ? t("workflowsList.deletionNamed", { name })
                    : t("workflowsList.deletionUnnamed")
              }
              description={
                rejected
                  ? t("workflowsList.rejectedDeleteHelp")
                  : t("workflowsList.unknownDeleteHelp")
              }
            >
              <Button
                size="compact"
                disabled={working || snapshot.status === "loading"}
                onClick={() => onCheck([operation.workflow.channelId])}
              >
                {snapshot.status === "loading"
                  ? t("workflowsList.checkingDeletion")
                  : t("workflowsList.checkSaved")}
              </Button>
              <Button
                size="compact"
                disabled={working}
                onClick={() => {
                  setError(undefined);
                  setAcknowledge(operation);
                }}
              >
                {t("workflowsList.dismissNotice")}
              </Button>
              {operation.error && (
                <details>
                  <summary>{t("workflowsList.deliveryDetails")}</summary>
                  {operation.error}
                </details>
              )}
            </ToastNotice>
          );
        })}
      {acknowledge &&
        acknowledgeSnapshot &&
        acknowledgeSnapshot.status !== "idle" &&
        acknowledgeSnapshot.status !== "unavailable" && (
          <ConfirmAction
            title={t("workflowsList.dismissTitle")}
            pending={working}
            cancel={t("workflowsList.keepEditing")}
            error={resolveMessage(error) ?? null}
            description={t("workflowsList.dismissHelp")}
            action={
              working
                ? t("workflowsList.dismissing")
                : t("workflowsList.dismissContinue")
            }
            onConfirm={() => void dismiss()}
            onCancel={() => {
              if (!working) setAcknowledge(undefined);
            }}
          />
        )}
    </>
  );
}
