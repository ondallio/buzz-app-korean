import { useState } from "react";
import { t, useLanguage } from "../../shared/i18n";
import {
  CHANNEL_DURATIONS,
  channelDurationLabel,
} from "../../bundled/channels/ChannelDurationField";
import { Select } from "../../shared/design-system/ui/Select";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { useDefaultLifetime, writeDefaultLifetime } from "./default-lifetime";

/** The lifetime New chat starts Solo chats with, saved as soon as it
 * changes. The same choices as a chat's own lifetime setting. */
export function DefaultLifetimeSettings({ scope }: { scope: string }) {
  useLanguage();
  const ttlSeconds = useDefaultLifetime(scope);
  const [error, setError] = useState("");
  return (
    <SettingsGroup>
      <Select
        variant="preference"
        label={t("soloLifetime.label")}
        description={t("soloLifetime.description")}
        value={ttlSeconds === undefined ? "ongoing" : String(ttlSeconds)}
        valueLabel={
          ttlSeconds === undefined
            ? t("channelForms.duration.ongoing")
            : t("soloLifetime.temporary", {
                duration: channelDurationLabel(ttlSeconds),
              })
        }
        error={error || undefined}
        groups={[
          {
            label: "",
            options: [
              {
                value: "ongoing",
                label: t("channelForms.duration.ongoing"),
                description: t("channelForms.duration.ongoingDescription"),
              },
              ...CHANNEL_DURATIONS.map((seconds) => ({
                value: String(seconds),
                label: t("soloLifetime.temporary", {
                  duration: channelDurationLabel(seconds),
                }),
                description: t("channelForms.duration.description", {
                  duration: channelDurationLabel(seconds),
                }),
              })),
            ],
          },
        ]}
        onValueChange={(value) => {
          setError(
            writeDefaultLifetime(
              scope,
              value === "ongoing" ? undefined : Number(value),
            )
              ? ""
              : t("soloLifetime.saveFailed"),
          );
        }}
      />
    </SettingsGroup>
  );
}
