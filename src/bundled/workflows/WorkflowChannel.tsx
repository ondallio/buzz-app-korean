import {
  useEffect,
  useId,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  WorkflowCapability,
  WorkflowDefinition,
} from "../../features/workflows/types";
import { PlayIcon, TrashIcon } from "../../shared/design-system/icons";
import {
  MenuIcon,
  MenuItem,
  MenuNote,
} from "../../shared/design-system/ui/Menu";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { ConfirmAction } from "./ConfirmAction";
import { WorkflowEditor } from "./WorkflowEditor";
import { WorkflowOperations } from "./WorkflowOperations";
import { WorkflowRuns } from "./WorkflowRuns";
import { saveAwaitsReadback } from "./WorkflowLanding";
import { exactSaveReadback } from "./editor-model";
import { DEFAULT_FORM_STATE, formStateToYaml } from "./workflowFormTypes";
import { useWorkflowView } from "./useWorkflowView";
import { useWorkflowCanDelete } from "./useWorkflowCanDelete";
import {
  type ChannelLabel,
  channelIcon,
} from "../../features/channels/channel-icon";
import { t, useLanguage } from "../../shared/i18n";
import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";

type Draft = {
  editorKey: number;
  original: WorkflowDefinition | undefined;
  yaml: string;
  initial: string;
  operationId?: string;
};

function draftFor(next: WorkflowDefinition | "new", editorKey: number): Draft {
  const yaml =
    next === "new"
      ? formStateToYaml({ ...DEFAULT_FORM_STATE, name: "Untitled workflow" })
      : next.yaml;
  return {
    editorKey,
    original: next === "new" ? undefined : next,
    yaml,
    initial: yaml,
  };
}

