import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownIcon,
  CalendarIcon,
  ChatCircleIcon,
  GitPullRequestIcon,
  PlusIcon,
  SmileyIcon,
  TrashIcon,
  TimerIcon,
  WebhooksLogoIcon,
  XIcon,
} from "../../shared/design-system/icons";
import { Accordion } from "../../shared/design-system/ui/Accordion";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Field } from "../../shared/design-system/ui/Field";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Input } from "../../shared/design-system/ui/Input";
import {
  MenuItem,
  MenuIcon,
  MenuPopup,
  MenuRoot,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import { Select } from "../../shared/design-system/ui/Select";
import { Switch } from "../../shared/design-system/ui/Switch";
import { t, useLanguage, type TranslationKey } from "../../shared/i18n";
import { displayWorkflowDraftIssue } from "./workflowEditorDisplay";
import { WorkflowMessageText } from "./WorkflowMessageText";
import { WorkflowConditions } from "./WorkflowConditions";
import { WorkflowWebhookFields } from "./WorkflowWebhookFields";
import { WorkflowScheduleFields } from "./WorkflowScheduleFields";
import { formWithStep, type WorkflowDraftIssue } from "./editor-model";
import {
  isThreadReplyEligibleTrigger,
  isTriggerType,
  nextStepId,
  withTriggerType,
  type ActionType,
  type StepFormState,
  type TriggerType,
  type WorkflowFormState,
} from "./workflowFormTypes";
import { defaultScheduleTrigger } from "./workflowSchedule";

const TRIGGERS: Record<
  TriggerType,
  { label: `workflowForm.trigger.${TriggerType}`; icon: typeof CalendarIcon }
> = {
  message_posted: {
    label: "workflowForm.trigger.message_posted",
    icon: ChatCircleIcon,
  },
  reaction_added: {
    label: "workflowForm.trigger.reaction_added",
    icon: SmileyIcon,
  },
  diff_posted: {
    label: "workflowForm.trigger.diff_posted",
    icon: GitPullRequestIcon,
  },
  schedule: { label: "workflowForm.trigger.schedule", icon: CalendarIcon },
  webhook: { label: "workflowForm.trigger.webhook", icon: WebhooksLogoIcon },
};
const ACTION_LABELS = {
  send_message: "workflowForm.action.send_message",
  delay: "workflowForm.action.delay",
  call_webhook: "workflowForm.action.call_webhook",
} as const satisfies Record<ActionType, TranslationKey>;
export type WorkflowSelection =
  | { type: "trigger" }
  | { type: "step"; id: string }
  | null;

export function WorkflowForm({
  state,
  onChange,
  disabled,
  issue,
  selection,
  onSelect,
  overview,
}: {
  state: WorkflowFormState;
  onChange: (next: WorkflowFormState) => void;
  disabled: boolean;
  issue?: WorkflowDraftIssue | null | undefined;
  selection: WorkflowSelection;
  onSelect: (selection: WorkflowSelection) => void;
  overview?: ReactNode;
}) {
  useLanguage();
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const triggerNode = useRef<HTMLElement>(null);
  const stepNodes = useRef(new Map<string, HTMLElement>());
  const inspectorReturnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (selection) {
      inspectorReturnFocus.current =
        selection.type === "trigger"
          ? triggerNode.current
          : (stepNodes.current.get(selection.id) ?? null);
      // Selection can replace or disable the control that opened the inspector
      // (the empty draft's footer action, for example). Keep focus on its node.
      if (!narrow) inspectorReturnFocus.current?.focus();
    } else if (!narrow) {
      inspectorReturnFocus.current?.focus();
      inspectorReturnFocus.current = null;
    }
  }, [selection, narrow]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setNarrow(
          entry.contentRect.width <=
            44 *
              parseFloat(getComputedStyle(document.documentElement).fontSize),
        );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const stepIndex =
    selection?.type === "step"
      ? state.steps.findIndex((step) => step.id === selection.id)
      : -1;
  const selectedStep = state.steps[stepIndex];
  const inspectorOpen = selection?.type === "trigger" || !!selectedStep;
  const TriggerIcon = TRIGGERS[state.trigger.on].icon;
  const addStep = (after: number, action: ActionType) => {
    if (disabled) return;
    const step: StepFormState = {
      id: nextStepId(state.steps),
      action,
      ...(action === "send_message"
        ? { text: "" }
        : action === "delay"
          ? { duration: "5m" }
          : { url: "" }),
    };
    const steps = [...state.steps];
    steps.splice(after + 1, 0, step);
    onChange({ ...state, steps });
    onSelect({ type: "step", id: step.id });
  };
  const addMenu = (after: number) => (
    <div
      className="workflow-connector"
      data-terminal={after === state.steps.length - 1 || undefined}
    >
      {after < state.steps.length - 1 && (
        <ArrowDownIcon size={18} aria-hidden="true" />
      )}
      <MenuRoot>
        <MenuTrigger
          render={
            <IconButton
              aria-label={
                after < 0
                  ? t("workflowForm.addStep")
                  : t("workflowForm.addAfter", { step: after + 1 })
              }
              icon={<PlusIcon size={16} aria-hidden="true" />}
              size="sm"
              variant="subtle"
              disabled={disabled}
            />
          }
        />
        <MenuPopup size="compact">
          <MenuItem onClick={() => addStep(after, "send_message")}>
            <MenuIcon>
              <ChatCircleIcon size={14} />
            </MenuIcon>
            {t("workflowForm.addMessage")}
          </MenuItem>
          <MenuItem onClick={() => addStep(after, "delay")}>
            <MenuIcon>
              <TimerIcon size={14} />
            </MenuIcon>
            {t("workflowForm.addDelay")}
          </MenuItem>
          <MenuItem onClick={() => addStep(after, "call_webhook")}>
            <MenuIcon>
              <WebhooksLogoIcon size={14} />
            </MenuIcon>
            {t("workflowForm.addWebhook")}
          </MenuItem>
        </MenuPopup>
      </MenuRoot>
    </div>
  );
  const removeStep = () => {
    if (!selectedStep || disabled) return;
    onChange({
      ...state,
      steps: state.steps.filter((step) => step.id !== selectedStep.id),
    });
    const neighbor = state.steps[stepIndex - 1] ?? state.steps[stepIndex + 1];
    onSelect(
      neighbor ? { type: "step", id: neighbor.id } : { type: "trigger" },
    );
  };
  const inspector = (
    <>
      <div className="workflow-inspector-heading">
        <div>
          {selectedStep && (
            <p className="text-caption text-subtle">
              {t("workflowForm.stepCaption", { step: stepIndex + 1 })}
            </p>
          )}
          {selectedStep ? (
            <Select
              key="step-action"
              label={t("workflowForm.stepAction")}
              variant="field"
              disabled={disabled}
              value={selectedStep.action}
              groups={[
                {
                  label: "",
                  options: Object.entries(ACTION_LABELS).map(
                    ([value, label]) => ({ value, label: t(label) }),
                  ),
                },
              ]}
              onValueChange={(action) => {
                if (
                  disabled ||
                  (action !== "delay" &&
                    action !== "send_message" &&
                    action !== "call_webhook") ||
                  action === selectedStep.action
                )
                  return;
                onChange({
                  ...state,
                  steps: state.steps.map((step) =>
                    step.id === selectedStep.id
                      ? {
                          id: step.id,
                          name: step.name,
                          timeoutSecs: step.timeoutSecs,
                          condition: step.condition,
                          action,
                          ...(action === "delay"
                            ? { duration: "5m" }
                            : action === "send_message"
                              ? { text: "" }
                              : { url: "" }),
                        }
                      : step,
                  ),
                });
              }}
            />
          ) : (
            <Select
              key="trigger-type"
              label={t("workflowForm.trigger")}
              variant="field"
              disabled={disabled}
              value={state.trigger.on}
              groups={[
                {
                  label: "",
                  options: Object.entries(TRIGGERS).map(
                    ([value, { label }]) => ({ value, label: t(label) }),
                  ),
                },
              ]}
              onValueChange={(value) => {
                if (
                  disabled ||
                  !isTriggerType(value) ||
                  value === state.trigger.on
                )
                  return;
                const next = withTriggerType(state, value);
                onChange(
                  value === "schedule"
                    ? { ...next, trigger: defaultScheduleTrigger() }
                    : next,
                );
              }}
            />
          )}
        </div>
        <div className="workflow-inspector-actions">
          {selectedStep && (
            <IconButton
              hint="familiar"
              aria-label={t("workflowForm.removeStepNumber", {
                step: stepIndex + 1,
              })}
              title={t("workflowForm.removeStep")}
              icon={<TrashIcon size={16} aria-hidden="true" />}
              disabled={disabled}
              onClick={removeStep}
            />
          )}
          {!narrow && (
            <IconButton
              aria-label={t("workflowForm.closeInspector")}
              icon={<XIcon size={16} aria-hidden="true" />}
              onClick={() => onSelect(null)}
            />
          )}
        </div>
      </div>
      <fieldset className="workflow-form" disabled={disabled}>
        {selectedStep ? (
          <StepFields
            key={selectedStep.id}
            state={state}
            step={selectedStep}
            index={stepIndex}
            onChange={onChange}
            disabled={disabled}
            issue={issue}
          />
        ) : (
          <>
            {state.trigger.on === "reaction_added" && (
              <Field label={t("workflowForm.emoji")}>
                <Input
                  id={`${id}-emoji`}
                  value={state.trigger.emoji ?? ""}
                  onValueChange={(emoji) =>
                    onChange({ ...state, trigger: { ...state.trigger, emoji } })
                  }
                />
              </Field>
            )}
            {state.trigger.on === "schedule" ? (
              <WorkflowScheduleFields
                disabled={disabled}
                trigger={state.trigger}
                onUpdate={(trigger) => onChange({ ...state, trigger })}
              />
            ) : state.trigger.on === "webhook" ? (
              <p className="text-body-sm text-subtle">
                {t("workflowForm.webhookGenerated")}
              </p>
            ) : (
              <WorkflowConditions
                key={state.trigger.on}
                trigger={state.trigger}
                disabled={disabled}
                onChange={(patch) =>
                  onChange({
                    ...state,
                    trigger: { ...state.trigger, ...patch },
                  })
                }
              />
            )}
          </>
        )}
      </fieldset>
    </>
  );
  return (
    <div
      ref={container}
      className="workflow-builder"
      data-inspector={((inspectorOpen || !!overview) && !narrow) || undefined}
    >
      <div className="workflow-canvas">
        <ol className="workflow-flow" aria-label={t("workflowForm.sequence")}>
          <li className="workflow-flow-item">
            <NavigationItem
              ref={triggerNode}
              variant="row"
              aria-label={t("workflowForm.editTrigger", {
                trigger: t(TRIGGERS[state.trigger.on].label),
              })}
              aria-current={false}
              aria-pressed={selection?.type === "trigger"}
              selected={selection?.type === "trigger"}
              icon={
                <span className="workflow-node-icon">
                  <TriggerIcon size={20} aria-hidden="true" />
                </span>
              }
              label={
                <span className="workflow-node-copy">
                  <span className="text-caption text-subtle">
                    {t("workflowForm.triggerCaption")}
                  </span>
                  <span className="text-label">
                    {t(TRIGGERS[state.trigger.on].label)}
                  </span>
                </span>
              }
              onClick={() => onSelect({ type: "trigger" })}
            />
            {addMenu(-1)}
          </li>
          {state.steps.map((step, index) => (
            <li key={step.id} className="workflow-flow-item">
              <NavigationItem
                ref={(node) => {
                  if (node) stepNodes.current.set(step.id, node);
                  else stepNodes.current.delete(step.id);
                }}
                variant="row"
                aria-label={t("workflowForm.editStep", {
                  step: index + 1,
                  action: t(ACTION_LABELS[step.action]),
                })}
                aria-current={false}
                aria-pressed={
                  selection?.type === "step" && selection.id === step.id
                }
                selected={
                  selection?.type === "step" && selection.id === step.id
                }
                icon={
                  <span className="workflow-node-icon text-body-sm">
                    {index + 1}
                  </span>
                }
                label={
                  <span className="workflow-node-copy">
                    <span className="text-caption text-subtle">
                      {t(ACTION_LABELS[step.action]).toUpperCase()}
                    </span>
                    <span className="workflow-node-summary text-label">
                      {step.action === "send_message"
                        ? step.text?.trim()
                          ? `“${step.text}”`
                          : t("workflowForm.writeMessage")
                        : step.action === "delay"
                          ? step.duration || t("workflowForm.setDuration")
                          : step.url || t("workflowForm.setUrl")}
                    </span>
                  </span>
                }
                onClick={() => onSelect({ type: "step", id: step.id })}
              />
              {addMenu(index)}
            </li>
          ))}
        </ol>
        {!state.steps.length && (
          <p className="text-body-sm text-subtle">
            {t("workflowForm.addStepHelp")}
          </p>
        )}
        {issue &&
          "stepIndex" in issue &&
          state.steps[issue.stepIndex] &&
          issue.stepIndex !== stepIndex && (
            <Button
              variant="ghost"
              onClick={() =>
                onSelect({
                  type: "step",
                  id: state.steps[issue.stepIndex]?.id ?? "",
                })
              }
            >
              {t("workflowForm.reviewStep", {
                step: issue.stepIndex + 1,
                error: displayWorkflowDraftIssue(issue) ?? "",
              })}
            </Button>
          )}
      </div>
      {inspectorOpen && narrow && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) onSelect(null);
          }}
          title={
            selectedStep
              ? t("workflowForm.stepSettings", { step: stepIndex + 1 })
              : t("workflowForm.triggerSettings")
          }
          placement="right"
          finalFocus={() => inspectorReturnFocus.current}
          motion="none"
          dismissOnOutsideClick
          closeLabel={t("workflowForm.closeInspector")}
        >
          {inspector}
        </Dialog>
      )}
      {inspectorOpen && !narrow ? (
        <aside
          className="workflow-inspector"
          aria-label={
            selectedStep
              ? t("workflowForm.stepSettings", { step: stepIndex + 1 })
              : t("workflowForm.triggerSettings")
          }
        >
          {inspector}
        </aside>
      ) : (
        overview && (
          <aside
            className="workflow-inspector"
            aria-label={t("workflowForm.settings")}
          >
            {overview}
          </aside>
        )
      )}
    </div>
  );
}

