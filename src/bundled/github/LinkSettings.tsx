import { t, useLanguage } from "../../shared/i18n";
import { useState } from "react";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { SwitchPreferenceRow } from "../../shared/design-system/ui/SwitchPreferenceRow";
import {
  setOpenGitHubLinksInBuzz,
  useOpenGitHubLinksInBuzz,
} from "./link-preference";

export function LinkSettings({ active }: { active(): boolean }) {
  useLanguage();
  const enabled = useOpenGitHubLinksInBuzz();
  const [error, setError] = useState(false);
  return (
    <section aria-label={t("githubSettings.linksSettings")}>
      <InlineHeader title={t("githubSettings.links")} />
      <SettingsGroup>
        <SwitchPreferenceRow
          label={t("githubSettings.openLinks")}
          description={t("githubSettings.openLinksHelp")}
          checked={enabled}
          onCheckedChange={(next) => {
            if (!active()) return;
            try {
              setOpenGitHubLinksInBuzz(next);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        />
      </SettingsGroup>
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {t("githubSettings.choiceFailed")}
        </p>
      )}
    </section>
  );
}