export function WorkflowChannel({
  capability,
  channelId,
  channel,
  initialSelection,
  viewer,
  onDraftRiskChange,
  onSaveReadback,
  onClose,
  onDelete,
}: {
  capability: WorkflowCapability;
  channelId: string;
  channel: ChannelLabel;
  initialSelection: WorkflowDefinition | "new";
  viewer: string;
  onDraftRiskChange?: (atRisk: boolean) => void;
  onSaveReadback?: (
    saved: Pick<WorkflowDefinition, "channelId" | "revision">,
  ) => void;
  onClose: () => void;
  onDelete: (definition: WorkflowDefinition) => void;
}) {
  useLanguage();
  const { snapshot, refresh } = useWorkflowView(
    useCallback(
      () => capability.definitions(channelId),
      [capability, channelId],
    ),
  );
  const operations = useSyncExternalStore(
    capability.operations.subscribe,
    capability.operations.snapshot,
    capability.operations.snapshot,
  );
  const submission = useRef<string | null>(null);
  const deleteReasonId = useId();
  const editorGeneration = useRef(0);
  const [draft, setDraft] = useState<Draft | null>(() =>
    draftFor(initialSelection, 0),
  );
  const [pendingSelection, setPendingSelection] = useState<
    WorkflowDefinition | "new" | "close" | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<DisplayMessage | null>(null);
  const [createdRun, setCreatedRun] = useState<string>();
  const [runRequest, setRunRequest] = useState<string>();
  const operation = draft?.operationId
    ? operations.find((item) => item.eventId === draft.operationId)
    : undefined;
  const runOperation = runRequest
    ? operations.find((item) => item.eventId === runRequest)
    : undefined;
  const ownOperations = operations.filter(
    (item) => item.workflow.channelId === channelId,
  );
  const busy =
    !!draft?.operationId && (!operation || operation.outcome === "pending");
  const [localDraftAtRisk, setLocalDraftAtRisk] = useState(false);
  const readonly = !!draft?.original && draft.original.owner !== viewer;
  const canDelete = useWorkflowCanDelete(capability, draft?.original);
  const dirty = !!draft && (draft.yaml !== draft.initial || localDraftAtRisk);
  const atRisk = dirty || !!draft?.operationId;
  // A run request never changes configuration, so its lost receipt cannot
  // leave a configuration write unresolved; nor can a save a newer head replaced.
  const unresolved = ownOperations.filter((item) => {
    const original = draft?.original;
    if (!original)
      return (
        item.action === "save" &&
        item.outcome !== "rejected" &&
        item.outcome !== "succeeded"
      );
    if (
      item.workflow.id !== original.id ||
      item.workflow.owner !== original.owner
    )
      return false;
    if (item.outcome === "pending") return true;
    if (item.action === "delete") return item.outcome !== "rejected";
    return (
      item.action === "save" &&
      item.outcome === "unknown" &&
      saveAwaitsReadback(item, original)
    );
  });
  const unresolvedWrite = unresolved.length > 0;
  useEffect(() => {
    onDraftRiskChange?.(atRisk);
    return () => onDraftRiskChange?.(false);
  }, [atRisk, onDraftRiskChange]);
  useEffect(() => {
    if (!atRisk) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [atRisk]);
  const open = (next: WorkflowDefinition | "new" | "close") => {
    if (next === "close") {
      onClose();
      return;
    }
    setLocalDraftAtRisk(false);
    // Explicit replacement discards local form state even for the same revision.
    setDraft(draftFor(next, ++editorGeneration.current));
    submission.current = null;
    setRunRequest(undefined);
    setError(null);
    setPendingSelection(null);
    setConfirmDelete(false);
  };
  const select = (next: WorkflowDefinition | "new" | "close") => {
    if (atRisk) setPendingSelection(next);
    else open(next);
  };
  useEffect(() => {
    if (operation?.eventId && operation.outcome === "succeeded") void refresh();
  }, [operation?.eventId, operation?.outcome, refresh]);
  useEffect(() => {
    if (!operation || !draft || snapshot?.status !== "ready") return;
    const saved = exactSaveReadback(operation, snapshot.data.items);
    if (saved) {
      submission.current = null;
      onSaveReadback?.({
        channelId: saved.channelId,
        revision: saved.revision,
      });
      // Readback updates the draft, not its modal lifetime: remounting would
      // steal focus from a one-time secret dialog delivered by the same save.
      setDraft({
        editorKey: draft.editorKey,
        original: saved,
        yaml: saved.yaml,
        initial: saved.yaml,
      });
    }
  }, [operation, snapshot, draft, onSaveReadback]);
  // A cleared/unavailable view withdraws the saved private definition from display.
  // Unsaved user-authored drafts never become a second retained definition cache.
  useEffect(() => {
    if (snapshot?.status === "unavailable" || snapshot?.status === "idle") {
      submission.current = null;
      setDraft(null);
      setPendingSelection(null);
      setConfirmDelete(false);
      setError(null);
    }
  }, [snapshot?.status]);
  const dismiss = async (eventId: string) => {
    await capability.operations.dismiss(eventId);
    if (submission.current === eventId) submission.current = null;
    setDraft((current) => {
      if (current?.operationId !== eventId) return current;
      const { operationId: _, ...retained } = current;
      return retained;
    });
  };
  const save = () => {
    if (
      !draft ||
      submission.current ||
      busy ||
      unresolvedWrite ||
      readonly ||
      !capability.availability.save ||
      draft.operationId
    )
      return;
    try {
      submission.current = "submitting";
      const operationId = capability.save({
        channelId,
        yaml: draft.yaml,
        ...(draft.original ? { existing: draft.original } : {}),
      });
      submission.current = operationId;
      setDraft({ ...draft, operationId });
      setError(null);
    } catch (cause) {
      submission.current = null;
      setError(
        cause instanceof Error
          ? cause.message
          : localMessage("workflowChannel.submitFailed"),
      );
    }
  };
  const remove = () => {
    if (
      !draft?.original ||
      submission.current ||
      unresolvedWrite ||
      draft.operationId
    )
      return;
    if (
      !capability.permissions.canDelete(draft.original) ||
      !capability.availability.delete
    ) {
      setConfirmDelete(false);
      setError(
        capability.availability.delete
          ? localMessage("workflowChannel.deletePermissionLost")
          : localMessage("workflowChannel.deleteUnavailable"),
      );
      return;
    }
    // The page owns submission and recovery after this editor is discarded.
    const definition = draft.original;
    setDraft(null);
    setLocalDraftAtRisk(false);
    setPendingSelection(null);
    setConfirmDelete(false);
    onDelete(definition);
  };

  const trigger = () => {
    if (
      !draft?.original ||
      submission.current ||
      dirty ||
      unresolvedWrite ||
      draft.operationId ||
      readonly ||
      !capability.availability.trigger
    )
      return;
    try {
      submission.current = "submitting";
      const eventId = capability.trigger(draft.original);
      submission.current = eventId;
      setRunRequest(eventId);
      setError(null);
    } catch (cause) {
      submission.current = null;
      setError(
        cause instanceof Error
          ? cause.message
          : localMessage("workflowChannel.runFailed"),
      );
    }
  };
  useEffect(() => {
    const active = operations.find(
      (item) => item.eventId === submission.current,
    );
    if (
      active?.action !== "trigger" ||
      (active.outcome !== "succeeded" &&
        active.outcome !== "rejected" &&
        active.outcome !== "unknown")
    )
      return;
    submission.current = null;
    // A created run rereads the history behind the Runs tab.
    if (active.runId) setCreatedRun(active.runId);
  }, [operations]);
  const errorText = resolveMessage(error);
  let blocked: string | undefined;
  if (!capability.availability.save)
    blocked = t("workflowChannel.saveUnavailable");
  else if (unresolvedWrite && !draft?.operationId)
    blocked = unresolved.every((item) => item.action === "trigger")
      ? t("workflowOperations.trigger.pending")
      : t("workflowChannel.checkSaved");
  else if (draft?.operationId)
    blocked =
      operation?.outcome === "succeeded"
        ? t("workflowChannel.awaitingReadback")
        : operation?.outcome === "rejected"
          ? t("workflowChannel.rejectedDraft")
          : undefined;
  if (!snapshot) return <p role="status">{t("workflowChannel.reading")}</p>;
  const ChannelIcon = channelIcon(channel);
  return (
    <section aria-label={t("workflowChannel.region", { name: channel.name })}>
      {snapshot.status === "loading" && !snapshot.data.items.length && (
        <p role="status">{t("workflowChannel.reading")}</p>
      )}
      {snapshot.status === "idle" && (
        <p role="status">{t("workflowChannel.cleared")}</p>
      )}
      {snapshot.status === "unavailable" && (
        <p role="status">{t("workflowChannel.definitionsUnavailable")}</p>
      )}
      {snapshot.status === "error" && (
        <p role="alert" className="text-danger">
          {snapshot.error ?? t("workflowChannel.readFailed")}
        </p>
      )}
      {snapshot.data.partial && (
        <p className="text-secondary">{t("workflowChannel.partial")}</p>
      )}
      {!capability.availability.save && (
        <p role="status" className="text-secondary">
          {t("workflowChannel.readOnlyHost")}
        </p>
      )}
      {draft &&
        snapshot.status !== "unavailable" &&
        snapshot.status !== "idle" && (
          <WorkflowEditor
            key={draft.editorKey}
            create={!draft.original}
            yaml={draft.yaml}
            initialYaml={draft.original?.yaml}
            onChange={(yaml) => setDraft({ ...draft, yaml })}
            onSave={save}
            onLocalDraftRiskChange={setLocalDraftAtRisk}
            readOnly={readonly}
            busy={busy}
            locked={!!draft.operationId}
            blocked={blocked}
            onCancel={() => select("close")}
            scope={
              <span className="workflow-channel-label text-label">
                <ChannelIcon size={18} aria-hidden="true" />
                {channel.name}
              </span>
            }
            run={
              !readonly && (
                <IconButton
                  aria-label={t("workflowChannel.runNow")}
                  title={t("workflowChannel.runNow")}
                  disabled={
                    dirty ||
                    !!draft.operationId ||
                    unresolvedWrite ||
                    !capability.availability.trigger
                  }
                  icon={<PlayIcon size={20} aria-hidden="true" />}
                  onClick={trigger}
                />
              )
            }
            actions={
              draft.original && (
                <>
                  <MenuItem
                    tone="danger"
                    aria-describedby={!canDelete ? deleteReasonId : undefined}
                    disabled={
                      !canDelete ||
                      !!draft.operationId ||
                      unresolvedWrite ||
                      !capability.availability.delete
                    }
                    onClick={() => setConfirmDelete(true)}
                  >
                    <MenuIcon>
                      <TrashIcon size={14} />
                    </MenuIcon>
                    {t("workflowChannel.delete")}
                  </MenuItem>
                  {!canDelete && (
                    <MenuNote id={deleteReasonId}>
                      {t("workflowChannel.authorOnly")}
                    </MenuNote>
                  )}
                </>
              )
            }
            runs={
              draft.original &&
              capability.availability.history && (
                <WorkflowRuns
                  key={`${draft.original.owner}:${draft.original.id}:${createdRun ?? ""}`}
                  capability={capability}
                  workflow={draft.original}
                  heading={false}
                />
              )
            }
            status={
              <>
                {(snapshot.status === "error" ||
                  snapshot.status === "loading") && (
                  <div className="workflow-options">
                    {snapshot.status === "error" ? (
                      <p role="alert" className="text-danger">
                        {snapshot.error ?? t("workflowChannel.readFailedShort")}
                      </p>
                    ) : (
                      <p role="status">{t("workflowChannel.reading")}</p>
                    )}
                    <Button
                      disabled={snapshot.status === "loading"}
                      onClick={() => void refresh()}
                    >
                      {t("workflowChannel.refresh")}
                    </Button>
                  </div>
                )}
                {!capability.availability.delete && (
                  <p className="text-body-sm text-secondary">
                    {t("workflowChannel.noDelete")}
                  </p>
                )}
                {errorText && (
                  <p role="alert" className="text-danger">
                    {errorText}
                  </p>
                )}
                {runOperation?.outcome === "succeeded" && (
                  <p role="status" className="text-body-sm text-secondary">
                    {t("workflowOperations.trigger.succeeded")}
                  </p>
                )}
                {operation?.outcome === "rejected" && (
                  <Button
                    onClick={() => {
                      submission.current = null;
                      const { operationId: _, ...rest } = draft;
                      setDraft(rest);
                    }}
                  >
                    {t("workflowChannel.continueEditing")}
                  </Button>
                )}
                <WorkflowOperations
                  operations={ownOperations.filter(
                    (item) =>
                      item.action === "save" ||
                      (item.action === "trigger" &&
                        (item.outcome === "unknown" ||
                          item.outcome === "rejected")),
                  )}
                  snapshot={snapshot}
                  onCheckSaved={refresh}
                  onReviewSaved={select}
                  onDismiss={dismiss}
                />
              </>
            }
            details={
              <>
                <p className="text-body-sm text-subtle">
                  {t("workflowChannel.unsaved")}
                </p>
                {draft.original && (
                  <details>
                    <summary>{t("workflowChannel.details")}</summary>
                    <p className="text-mono-sm workflow-key">
                      {t("workflowChannel.owner", { id: draft.original.owner })}
                    </p>
                    <p className="text-mono-sm workflow-key">
                      {t("workflowChannel.revision", {
                        id: draft.original.revision,
                      })}
                    </p>
                  </details>
                )}
              </>
            }
          >
            {pendingSelection && (
              <ConfirmAction
                title={t("workflowChannel.leaveTitle")}
                description={t("workflowChannel.leaveDescription")}
                action={t("workflowChannel.leaveAction")}
                cancel={t("workflowChannel.keepEditing")}
                destructive
                onConfirm={() => open(pendingSelection)}
                onCancel={() => setPendingSelection(null)}
              />
            )}
            {confirmDelete && (
              <ConfirmAction
                title={t("workflowChannel.deleteTitle")}
                description={t("workflowChannel.deleteDescription")}
                action={t("workflowChannel.delete")}
                cancel={t("workflowChannel.cancel")}
                destructive
                error={errorText}
                onConfirm={remove}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </WorkflowEditor>
        )}
      {!draft && (
        <WorkflowOperations
          operations={ownOperations.filter((item) => item.action !== "delete")}
          snapshot={snapshot}
          onCheckSaved={refresh}
          onReviewSaved={select}
          onDismiss={dismiss}
        />
      )}
    </section>
  );
}
