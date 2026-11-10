import { t, useLanguage } from "../../../shared/i18n";
import {
  errorMessage,
  localError,
  localMessage,
} from "../../../shared/i18n/deferred-message";
import { TranslatedMessage } from "../../../shared/i18n/Message";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AgentSaveButton } from "../../../features/agents/AgentSaveButton";
import { ModelFamilyMenu } from "../../../features/agents/ModelFamilyMenu";
import { BuilderlabLogoIcon } from "../../../shared/design-system/icons";
import { Button } from "../../../shared/design-system/ui/Button";
import { Field } from "../../../shared/design-system/ui/Field";
import { LoadingRegion } from "../../../shared/design-system/ui/LoadingRegion";
import { PreferenceRow } from "../../../shared/design-system/ui/PreferenceRow";
import { Select } from "../../../shared/design-system/ui/Select";
import { SettingsGroup } from "../../../shared/design-system/ui/SettingsGroup";
import { Textarea } from "../../../shared/design-system/ui/Textarea";
import { useToastNotification } from "../../../shared/design-system/ui/Toast";
import {
  MAX_INSTRUCTIONS_LENGTH,
  validInstructions,
  type AgentClient,
  type RemoteAgent,
  type RemoteAgentModel,
} from "../agents/client";
import type { BuilderlabSession } from "../session";
import { AccountRecoverySheet, SettingsErrorSheet } from "./SignInFooter";
import { SignInAction } from "./SignInAction";
import { effortLabel, modelChoice } from "./models";

const statuses = {
  "setup-required": "builderlabSettings.setupRequired",
  "model-unavailable": "builderlabSettings.modelUnavailable",
  "effort-unsupported": "builderlabSettings.effortUnsupported",
  unknown: "builderlabSettings.unknownSelection",
} as const;
const fallback = localMessage("builderlabSettings.fallback");
const message = (reason: unknown) =>
  reason instanceof Error
    ? errorMessage(reason)
    : typeof reason === "string"
      ? reason
      : fallback;
const accessDenied = (reason: unknown) =>
  reason instanceof Error && "status" in reason && reason.status === 403;

