import { useState } from "react";
import {
  CHANNEL_DURATIONS,
  channelDurationLabel,
} from "../../bundled/channels/ChannelDurationField";
import { Select } from "../../shared/design-system/ui/Select";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { t, useLanguage } from "../../shared/i18n";
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
        label={t("u275f02.lifetime.label")}
        description={t("u275f02.lifetime.description")}
        value={ttlSeconds === undefined ? "ongoing" : String(ttlSeconds)}
        valueLabel={
          ttlSeconds === undefined
            ? t("channelForms.duration.ongoing")
            : t("u275f02.lifetime.temporary", {
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
                label: t("u275f02.lifetime.temporary", {
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
              : t("u275f02.lifetime.saveFailed"),
          );
        }}
      />
    </SettingsGroup>
  );
}
