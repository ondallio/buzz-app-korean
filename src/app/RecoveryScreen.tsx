import { t, useLanguage } from "../shared/i18n";
import { Button } from "../shared/design-system/ui/Button";
// FOUNDATION: Recovery must remain usable without executing any plugin.
import { useSyncExternalStore } from "react";
import type { PluginManager } from "../plugins/manager";

export function RecoveryScreen({ plugins }: { plugins: PluginManager }) {
  useLanguage();
  const { configuration, busy, error } = useSyncExternalStore(
    plugins.subscribe,
    plugins.snapshot,
  );
  if (configuration.status !== "recovery") return null;
  const { reason, canReset } = configuration;
  return (
    <section className="rounded-3xl border border-line bg-surface p-8 shadow-surface">
      <h1>{t("recovery.title")}</h1>
      <p>{t("recovery.help")}</p>
      <details>
        <summary>{t("recovery.details")}</summary>
        <p>{reason}</p>
      </details>
      <Button type="button" disabled={busy} onClick={plugins.retry}>
        {t("recovery.retry")}
      </Button>
      {canReset ? (
        <>
          <p>{t("recovery.resetHelp")}</p>
          <Button
            variant="destructive"
            type="button"
            disabled={busy}
            onClick={plugins.recover}
          >
            {t("recovery.reset")}
          </Button>
        </>
      ) : (
        <p>{t("recovery.restartHelp")}</p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