function StepFields({
  state,
  step,
  index,
  onChange,
  disabled,
  issue,
}: {
  state: WorkflowFormState;
  step: StepFormState;
  index: number;
  onChange: (next: WorkflowFormState) => void;
  disabled: boolean;
  issue?: WorkflowDraftIssue | null | undefined;
}) {
  const id = useId();
  const error = (field: "text" | "duration" | "timeout" | "url" | "headers") =>
    issue &&
    "stepIndex" in issue &&
    issue.stepIndex === index &&
    issue.field === field
      ? issue.message
      : undefined;
  const displayedError = (
    field: "text" | "duration" | "timeout" | "url" | "headers",
  ) =>
    error(field) ? (displayWorkflowDraftIssue(issue) ?? undefined) : undefined;
  const update = (patch: Partial<StepFormState>) =>
    onChange(formWithStep(state, step.id, patch));
  const [expanded, setExpanded] = useState<string[]>([]);
  const timeoutError = error("timeout");
  useEffect(() => {
    if (timeoutError)
      setExpanded((current) =>
        current.includes("run") ? current : [...current, "run"],
      );
  }, [timeoutError]);
  return (
    <>
      {step.action === "call_webhook" ? (
        <WorkflowWebhookFields
          step={step}
          disabled={disabled}
          update={update}
          urlError={displayedError("url")}
          headersError={displayedError("headers")}
        />
      ) : step.action === "send_message" ? (
        <Field
          label={t("workflowForm.messageText")}
          error={displayedError("text")}
          description={t("workflowForm.messageHelp")}
        >
          <WorkflowMessageText
            id={`${id}-text`}
            value={step.text ?? ""}
            rows={4}
            autoCapitalize="off"
            onValueChange={(text) => update({ text })}
          />
        </Field>
      ) : (
        <Field
          label={t("workflowForm.delayDuration")}
          error={displayedError("duration")}
        >
          <Input
            id={`${id}-duration`}
            value={step.duration ?? ""}
            placeholder="5m"
            onValueChange={(duration) => update({ duration })}
          />
        </Field>
      )}
      <Accordion
        variant="form"
        keepMounted
        value={expanded}
        onValueChange={setExpanded}
        items={[
          {
            value: "run",
            title: (
              <span className="workflow-disclosure-title">
                {t("workflowForm.runControls")}
                <span className="text-caption text-subtle">
                  {step.timeoutSecs
                    ? t(
                        step.condition
                          ? step.replyInThread
                            ? "workflowForm.summary.all"
                            : "workflowForm.summary.conditionTimeout"
                          : step.replyInThread
                            ? "workflowForm.summary.threadTimeout"
                            : "workflowForm.summary.timeout",
                        { timeout: step.timeoutSecs },
                      )
                    : t(
                        step.condition
                          ? step.replyInThread
                            ? "workflowForm.summary.both"
                            : "workflowForm.summary.condition"
                          : step.replyInThread
                            ? "workflowForm.summary.thread"
                            : "workflowForm.summary.default",
                      )}
                </span>
              </span>
            ),
            content: (
              <div className="workflow-options">
                {step.action === "send_message" &&
                  isThreadReplyEligibleTrigger(state.trigger.on) && (
                    <Switch
                      label={t("workflowForm.replyInThread")}
                      checked={step.replyInThread === true}
                      disabled={disabled}
                      onCheckedChange={(replyInThread) =>
                        update({ replyInThread })
                      }
                    />
                  )}
                <Field
                  label={t("workflowForm.stepCondition")}
                  description={t("workflowForm.stepConditionHelp")}
                >
                  <Input
                    value={step.condition ?? ""}
                    onValueChange={(condition) =>
                      update({
                        condition: condition.trim() ? condition : undefined,
                      })
                    }
                  />
                </Field>
                <Field
                  label={t("workflowForm.stepTimeout")}
                  error={displayedError("timeout")}
                >
                  <Input
                    id={`${id}-timeout`}
                    value={step.timeoutSecs ?? ""}
                    placeholder="30s"
                    onValueChange={(timeoutSecs) => update({ timeoutSecs })}
                  />
                </Field>
              </div>
            ),
          },
          {
            value: "details",
            title: (
              <span className="workflow-disclosure-title">
                {t("workflowForm.stepDetails")}
                <span className="text-caption text-subtle">
                  {step.name || step.id}
                </span>
              </span>
            ),
            content: (
              <div className="workflow-options">
                <p className="text-mono-sm text-subtle">{step.id}</p>
                <Field label={t("workflowForm.stepName")}>
                  <Input
                    id={`${id}-name`}
                    value={step.name ?? ""}
                    onValueChange={(name) => update({ name })}
                  />
                </Field>
                {step.action === "send_message" && (
                  <Field
                    label={t("workflowForm.destination")}
                    description={t("workflowForm.destinationHelp")}
                  >
                    <Input
                      id={`${id}-channel`}
                      value={step.channel ?? ""}
                      onValueChange={(channel) => update({ channel })}
                    />
                  </Field>
                )}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
