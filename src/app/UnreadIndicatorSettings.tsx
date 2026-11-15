import { t, useLanguage } from "../shared/i18n";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { InlineHeader } from "../shared/design-system/ui/Header";
import { ToastNotice } from "../shared/design-system/ui/Toast";
import { useSyncExternalStore } from "react";
import type { UnreadIndicator } from "../features/notifications/indicator";
import { Button } from "../shared/design-system/ui/Button";
import { usePermissionCheck } from "./usePermissionCheck";

export function UnreadIndicatorSettings({
  indicator,
  active = true,
}: {
  indicator: UnreadIndicator;
  active?: boolean;
}) {
  useLanguage();
  const state = useSyncExternalStore(indicator.subscribe, indicator.snapshot);
  const [checking, checkPermission] = usePermissionCheck(indicator.refresh);
  if (!indicator.available) return null;
  return (
    <div className="space-y-3">
      <InlineHeader title={t("notifications.dock.title")} />
      <SettingsGroup layout="form">
        <p className="text-body-sm text-subtle">
          {state.permission === "unavailable"
            ? t("notifications.dock.unavailable")
            : t("notifications.dock.description")}
        </p>
        {state.permission !== "unavailable" && (
          <p role="status" className="text-body-sm text-muted">
            {state.requesting
              ? t("notifications.permission.waiting")
              : {
                  default: t("notifications.dock.default"),
                  setup: t("notifications.dock.setupStatus"),
                  enabled: t("notifications.dock.enabled"),
                  disabled: t("notifications.dock.disabled"),
                  denied: t("notifications.dock.denied"),
                }[state.permission]}
          </p>
        )}
        {state.permission !== "unavailable" && (
          <div className="flex flex-wrap gap-2">
            {(state.permission === "default" ||
              state.permission === "setup") && (
              <Button
                type="button"
                disabled={state.requesting}
                onClick={() => void indicator.request()}
              >
                {state.permission === "setup"
                  ? t("notifications.dock.setup")
                  : t("notifications.dock.allow")}
              </Button>
            )}
            <Button
              type="button"
              disabled={state.requesting}
              loading={checking}
              onClick={checkPermission}
            >
              {t("notifications.dock.check")}
            </Button>
          </div>
        )}
      </SettingsGroup>
      {active && state.error && (
        <ToastNotice
          title={t("notifications.dock.error")}
          description={state.error}
        />
      )}
    </div>
  );
}
