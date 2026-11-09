import { t, useLanguage } from "../../shared/i18n";
import {
  errorMessage,
  localError,
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RelayData } from "../../features/relay/service";
import type { RelaySession } from "../../features/relay/session";
import type { WorkflowDefinition } from "../../features/workflows/types";
import { useChannelList, useRelayConnection } from "../../features/relay/react";
import {
  ArrowsClockwiseIcon,
  LightningIcon,
  PlusIcon,
} from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { ToastNotice } from "../../shared/design-system/ui/Toast";
import { WorkflowEditor } from "./WorkflowEditor";
import { DEFAULT_FORM_STATE, formStateToYaml } from "./workflowFormTypes";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Panel } from "../../shared/design-system/ui/Panel";
import {
  PanelHeader,
  PanelHeaderLabel,
} from "../../shared/design-system/ui/PanelHeader";
import { WorkflowChannelPicker } from "./WorkflowChannelPicker";
import { WorkflowChannel } from "./WorkflowChannel";
import {
  useWorkflowMentionMembers,
  WorkflowMentionMembers,
} from "./WorkflowMessageText";
import { WorkflowWebhookSecrets } from "./WorkflowWebhookSecrets";
import { WorkflowLanding, workflowOperationLocked } from "./WorkflowLanding";
import { PanelWorkspace } from "../../features/panels/PanelWorkspace";
import { usePanelSplit } from "../../features/panels/usePanelSplit";
import "./workflows.css";

export function WorkflowsPage({ relay }: { relay: RelayData }) {
  useLanguage();
  const connection = useRelayConnection(relay);
  return connection.status === "ready" ? (
    <WorkflowCommunity
      key={`${connection.scope}:${connection.generation}`}
      session={connection.session}
      viewer={connection.viewer ?? ""}
    />
  ) : (
    <WorkflowsPanel>
      <WorkflowPageHeader />
      <div className="workflow-page-state">
        <p>
          {connection.status === "connecting"
            ? t("workflowsList.connecting")
            : t("workflowsList.connect")}
        </p>
        {connection.status === "error" && (
          <>
            <p role="alert">{connection.error}</p>
            <Button onClick={() => relay.retry()}>
              {t("workflowsList.retryConnection")}
            </Button>
          </>
        )}
      </div>
    </WorkflowsPanel>
  );
}

