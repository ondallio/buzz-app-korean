import { t, useLanguage } from "../../shared/i18n";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Checkbox } from "../../shared/design-system/ui/Checkbox";
import { readView, writeView } from "../../shared/view-state";

type Visibility = "private" | "public";
const preferenceKey = "channel-privacy-confirmation:dismissed";

// View intent only: Create warnings in both directions, never authorization.
export function skipPrivacyConfirmation(scope: string) {
  // Honor opt-outs saved before the two directions shared one preference.
  return [
    preferenceKey,
    "channel-privacy-confirmation:private:dismissed",
    "channel-privacy-confirmation:public:dismissed",
  ].some((key) => readView<unknown>(scope, key, false) === true);
}

export function rememberPrivacyConfirmation(scope: string) {
  writeView(scope, preferenceKey, true);
}

export function privacyConsequence(visibility: Visibility) {
  return visibility === "private"
    ? t("channelsMenus.privacy.private")
    : t("channelsMenus.privacy.public");
}

export function ChannelPrivacyConfirmation({
  visibility,
  checked,
  onCheckedChange,
  hidePreference = false,
}: {
  hidePreference?: boolean;
  visibility: Visibility;
  checked: boolean;
  onCheckedChange(checked: boolean): void;
}) {
  useLanguage();
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <BaseDialog.Description>
        {privacyConsequence(visibility)}
      </BaseDialog.Description>
      {!hidePreference && (
        <Checkbox
          label={t("channelsMenus.privacy.dontShow")}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      )}
    </div>
  );
}
