import { t, useLanguage } from "../../shared/i18n";
import { useSyncExternalStore } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { ToastNotice } from "../../shared/design-system/ui/Toast";
import type { Updates } from "./updates";

/** Reports a failed install and its retry outside Settings; the top-bar action offers ready updates. */
export function UpdateNotice({ updates }: { updates: Updates }) {
  useLanguage();
  const status = useSyncExternalStore(
    updates.subscribe,
    updates.snapshot,
    updates.snapshot,
  );
  const inline = useSyncExternalStore(
    updates.subscribe,
    updates.inlineVisible,
    updates.inlineVisible,
  );
  const recovery = useSyncExternalStore(
    updates.subscribe,
    updates.noticeRecovery,
    updates.noticeRecovery,
  );
  if (!recovery || inline) return null;
  const { state } = status;
  const descriptions = {
    idle: "",
    ready: "",
    installing: "",
    checking: t("settingsHost.noticeChecking"),
    available: t("settingsHost.noticePreparing"),
    downloading: t("settingsHost.noticeDownloading"),
    "up-to-date": t("settingsHost.updateLatest"),
    unavailable: t("settingsHost.updateUnavailable"),
    error: "",
  };
  return (
    <ToastNotice
      title={
        state === "error"
          ? t("settingsHost.updateFailed")
          : t("settingsHost.updatesRecoveryTitle")
      }
      description={
        status.state === "error" ? status.message : descriptions[state]
      }
      tone={state === "error" ? "error" : "info"}
      onDismiss={updates.dismissNotice}
      closeLabel={t("settingsHost.dismissUpdate")}
    >
      <Button
        type="button"
        size="sm"
        loading={["checking", "available", "downloading"].includes(state)}
        onClick={() => void updates.checkForUpdate()}
      >
        {t("settingsHost.retry")}
      </Button>
    </ToastNotice>
  );
}