function WorkflowsPanel({ children }: { children: ReactNode }) {
  useLanguage();
  return (
    <Panel aria-label={t("workflowsList.workflows")}>
      <div className="workflows-page text-body">{children}</div>
    </Panel>
  );
}
export function WorkflowCommunity({
  session,
  viewer,
}: {
  session: RelaySession;
  viewer: string;
}) {
  useLanguage();
  const capability = session.workflows;
  const channels = useChannelList(session.channels);
  const eligible = channels.channels.filter(
    (item) => !item.huddle && !item.metadataPending,
  );
  const [selected, setSelected] = useState("");
  const [selectedDefinition, setSelectedDefinition] = useState<
    WorkflowDefinition | "new" | undefined
  >();
  const [refreshRequest, setRefreshRequest] = useState(0);
  const [saveReadback, setSaveReadback] =
    useState<Pick<WorkflowDefinition, "channelId" | "revision">>();
  const deleting = useRef(false);
  const [deleteError, setDeleteError] = useState<DisplayMessage>();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<readonly string[]>([]);
  const split = usePanelSplit(session.scope, "workflows", 448, 320);
  const [detail, setDetail] = useState<{
    key: string;
    name: string;
    unnamed?: boolean;
  }>();
  const [detailTarget, setDetailTarget] = useState<HTMLElement | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const selectDetail = useCallback(
    (key: string | undefined, name?: string, unnamed?: boolean) => {
      setDetail((current) =>
        !key
          ? undefined
          : current?.key === key &&
              (name === undefined ||
                (current.name === name && current.unnamed === unnamed))
            ? current
            : {
                key,
                name: name ?? (current?.key === key ? current.name : ""),
                ...(unnamed !== undefined
                  ? { unnamed }
                  : current?.key === key && current.unnamed !== undefined
                    ? { unnamed: current.unnamed }
                    : {}),
              },
      );
    },
    [],
  );
  // The landing that reconciles the selection unmounts without channels.
  if (detail && !eligible.length) setDetail(undefined);
  const open = !!detail;
  useEffect(() => {
    const narrow = window.matchMedia?.("(max-width: 52rem)");
    if (!open || !narrow || !detailTarget) return;
    // Below 52rem the pane replaces the list, so focus left there moves to it.
    const handoff = () => {
      const focus = document.activeElement;
      if (
        narrow.matches &&
        (focus === document.body || mainRef.current?.contains(focus))
      )
        detailTarget.focus();
    };
    handoff();
    narrow.addEventListener("change", handoff);
    return () => narrow.removeEventListener("change", handoff);
  }, [open, detailTarget]);
  const channel = eligible.find((item) => item.id === selected);
  const mentionMembers = useWorkflowMentionMembers(session, channel);
  useEffect(() => {
    if (
      !selected ||
      channel ||
      (!channels.channels.some(
        (item) => item.id === selected && (item.huddle || item.metadataPending),
      ) &&
        (channels.status !== "ready" || channels.coverage === "partial"))
    )
      return;
    setSelected("");
    setSelectedDefinition(undefined);
  }, [channel, channels, selected]);
  if (!capability) {
    return (
      <WorkflowsPanel>
        <WorkflowPageHeader />
        <div className="workflows-body">
          <p role="status">{t("workflowsList.operationsUnavailable")}</p>
        </div>
      </WorkflowsPanel>
    );
  }

  const openChannel = (
    next: string,
    definition?: WorkflowDefinition | "new",
  ) => {
    if (next && !eligible.some((item) => item.id === next)) return;
    setSelectedDefinition(definition);
    setSelected(next);
  };
  const beginCreate = () => setCreateOpen(true);
  const deleteWorkflow = (definition: WorkflowDefinition) => {
    if (deleting.current) return;
    const locked = workflowOperationLocked(
      capability.operations.snapshot(),
      definition,
    );
    if (locked) {
      setDeleteError(localMessage("workflowsList.changePending"));
      openChannel("");
      return;
    }
    deleting.current = true;
    try {
      if (!capability.permissions.canDelete(definition))
        throw localError("workflowsList.permissionLost");
      if (!capability.availability.delete)
        throw localError("workflowsList.deletionUnavailable");
      capability.delete(definition);
      setDeleteError(undefined);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error
          ? errorMessage(cause)
          : localMessage("workflowsList.deleteFallback"),
      );
    } finally {
      deleting.current = false;
      // Confirmation deliberately discards the editor draft, even if submission throws.
      openChannel("");
    }
  };

  return (
    <>
      <div
        ref={split.ref}
        className="workflows-split"
        data-side={detail ? "" : undefined}
      >
        <div className="workflows-main" ref={mainRef}>
          <WorkflowsPanel>
            <WorkflowPageHeader
              actions={
                <>
                  <IconButton
                    hint="familiar"
                    size="sm"
                    variant="ghost"
                    aria-label={t("workflowsList.newWorkflow")}
                    title={t("workflowsList.newWorkflow")}
                    aria-haspopup="dialog"
                    disabled={!capability.availability.save || !eligible.length}
                    icon={<PlusIcon size="1rem" aria-hidden="true" />}
                    onClick={beginCreate}
                  />
                  <IconButton
                    hint="familiar"
                    size="sm"
                    variant="ghost"
                    aria-label={t("workflowsList.refreshWorkflows")}
                    title={t("workflowsList.refreshWorkflows")}
                    icon={
                      <ArrowsClockwiseIcon size="1rem" aria-hidden="true" />
                    }
                    onClick={() => setRefreshRequest((request) => request + 1)}
                  />
                </>
              }
            />
            <div className="workflows-body">
              {channels.status === "loading" && !eligible.length && (
                <p role="status">{t("workflowsList.readingChannels")}</p>
              )}
              {channels.status === "error" && (
                <div className="workflow-page-state">
                  <p role="alert" className="text-danger">
                    {channels.error ?? t("workflowsList.channelsError")}
                  </p>
                  <Button onClick={() => session.channels.refreshList?.()}>
                    {t("workflowsList.retryChannels")}
                  </Button>
                </div>
              )}
              {channels.status === "ready" && !eligible.length && (
                <div className="workflow-page-state">
                  <p>{t("workflowsList.noChannels")}</p>
                </div>
              )}
              {channels.coverage === "partial" && (
                <p className="text-secondary">
                  {t("workflowsList.partialChannels")}
                </p>
              )}
              {eligible.length > 0 && (
                <WorkflowLanding
                  session={session}
                  capability={capability}
                  channels={eligible}
                  filter={filter}
                  onFilterChange={setFilter}
                  detailTarget={detailTarget}
                  selected={detail?.key}
                  onSelect={selectDetail}
                  onCreate={beginCreate}
                  onDelete={deleteWorkflow}
                  onOpen={(definition, nextChannel) =>
                    openChannel(nextChannel.id, definition)
                  }
                  refreshRequest={refreshRequest}
                  saveReadback={saveReadback}
                  viewer={viewer}
                />
              )}
            </div>
          </WorkflowsPanel>
        </div>
        {detail && (
          <aside className="workflows-side">
            {split.handle}
            <Panel aria-label={t("workflowsList.details")}>
              <PanelWorkspace
                focusOnMount={false}
                adoptSelection={detail.key}
                value={detail.key}
                select={() => {}}
                items={[
                  {
                    id: detail.key,
                    label: detail.unnamed
                      ? t("workflowsList.unnamed")
                      : detail.name,
                    icon: <LightningIcon size="1rem" />,
                    content: (
                      <section
                        className="workflow-detail-host"
                        ref={setDetailTarget}
                        aria-label={t("workflowsList.detailNamed", {
                          name: detail.unnamed
                            ? t("workflowsList.unnamed")
                            : detail.name,
                        })}
                        tabIndex={-1}
                      />
                    ),
                    close: () => selectDetail(undefined),
                  },
                ]}
              />
            </Panel>
          </aside>
        )}
      </div>
      {deleteError && (
        <ToastNotice
          title={t("workflowsList.deleteStartError")}
          description={resolveMessage(deleteError)}
          onDismiss={() => setDeleteError(undefined)}
        />
      )}
      {channel && selectedDefinition ? (
        <WorkflowMentionMembers.Provider value={mentionMembers}>
          <WorkflowChannel
            key={`${channel.id}:${
              typeof selectedDefinition === "object"
                ? selectedDefinition.revision
                : selectedDefinition
            }`}
            capability={capability}
            channelId={channel.id}
            channel={channel}
            initialSelection={selectedDefinition}
            onSaveReadback={setSaveReadback}
            onDelete={deleteWorkflow}
            viewer={viewer}
            onClose={() => openChannel("")}
          />
        </WorkflowMentionMembers.Provider>
      ) : null}
      <WorkflowWebhookSecrets capability={capability} />
      {createOpen && (
        <WorkflowEditor
          create
          chooseChannel
          yaml={formStateToYaml({
            ...DEFAULT_FORM_STATE,
            name: "Untitled workflow",
          })}
          onChange={() => {}}
          onSave={() => {}}
          onCancel={() => setCreateOpen(false)}
          scope={
            <WorkflowChannelPicker
              channels={eligible}
              onSelect={(id) => {
                setCreateOpen(false);
                openChannel(id, "new");
              }}
            />
          }
        />
      )}
    </>
  );
}

function WorkflowPageHeader({ actions }: { actions?: ReactNode }) {
  useLanguage();
  return (
    <PanelHeader
      title={
        <PanelHeaderLabel
          title={t("workflowsList.workflows")}
          icon={<LightningIcon size="1rem" />}
        />
      }
      actions={actions}
    />
  );
}
