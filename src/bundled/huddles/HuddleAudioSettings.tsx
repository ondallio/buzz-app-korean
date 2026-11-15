import { t, useLanguage } from "../../shared/i18n";
import type { AudioSettingsState } from "../../features/huddle/audio-settings";
import { GearIcon } from "../../shared/design-system/icons";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Select } from "../../shared/design-system/ui/Select";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPopup,
  PopoverTitle,
} from "../../shared/design-system/ui/Popover";

export function HuddleAudioSettings({
  state,
  compact = false,
  quiet = false,
  refresh,
  select,
}: {
  state: AudioSettingsState | undefined;
  compact?: boolean;
  quiet?: boolean;
  refresh(): void;
  select(kind: "input" | "output", id: string): void;
}) {
  useLanguage();
  return (
    <PopoverRoot
      onOpenChange={(open) => {
        if (open) refresh();
      }}
    >
      <PopoverTrigger
        render={
          <IconButton
            size={compact ? "toolbar" : "large"}
            shape={compact ? "control" : "round"}
            variant={compact || quiet ? "ghost" : "subtle"}
            aria-label={t("huddleCall.audioSettings")}
            title={t("huddleCall.audioSettings")}
            icon={
              <GearIcon
                size={compact ? 16 : 22}
                className={quiet ? "text-secondary" : undefined}
              />
            }
          />
        }
      />
      <PopoverPopup align="start" size="compact">
        <div className="flex flex-col gap-3">
          <PopoverTitle>{t("huddleCall.audioSettings")}</PopoverTitle>
          {state ? (
            <>
              {(["input", "output"] as const).map((kind) => {
                const devices = kind === "input" ? state.inputs : state.outputs;
                const selected = state[kind];
                const unavailable =
                  selected && !devices.some((device) => device.id === selected);
                return (
                  <Select
                    key={kind}
                    label={t(
                      kind === "input"
                        ? "huddleCall.microphone"
                        : "huddleCall.speakers",
                    )}
                    variant="field"
                    value={selected}
                    readOnly={state.busy}
                    disabled={kind === "output" && !state.outputSupported}
                    description={
                      kind === "output" && !state.outputSupported
                        ? t("huddleCall.systemSpeakers")
                        : undefined
                    }
                    groups={[
                      {
                        label: "",
                        options: [
                          { value: "", label: t("huddleCall.systemDefault") },
                          ...devices.map((device) => ({
                            value: device.id,
                            label: device.label,
                          })),
                          ...(unavailable
                            ? [
                                {
                                  value: selected,
                                  label: t("huddleCall.unavailableDevice"),
                                  disabled: true,
                                },
                              ]
                            : []),
                        ],
                      },
                    ]}
                    onValueChange={(id) => select(kind, id)}
                  />
                );
              })}
              {state.busy && (
                <p role="status" className="text-caption text-secondary">
                  {t("huddleCall.switching")}
                </p>
              )}
              {state.error && (
                <p role="alert" className="text-caption text-secondary">
                  {state.error}
                </p>
              )}
            </>
          ) : (
            <p role="status" className="text-body-sm text-secondary">
              {t("huddleCall.audioUnavailable")}
            </p>
          )}
        </div>
      </PopoverPopup>
    </PopoverRoot>
  );
}
