import { useId, useRef, useState, useSyncExternalStore } from "react";
import { randomAgentAvatar } from "../../features/agents/avatar-packs";
import type { Agents } from "../../features/agents/service";
import { Button } from "../../shared/design-system/ui/Button";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { t, useLanguage } from "../../shared/i18n";
import { DEFAULT_MESH_AGENT_CONFIG, meshAgentConfig } from "./meshAgent";
import {
  MESH_AGENT_PRESETS,
  type MeshAgentPreset,
  presetSummary,
} from "./meshAgentPresets";

/** Presets use the same creation service as Agents; editing stays in Settings. */
export function MeshHelpers({ agents }: { agents: Agents }) {
  useLanguage();
  const state = useSyncExternalStore(agents.subscribe, agents.snapshot);
  const title = useId();
  const disclosure = useId();
  const busy = useRef(false);
  const [pending, setPending] = useState<string>();
  const [created, setCreated] = useState("");
  const [error, setError] = useState("");
  const type = agents
    .types()
    .find(
      (item) => item.pluginId === "buzz.mesh-compute" && item.id === "mesh",
    );
  const existing = (preset: MeshAgentPreset | null) =>
    state.agents.find(
      (agent) =>
        agent.type === type?.key &&
        (preset
          ? meshAgentConfig(agent.config).preset === preset.id
          : !meshAgentConfig(agent.config).preset &&
            agent.name === "Custom agent"),
    );
  const create = async (preset: MeshAgentPreset | null) => {
    if (busy.current || !type || state.status !== "ready" || existing(preset))
      return;
    const name = preset?.name ?? "Custom agent";
    busy.current = true;
    setPending(name);
    setCreated("");
    setError("");
    try {
      const agent = await agents.create({
        type: type.key,
        name,
        picture: randomAgentAvatar().url,
        config: {
          ...DEFAULT_MESH_AGENT_CONFIG,
          ...(preset
            ? {
                preset: preset.id,
                prompt: preset.prompt,
                mode: preset.mode,
              }
            : {}),
        },
      });
      setCreated(agent.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      busy.current = false;
      setPending(undefined);
    }
  };
  return (
    <section aria-labelledby={title} className="grid gap-3">
      <InlineHeader
        id={title}
        title={t("fubestie.helpers.title")}
        subtitle={<span id={disclosure}>{t("fubestie.helpers.subtitle")}</span>}
      />
      <SettingsGroup>
        {[...MESH_AGENT_PRESETS, null].map((preset) => {
          const name = preset?.name ?? "Custom agent";
          const made = existing(preset);
          const mode = preset?.mode ?? DEFAULT_MESH_AGENT_CONFIG.mode;
          return (
            <PreferenceRow
              key={preset?.id ?? "custom"}
              title={made ? t("fubestie.helpers.createdTitle", { name }) : name}
              subtitle={`${preset ? presetSummary(preset) : t("fubestie.helpers.defaultSummary")} ${mode === "chat" ? t("fubestie.helpers.chatMode") : t("fubestie.helpers.agentMode")}`}
              trailing={
                <Button
                  size="sm"
                  aria-describedby={disclosure}
                  disabled={
                    !type ||
                    state.status !== "ready" ||
                    pending !== undefined ||
                    Boolean(made)
                  }
                  loading={pending === name}
                  aria-label={
                    made
                      ? t("fubestie.helpers.createdAs", {
                          name,
                          agent: made.name,
                        })
                      : t("fubestie.helpers.createName", { name })
                  }
                  onClick={() => void create(preset)}
                >
                  {made
                    ? t("fubestie.helpers.created")
                    : t("fubestie.helpers.create")}
                </Button>
              }
            />
          );
        })}
      </SettingsGroup>
      {state.status !== "ready" && (
        <p role="status" className="m-0 text-body-sm text-secondary">
          {state.error ?? t("fubestie.helpers.waiting")}
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 text-body-sm text-danger">
          {error}
        </p>
      )}
      {created && (
        <p role="status" className="m-0 text-body-sm text-secondary">
          {t("fubestie.helpers.createdNotice", { created })}
        </p>
      )}
    </section>
  );
}
