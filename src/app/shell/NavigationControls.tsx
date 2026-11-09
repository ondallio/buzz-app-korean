import { t, useLanguage } from "../../shared/i18n";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { useSyncExternalStore } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "../../shared/design-system/icons/index";
import type { Navigation } from "../../features/navigation/controller";
export function NavigationControls({ navigation }: { navigation: Navigation }) {
  useLanguage();
  const state = useSyncExternalStore(navigation.subscribe, navigation.snapshot);
  return (
    <nav
      className="flex shrink-0 items-center gap-0"
      aria-label={t("shell.history.label")}
    >
      <IconButton
        hint="familiar"
        type="button"
        variant="ghost"
        aria-label={t("shell.history.back")}
        title={t("shell.history.back")}
        disabled={!state.canGoBack}
        onClick={navigation.back}
        icon={<ArrowLeftIcon size={16} aria-hidden="true" />}
      />
      <IconButton
        hint="familiar"
        type="button"
        variant="ghost"
        aria-label={t("shell.history.forward")}
        title={t("shell.history.forward")}
        disabled={!state.canGoForward}
        onClick={navigation.forward}
        icon={<ArrowRightIcon size={16} aria-hidden="true" />}
      />
    </nav>
  );
}
