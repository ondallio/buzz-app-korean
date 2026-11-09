import { t, useLanguage } from "../../shared/i18n";
import { useSyncExternalStore } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { ToastNotice } from "../../shared/design-system/ui/Toast";
import type { Updates } from "./updates";

/** Offers restart once a downloaded update is ready, except while Settings shows it inline; dismissal lasts until it resolves. */
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
  const dismissed = useSyncExternalStore(
    updates.subscribe,
    updates.noticeDismissed,
    updates.noticeDismissed,
  );
  const recovery = useSyncExternalStore(
    updates.subscribe,
    updates.noticeRecovery,
    updates.noticeRecovery,
  );
  const { state } = status;
  const visible = state === "ready" || state === "installing" || recovery;
  if (!visible || dismissed || inline) return null;
  const pending = [
    "checking",
    "available",
    "downloading",
    "installing",
  ].includes(state);
  const descriptions = {
    idle: t("settingsHost.clickUpdate"),
    ready: t("settingsHost.clickUpdate"),
    installing: t("settingsHost.updating"),
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
          : recovery
            ? t("settingsHost.updatesRecoveryTitle")
            : t("settingsHost.readyToUpdate")
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
        loading={pending}
        onClick={() =>
          void (state === "ready"
            ? updates.installAndRelaunch()
            : updates.checkForUpdate())
        }
      >
        {state === "ready" || state === "installing"
          ? t("settingsHost.updateNow")
          : t("settingsHost.retry")}
      </Button>
    </ToastNotice>
  );
}