export function ModelSettings({
  client,
  session,
  settings,
  harnessControl,
  openIdentity,
}: {
  client: AgentClient;
  session: BuilderlabSession;
  openIdentity?: (() => void) | undefined;
  harnessControl?: (action: ReactNode) => ReactNode;
  settings:
    | { agent: RemoteAgent; subject: string; email?: string }
    | { pending: boolean; error: unknown; retry(): void };
}) {
  useLanguage();
  const login = useSyncExternalStore(session.subscribe, session.snapshot);
  const [retrySignIn, setRetrySignIn] = useState<
    "switching" | "waiting" | "ready"
  >();
  const reducedMotion = useReducedMotion();
  const signedIn = login.status === "signed-in";
  const waitingToRetry =
    retrySignIn === "switching" || retrySignIn === "waiting";
  useEffect(() => {
    // Account sign-out may finish asynchronously; only its published state
    // starts the browser account-switch wait.
    if (retrySignIn === "switching") {
      if (login.status === "signed-out") setRetrySignIn("waiting");
      return;
    }
    if (signedIn) {
      setRetrySignIn(undefined);
      return;
    }
    if (retrySignIn !== "waiting") return;
    const timer = setTimeout(() => setRetrySignIn("ready"), 3000);
    return () => clearTimeout(timer);
  }, [login.status, signedIn, retrySignIn]);
  const agent = "agent" in settings ? settings.agent : undefined;
  const subject = "subject" in settings ? settings.subject : undefined;
  const mismatch =
    signedIn && subject !== undefined && login.account?.subject !== subject;
  const email = mismatch && "email" in settings ? settings.email : undefined;
  const form = useId();
  const notify = useToastNotification();
  const [saved, setSaved] = useState(agent);
  const [models, setModels] = useState<readonly RemoteAgentModel[]>();
  const [modelId, setModelId] = useState(agent?.modelId ?? "");
  const [effort, setEffort] = useState(agent?.reasoningEffort ?? "");
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>("");
  const [catalogError, setCatalogError] = useState<unknown>("");
  const loadError = "error" in settings ? settings.error : "";
  const accessError = [loadError, error, catalogError].find(accessDenied);
  const accountProblem =
    signedIn &&
    (mismatch || login.account?.canUseRemoteAgents === false || !!accessError);
  const hasAccess = signedIn && !accountProblem;
  const busy = !saved || loading || saving || !hasAccess;
  useEffect(() => {
    if (!signedIn) {
      setError("");
      setCatalogError("");
    }
  }, [signedIn]);
  const [revision, setRevision] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);
  useEffect(() => {
    if (!agent) return;
    setSaved(agent);
    setModelId(agent.modelId ?? "");
    setEffort(agent.reasoningEffort ?? "");
    setInstructions(agent.instructions ?? "");
  }, [agent]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision retries a failed catalog request while keeping the draft.
  useEffect(() => {
    if (!agent || login.status !== "signed-in") return;
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    const current = new AbortController();
    setLoading(true);
    setCatalogError("");
    void client
      .modelCatalog(current.signal)
      .then(
        (catalog) => {
          if (!current.signal.aborted) setModels(catalog.models);
        },
        (reason) => {
          if (!current.signal.aborted) setCatalogError(reason);
        },
      )
      .finally(() => {
        if (!current.signal.aborted) setLoading(false);
      });
    return () => current.abort();
  }, [client, agent, revision, login, hasAccess]);
  const model = models?.find((choice) => choice.id === modelId);
  const valid = !!model?.supportedReasoningEfforts.includes(effort);
  const modelChanged =
    modelId !== (saved?.modelId ?? "") ||
    effort !== (saved?.reasoningEffort ?? "");
  const instructionsChanged = instructions !== (saved?.instructions ?? "");
  const saveModel =
    modelChanged ||
    (!instructionsChanged && saved?.modelSelectionStatus !== "valid");
  const disabled =
    !hasAccess ||
    !saved ||
    saving ||
    !validInstructions(instructions) ||
    (!instructionsChanged && !saveModel) ||
    (saveModel && (loading || !valid));
  const save = async () => {
    if (disabled || !saved) return;
    const signal = controller.current?.signal;
    if (!signal) return;
    setSaving(true);
    setError("");
    try {
      if (session.credential().account.subject !== subject)
        throw localError("builderlabSettings.accountMismatch");
      if (saved.status !== "Active")
        throw localError("builderlabSettings.activeOnly");
      if (saveModel && instructionsChanged)
        await client.configure(
          saved.pubkey,
          {
            instructions,
            modelId,
            reasoningEffort: effort,
          },
          signal,
        );
      else if (saveModel)
        await client.updateModel(saved, modelId, effort, signal);
      else await client.updateInstructions(saved, instructions, signal);
      signal.throwIfAborted();
      if (!saveModel) {
        setSaved({ ...saved, instructions });
        return;
      }
      const remote = (await client.list(signal)).find(
        (row) => row.pubkey === saved.pubkey,
      );
      signal.throwIfAborted();
      if (!remote) throw localError("builderlabSettings.notFound");
      // Model readback must not replace the instructions draft with an omitted
      // or stale value. Only model fields need server validity confirmation.
      setSaved({ ...remote, instructions });
      setModelId(remote.modelId ?? "");
      setEffort(remote.reasoningEffort ?? "");
      if (remote.modelSelectionStatus === "valid")
        notify(
          <TranslatedMessage
            value={localMessage("builderlabSettings.saved")}
          />,
          "success",
        );
    } catch (reason) {
      if (!signal.aborted && session.snapshot().status === "signed-in")
        setError(reason);
    } finally {
      if (!signal.aborted) setSaving(false);
    }
  };
  const pending =
    hasAccess && ("pending" in settings ? settings.pending : loading);
  const [slow, setSlow] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: each agent/catalog retry starts a new loading phase, even if pending stays true.
  useEffect(() => {
    setSlow(false);
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [pending, agent, revision]);
  const placeholder =
    login.status !== "signed-in"
      ? ""
      : pending
        ? slow
          ? "Still loading…"
          : "…"
        : "—";
  const placeholderLabel =
    login.status === "signed-in" && pending && slow
      ? t("builderlabSettings.stillLoading")
      : placeholder;
  const failure = hasAccess ? loadError || error || catalogError : "";
  return (
    <LoadingRegion
      pending={pending}
      label={
        agent
          ? t("agentModel.loadingModels")
          : t("builderlabSettings.loadingSettings")
      }
      statusVisibility="screen-reader"
      feedback={
        hasAccess && !failure && slow && pending ? (
          <div className="grid justify-items-start gap-2">
            <p role="status" className="m-0 text-body-sm text-secondary">
              {agent
                ? t("builderlabSettings.modelsSlow")
                : t("builderlabSettings.settingsSlow")}
            </p>
            <Button
              onClick={() => {
                if ("retry" in settings) settings.retry();
                else setRevision((value) => value + 1);
              }}
            >
              {agent
                ? t("builderlabCreate.retryModels")
                : t("builderlabCreate.retry")}
            </Button>
          </div>
        ) : undefined
      }
    >
      <AccountRecoverySheet
        session={session}
        openIdentity={openIdentity}
        active={accountProblem}
        onSwitchAccount={() => setRetrySignIn("switching")}
        email={email}
        mismatch={mismatch}
        detail={accessError ? message(accessError) : undefined}
      />
      <SettingsErrorSheet
        active={!!failure}
        title={
          loadError
            ? "Couldn’t load settings"
            : error
              ? "Couldn’t save changes"
              : "Couldn’t load models"
        }
        titleLabel={t(
          loadError
            ? "builderlabSettings.loadSettingsTitle"
            : error
              ? "builderlabSettings.saveTitle"
              : "builderlabSettings.loadModelsTitle",
        )}
        message={message(failure)}
        action={{
          label: loadError
            ? t("builderlabCreate.retry")
            : error
              ? t("builderlabSettings.tryAgain")
              : t("builderlabCreate.retryModels"),
          disabled: loadError ? false : error ? disabled : busy,
          run: () => {
            if (loadError && "retry" in settings) settings.retry();
            else if (error) void save();
            else setRevision((value) => value + 1);
          },
        }}
      />
      <form
        id={form}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {hasAccess && saved && saved.modelSelectionStatus !== "valid" && (
          <p role="status" className="m-0 text-body-sm text-warning">
            {t(statuses[saved.modelSelectionStatus ?? "unknown"])}
            {saved.modelId &&
              t("builderlabSettings.savedModel", {
                model:
                  models?.find((choice) => choice.id === saved.modelId)
                    ?.displayName ?? saved.modelId,
              })}
            {saved.reasoningEffort &&
              t("builderlabSettings.savedThinking", {
                effort: effortLabel(saved.reasoningEffort),
              })}
          </p>
        )}
        <SettingsGroup>
          <SignInAction
            session={session}
            automatic
            retry={
              retrySignIn
                ? {
                    waiting: waitingToRetry,
                    cancel: () => setRetrySignIn("ready"),
                  }
                : undefined
            }
            render={(action, feedback) => (
              <div>
                {harnessControl?.(action) ?? (
                  <PreferenceRow
                    title={t("agentCreate.harness")}
                    trailing={
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <BuilderlabLogoIcon size={20} aria-hidden="true" />
                          Builderlab
                        </span>
                        {action}
                      </div>
                    }
                  />
                )}
                {login.status === "signed-out" && !waitingToRetry && (
                  <p className="m-0 pb-3 text-body-sm text-secondary">
                    {t("builderlabSettings.signInHint")}
                  </p>
                )}
                {feedback && <div className="pb-3">{feedback}</div>}
              </div>
            )}
          />
          <ModelFamilyMenu
            label={t("agentCreate.model")}
            align="end"
            selected={
              model
                ? modelChoice(model)
                : {
                    id: "",
                    label: models?.length ? "Choose a model" : placeholder,
                  }
            }
            selectionLabel={
              model
                ? undefined
                : models?.length
                  ? t("builderlabCreate.chooseModel")
                  : placeholderLabel
            }
            models={(models ?? []).map(modelChoice)}
            disabled={busy || !models?.length}
            onChange={(next) => {
              setModelId(next);
              setEffort("");
            }}
          />
          <Select
            label={t("agentCreate.thinking")}
            variant="preference"
            align="end"
            value={valid ? effort : ""}
            placeholder={
              models?.length
                ? t("builderlabCreate.chooseThinking")
                : placeholderLabel
            }
            disabled={busy || !model}
            groups={[
              {
                label: "",
                options: (model?.supportedReasoningEfforts ?? []).map(
                  (value) => ({ value, label: effortLabel(value) }),
                ),
              },
            ]}
            onValueChange={setEffort}
          />
        </SettingsGroup>
        {hasAccess && models?.length === 0 && (
          <p className="m-0 text-body-sm text-secondary">
            {t("builderlabCreate.emptyCatalog")}
          </p>
        )}
        <AnimatePresence initial={false}>
          {signedIn && (
            <motion.div
              key="instructions"
              initial={{
                opacity: reducedMotion ? 1 : 0,
                y: reducedMotion ? 0 : 8,
              }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.22 }}
            >
              <Field
                label={t("agentCreate.instructions")}
                error={
                  hasAccess && !validInstructions(instructions)
                    ? t("builderlabSettings.invalidInstructions")
                    : undefined
                }
              >
                <Textarea
                  appearance="outlined"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  disabled={!saved || saving || !hasAccess}
                  rows={8}
                  maxLength={MAX_INSTRUCTIONS_LENGTH}
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
        <AgentSaveButton
          form={form}
          saving={saving}
          disabled={disabled}
          dirty={modelChanged || instructionsChanged}
        />
        {hasAccess && !failure && models?.length === 0 && (
          <div>
            <Button
              disabled={busy}
              onClick={() => setRevision((value) => value + 1)}
            >
              {t("builderlabCreate.retryModels")}
            </Button>
          </div>
        )}
      </form>
    </LoadingRegion>
  );
}
