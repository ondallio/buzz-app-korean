import { useCallback, useState } from "react";
import type {
  WorkflowCapability,
  WorkflowDefinition,
  WorkflowRunCursor,
  WorkflowReference,
} from "../../features/workflows/types";
import {
  formatFullTimestamp,
  formatItemTimestamp,
} from "../../shared/datetime";
import { useClockFormat } from "../../shared/clock-preference";
import { Button } from "../../shared/design-system/ui/Button";
import { t, useLanguage } from "../../shared/i18n";
import { useWorkflowView } from "./useWorkflowView";

export function WorkflowRuns({
  capability,
  workflow,
  heading = true,
}: {
  capability: WorkflowCapability;
  workflow: WorkflowDefinition;
  heading?: boolean;
}) {
  useLanguage();
  const [cursor, setCursor] = useState<WorkflowRunCursor | undefined>();
  if (!capability.availability.history)
    return <p className="text-secondary">{t("workflowsList.hostHistory")}</p>;
  return (
    <RunPage
      key={cursor ? `${cursor.before}:${cursor.beforeId}` : "first"}
      capability={capability}
      workflow={workflow}
      cursor={cursor}
      onPage={setCursor}
      heading={heading}
    />
  );
}
function RunPage({
  capability,
  workflow,
  cursor,
  onPage,
  heading,
}: {
  capability: WorkflowCapability;
  workflow: WorkflowReference;
  cursor: WorkflowRunCursor | undefined;
  onPage: (cursor: WorkflowRunCursor | undefined) => void;
  heading: boolean;
}) {
  useClockFormat();
  useLanguage();
  const { snapshot, refresh } = useWorkflowView(
    useCallback(
      () => capability.runs(workflow, cursor),
      [capability, workflow, cursor],
    ),
  );
  if (!snapshot) return <p role="status">{t("workflowsList.readingRuns")}</p>;
  return (
    <section aria-label={t("workflowsList.runsAria")} className="workflow-runs">
      <div className="workflow-toolbar">
        {heading && <h3 className="text-heading">{t("workflowsList.runs")}</h3>}
        <Button
          disabled={snapshot.status === "loading"}
          onClick={() => void refresh()}
        >
          {t("workflowsList.refreshRuns")}
        </Button>
      </div>
      {snapshot.status === "loading" && !snapshot.data.runs.length && (
        <p role="status">{t("workflowsList.readingRuns")}</p>
      )}
      {snapshot.status === "unavailable" && (
        <p role="status">{t("workflowsList.historyUnavailable")}</p>
      )}
      {snapshot.status === "idle" && (
        <p role="status">{t("workflowsList.historyCleared")}</p>
      )}
      {snapshot.status === "error" && (
        <p role="alert" className="text-danger">
          {snapshot.error ?? t("workflowsList.historyError")}
        </p>
      )}
      {snapshot.status === "ready" && !snapshot.data.runs.length && (
        <p>{t("workflowsList.noRuns")}</p>
      )}
      {snapshot.data.runs.map((run) => (
        <article key={run.id} className="workflow-step">
          <p className="text-body">
            <strong>{t(`workflowsList.status.${run.status}`)}</strong> ·{" "}
            <time
              dateTime={new Date(run.createdAt * 1000).toISOString()}
              title={formatFullTimestamp(run.createdAt)}
            >
              {formatItemTimestamp(run.createdAt, { withTime: true })}
            </time>
          </p>
          <p className="text-body-sm text-secondary">
            {t("workflowsList.currentStep", { step: run.currentStep })}
          </p>
          {(run.errorCode || run.errorMessage) && (
            <p className="text-danger">
              {run.errorCode}: {run.errorMessage}
            </p>
          )}
          <details>
            <summary>{t("workflowsList.runTrace")}</summary>
            <p className="text-mono-sm workflow-key">
              {t("workflowsList.runId", { id: run.id })}
            </p>
            <pre className="text-mono workflow-trace">
              {JSON.stringify(run.trace, null, 2)}
            </pre>
          </details>
        </article>
      ))}
      <div className="workflow-toolbar">
        {cursor && (
          <Button onClick={() => onPage(undefined)}>
            {t("workflowsList.newestRuns")}
          </Button>
        )}
        {snapshot.status === "ready" && snapshot.data.next && (
          <Button
            onClick={() => {
              if (snapshot.data.next) onPage(snapshot.data.next);
            }}
          >
            {t("workflowsList.olderRuns")}
          </Button>
        )}
      </div>
    </section>
  );
}
