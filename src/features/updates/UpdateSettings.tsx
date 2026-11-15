import { t, useLanguage } from "../../shared/i18n";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { Button } from "../../shared/design-system/ui/Button";
import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import { ArrowsClockwiseIcon } from "../../shared/design-system/icons";
import { Header } from "../../shared/design-system/ui/Header";
import type { Updates } from "./updates";

export function UpdateSettings({
  updates,
  active,
}: {
  updates: Updates;
  active: boolean;
}) {
  useLanguage();
  const status = useSyncExternalStore(
    updates.subscribe,
    updates.snapshot,
    updates.snapshot,
  );
  useEffect(
    () => (active ? updates.showInline() : undefined),
    [active, updates],
  );
  // Browser builds have no native version; leave it unset there.
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    getVersion()
      .then((found) => {
        if (!cancelled) setVersion(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const pending = [
    "checking",
    "available",
    "downloading",
    "installing",
  ].includes(status.state);
  const messages = {
    idle: t("settingsHost.updateIdle"),
    checking: t("settingsHost.updateChecking"),
    "up-to-date": t("settingsHost.updateLatest"),
    unavailable: t("settingsHost.updateUnavailable"),
    available: t("settingsHost.updatePreparing"),
    downloading: t("settingsHost.updateDownloading"),
    installing: t("settingsHost.updateInstalling"),
    ready: t("settingsHost.updateReady"),
    error: "",
  };
  const label =
    status.state === "ready" || status.state === "installing"
      ? t("settingsHost.updateNow")
      : status.state === "error"
        ? t("settingsHost.retry")
        : status.state === "up-to-date" || status.state === "unavailable"
          ? t("settingsHost.checkAgain")
          : t("settingsHost.checkUpdates");
  return (
    <section aria-labelledby="update-settings-title">
      <Header
        id="update-settings-title"
        title={t("settingsHost.updatesTitle")}
      />
      <EmptyState
        icon={<ArrowsClockwiseIcon />}
        title={
          version
            ? t("settingsHost.version", { version })
            : t("settingsHost.updateStatus")
        }
        description={
          <span role="status">
            {status.state === "error" ? (
              <span className="error">
                {t("settingsHost.updateFailedDetail", {
                  error: status.message,
                })}
              </span>
            ) : (
              messages[status.state]
            )}
          </span>
        }
        action={
          <Button
            type="button"
            loading={pending}
            onClick={() =>
              void (status.state === "ready"
                ? updates.installAndRelaunch()
                : updates.checkForUpdate())
            }
          >
            {label}
          </Button>
        }
      />
    </section>
  );
}
