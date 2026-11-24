import { useState } from "react";
import type { AgentViewProps } from "../../features/agents/service";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { Select } from "../../shared/design-system/ui/Select";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { t, useLanguage } from "../../shared/i18n";
import {
  DEFAULT_WORKSPACE,
  type MeshAgentConfig,
  type MeshMode,
  meshAgentConfig,
  validWorkspace,
} from "./meshAgent";
import { MESH_AGENT_PRESETS, presetSummary } from "./meshAgentPresets";

const options = (choices: readonly (readonly [string, string])[]) => [
  { label: "", options: choices.map(([value, label]) => ({ value, label })) },
];
const modes = () =>
  options([
    ["chat", t("fubestie.meshTab.chat")],
    ["agent", t("fubestie.meshTab.agent")],
  ]);
const modeDescription = (mode: MeshMode) =>
  mode === "chat"
    ? t("fubestie.meshTab.chatDescription")
    : t("fubestie.meshTab.agentDescription");
const scopes = () =>
  options([
    ["thread", t("fubestie.meshTab.perThread")],
    ["channel", t("fubestie.meshTab.perChannel")],
  ]);
const CUSTOM = "custom";
const presets = () =>
  options([
    [CUSTOM, t("fubestie.meshTab.custom")],
    ...MESH_AGENT_PRESETS.map((preset) => [preset.id, preset.name] as const),
  ]);

/** The Mesh type's settings: a starting preset, prompt, mode, sessions and
 * working directory. */
export function MeshAgentTab({ agent, save }: AgentViewProps<MeshAgentConfig>) {
  useLanguage();
  const saved = meshAgentConfig(agent.config);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const workspaceValid = validWorkspace(draft.workspace);
  const changed =
    draft.prompt !== saved.prompt ||
    draft.workspace.trim() !== saved.workspace ||
    draft.mode !== saved.mode ||
    draft.scope !== saved.scope ||
    draft.preset !== saved.preset;
  const preset = MESH_AGENT_PRESETS.find((item) => item.id === draft.preset);
  const submit = async () => {
    if (!changed || saving || !workspaceValid) return;
    setSaving(true);
    setError(undefined);
    try {
      await save({ ...draft, workspace: draft.workspace.trim() });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Select
        label={t("fubestie.meshTab.startFrom")}
        variant="field"
        value={draft.preset ?? CUSTOM}
        groups={presets()}
        description={
          preset ? presetSummary(preset) : t("fubestie.meshTab.startFromHint")
        }
        onValueChange={(value) => {
          const picked = MESH_AGENT_PRESETS.find((item) => item.id === value);
          if (!picked) {
            const { preset: _, ...rest } = draft;
            setDraft(rest);
            return;
          }
          setDraft({
            ...draft,
            preset: picked.id,
            prompt: picked.prompt,
            mode: picked.mode,
          });
        }}
      />
      <Field
        label={t("fubestie.meshTab.prompt")}
        description={t("fubestie.meshTab.promptDescription")}
      >
        <Textarea
          rows={8}
          value={draft.prompt}
          onChange={(event) =>
            setDraft({ ...draft, prompt: event.target.value })
          }
        />
      </Field>
      <Select
        label={t("fubestie.meshTab.mode")}
        variant="field"
        value={draft.mode}
        groups={modes()}
        description={modeDescription(draft.mode)}
        onValueChange={(value) =>
          setDraft({
            ...draft,
            mode: value === "chat" ? "chat" : "agent",
          })
        }
      />
      <Select
        label={t("fubestie.meshTab.sessions")}
        description={t("v106ag.scope.description")}
        variant="field"
        value={draft.scope}
        groups={scopes()}
        onValueChange={(value) =>
          setDraft({
            ...draft,
            scope: value === "channel" ? "channel" : "thread",
          })
        }
      />
      {draft.mode !== "chat" && (
        <Field
          label={t("fubestie.meshTab.workspace")}
          description={t("fubestie.meshTab.workspaceDescription", {
            workspace: DEFAULT_WORKSPACE,
          })}
          error={
            workspaceValid ? undefined : t("fubestie.meshTab.absolutePath")
          }
        >
          <Input
            value={draft.workspace}
            onChange={(event) =>
              setDraft({ ...draft, workspace: event.target.value })
            }
          />
        </Field>
      )}
      {error && (
        <p role="alert" className="buzz-field-error">
          {error}
        </p>
      )}
      <div>
        <Button
          type="submit"
          variant="prominent"
          loading={saving}
          disabled={!changed || !workspaceValid}
          focusableWhenDisabled
        >
          {t("fubestie.meshTab.save")}
        </Button>
      </div>
    </form>
  );
}
