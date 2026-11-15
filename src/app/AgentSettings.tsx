import { t, useLanguage } from "../shared/i18n";
import { useState } from "react";
import type { PageNavigation } from "../features/navigation/service";
import type { Agents } from "../features/agents/service";
import { AgentDefaults } from "../bundled/agents/AgentDefaults";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";

import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { SwitchPreferenceRow } from "../shared/design-system/ui/SwitchPreferenceRow";
import { ToastNotice } from "../shared/design-system/ui/Toast";
import { Button } from "../shared/design-system/ui/Button";
import {
  setRememberAgentsPreference,
  useRememberAgentsPreference,
} from "../features/messages/mention-preferences";
import { isTauri } from "@tauri-apps/api/core";
import { isApplePlatform } from "../features/shortcuts/format";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { Select } from "../shared/design-system/ui/Select";
import {
  keepAwakeDelays,
  retryKeepAwake,
  setKeepAwakePreference,
  useKeepAwakeApplyError,
  useKeepAwakePreference,
  type KeepAwake,
} from "../features/agents/keep-awake";

const keepAwakeModes = [
  { value: "off", label: "Off" },
  { value: "auto", label: "While agents work" },
  { value: "on", label: "Always" },
] as const;
const delayLabel = (minutes: number) =>
  minutes < 60
    ? t("settings.minutes", { count: minutes })
    : t(minutes === 60 ? "settings.hour" : "settings.hours", {
        count: minutes / 60,
      });

export function AgentSettings({
  agents,
  active = true,
  navigation,
  onProvider,
  keepAwakeAvailable = isTauri() && isApplePlatform(navigator.platform),
}: {
  agents?: Agents | undefined;
  active?: boolean;
  navigation?: PageNavigation | undefined;
  onProvider?: ((provider?: string) => void) | undefined;
  /** Only the macOS app can keep the computer awake. */
  keepAwakeAvailable?: boolean;
}) {
  useLanguage();
  const rememberAgents = useRememberAgentsPreference();
  const keepAwake = useKeepAwakePreference();
  const keepAwakeApplyError = useKeepAwakeApplyError();
  const [mentionError, setMentionError] = useState<string | null>(null);
  const [keepAwakeError, setKeepAwakeError] = useState<string | null>(null);
  const changeRememberAgents = (enabled: boolean) =>
    setMentionError(setRememberAgentsPreference(enabled));
  const changeKeepAwake = (change: Partial<KeepAwake>) =>
    setKeepAwakeError(setKeepAwakePreference({ ...keepAwake, ...change }));
  return (
    <section aria-labelledby="agent-settings-title">
      <Header id="agent-settings-title" title={t("settings.agentSetup")} />
      {agents && active && (
        <AgentDefaults
          agents={agents}
          navigation={navigation}
          onProvider={onProvider}
        />
      )}
      <div className="mt-section-gap">
        <InlineHeader title={t("settings.agentBehavior")} />
        <SettingsGroup>
          <SwitchPreferenceRow
            label={t("settings.rememberAgents")}
            description={t("settings.rememberAgentsDescription")}
            checked={rememberAgents}
            onCheckedChange={changeRememberAgents}
          />
          {keepAwakeAvailable && (
            <PreferenceRow
              title={t("settings.keepAwake")}
              subtitle={t("settings.keepAwakeDescription")}
              trailing={
                <Select
                  label={t("settings.keepAwake")}
                  variant="compact"
                  value={keepAwake.mode}
                  groups={[
                    {
                      label: "",
                      options: keepAwakeModes.map((mode) => ({
                        ...mode,
                        label: t(
                          (
                            {
                              off: "settings.awakeOff",
                              auto: "settings.awakeAuto",
                              on: "settings.awakeOn",
                            } as const
                          )[mode.value],
                        ),
                      })),
                    },
                  ]}
                  onValueChange={(mode) =>
                    changeKeepAwake({ mode: mode as KeepAwake["mode"] })
                  }
                />
              }
            />
          )}
          {keepAwakeAvailable && keepAwake.mode === "auto" && (
            <PreferenceRow
              title={t("settings.afterAgents")}
              trailing={
                <Select
                  label={t("settings.afterAgents")}
                  variant="compact"
                  value={String(keepAwake.after)}
                  groups={[
                    {
                      label: "",
                      options: keepAwakeDelays.map((minutes) => ({
                        value: String(minutes),
                        label: delayLabel(minutes),
                      })),
                    },
                  ]}
                  onValueChange={(after) =>
                    changeKeepAwake({ after: Number(after) })
                  }
                />
              }
            />
          )}
        </SettingsGroup>
      </div>
      {active && mentionError && (
        <ToastNotice
          title={t("settings.agentSaveFailed")}
          description={mentionError}
        >
          <Button
            type="button"
            size="sm"
            onClick={() => changeRememberAgents(rememberAgents)}
          >
            {t("settings.retryRememberAgents")}
          </Button>
        </ToastNotice>
      )}
      {/* One notice at a time; whether the Mac sleeps matters more than
          whether the choice outlives a restart. */}
      {active &&
        (keepAwakeAvailable && keepAwakeApplyError ? (
          <ToastNotice title={keepAwakeApplyError}>
            <Button type="button" size="sm" onClick={retryKeepAwake}>
              {t("settings.tryAgain")}
            </Button>
          </ToastNotice>
        ) : (
          keepAwakeError && (
            <ToastNotice
              title={t("settings.awakeSaveFailed")}
              description={keepAwakeError}
            >
              <Button
                type="button"
                size="sm"
                onClick={() => changeKeepAwake(keepAwake)}
              >
                {t("settings.tryAgain")}
              </Button>
            </ToastNotice>
          )
        ))}
    </section>
  );
}
