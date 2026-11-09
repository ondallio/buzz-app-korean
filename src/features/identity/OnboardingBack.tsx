import { t, useLanguage } from "../../shared/i18n";
import { ArrowLeftIcon } from "../../shared/design-system/icons";
import {
  IconButton,
  type IconButtonProps,
} from "../../shared/design-system/ui/IconButton";

export function OnboardingBack({
  "aria-label": label,
  ...props
}: Omit<IconButtonProps, "icon" | "aria-label"> & { "aria-label"?: string }) {
  useLanguage();
  return (
    <IconButton
      {...props}
      aria-label={label === undefined ? t("identity.back") : label}
      icon={<ArrowLeftIcon />}
      size="lg"
      shape="round"
      variant="subtle"
      data-onboarding-back=""
    />
  );
}
