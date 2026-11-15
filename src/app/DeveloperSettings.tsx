import { t, useLanguage, formattingLocale } from "../shared/i18n";
import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../shared/i18n/deferred-message";
import styles from "./DeveloperSettings.module.css";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { Button } from "../shared/design-system/ui/Button";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Select } from "../shared/design-system/ui/Select";
import {
  developerSettings,
  isLogLevel,
  logLevel,
  LOG_LEVELS,
  subscribeLogLevel,
} from "../features/developer/logging";
import type { RelayData } from "../features/relay/service";
import { clientMetrics } from "../features/developer/client-metrics";
import { ClientMetricsPanel } from "./ClientMetricsPanel";
import { SwitchPreferenceRow } from "../shared/design-system/ui/SwitchPreferenceRow";
import {
  importScenario,
  setImportScenario,
  subscribeImportScenario,
  type ImportScenario,
} from "../features/developer/agent-import-scenario";

const IMPORT_SCENARIOS: readonly { value: ImportScenario; label: string }[] = [
  { value: "off", label: "Real data" },
  { value: "none", label: "Nothing to import" },
  { value: "both", label: "Other communities and old Buzz" },
  { value: "communities", label: "Other communities only" },
  { value: "old", label: "Buzz (Legacy) only" },
];

type BrokerStats = {
  queries: number;
  errors: number;
  media: number;
  connects: number;
};

const STATS_POLL_MS = 5000;

/** Only the pinned development broker serves /api/relay/*. Missing stats in
 * that environment are normal, not an error. */
async function fetchStats(): Promise<BrokerStats | undefined> {
  try {
    const res = await fetch("/api/relay/stats");
    if (!res.ok) return undefined;
    return (await res.json()) as BrokerStats;
  } catch {
    return undefined;
  }
}

export function DeveloperSettings({ relay }: { relay: RelayData }) {
  useLanguage();
  const level = useSyncExternalStore(subscribeLogLevel, logLevel);
  const scenario = useSyncExternalStore(
    subscribeImportScenario,
    importScenario,
  );
  const [settingsReady, setSettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<DisplayMessage>();
  useEffect(() => {
    let alive = true;
    void developerSettings()
      .then(() => {
        if (alive) setSettingsReady(true);
      })
      .catch(() => {
        if (alive)
          setSettingsError(localMessage("settingsHost.runtimeUnavailable"));
      });
    return () => {
      alive = false;
    };
  }, []);
  async function saveLevel(value: string) {
    if (!isLogLevel(value)) return;
    setSaving(true);
    setSettingsError(undefined);
    try {
      await developerSettings(value);
    } catch {
      setSettingsError(localMessage("settingsHost.logLevelFailed"));
    } finally {
      setSaving(false);
    }
  }
  const brokerAvailable = import.meta.env.VITE_BUZZ_LIVE === "1";
  const [stats, setStats] = useState<BrokerStats>();
  const [clearing, setClearing] = useState(false);
  const [status, setStatus] = useState<DisplayMessage>();

  useEffect(() => {
    if (!brokerAvailable) return;
    let alive = true;
    async function poll() {
      const next = await fetchStats();
      if (alive) setStats(next);
    }
    void poll();
    const timer = setInterval(poll, STATS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  async function clearCache() {
    setClearing(true);
    try {
      await relay.clearCache();
      setStatus(localMessage("settingsHost.cacheCleared"));
    } catch (error) {
      setStatus(
        localMessage("settingsHost.cacheFailed", { error: String(error) }),
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    <section aria-labelledby="developer-settings-title">
      <Header
        id="developer-settings-title"
        title={t("settingsHost.developer")}
        subtitle={t("settingsHost.developerSubtitle")}
      />
      <div className="grid grid-cols-1 gap-section-gap">
        {brokerAvailable && (
          <section aria-labelledby="broker-activity-title">
            <InlineHeader
              id="broker-activity-title"
              title={t("settingsHost.brokerActivity")}
              subtitle={t("settingsHost.brokerSubtitle")}
            />
            <SettingsGroup layout="form">
              {stats ? (
                <dl className={styles.metrics}>
                  {(
                    [
                      ["Queries", stats.queries],
                      ["Errors", stats.errors],
                      ["Media", stats.media],
                      ["Connections", stats.connects],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-body-sm text-muted">
                        {t(
                          (
                            {
                              Queries: "settingsHost.queries",
                              Errors: "settingsHost.errors",
                              Media: "settingsHost.media",
                              Connections: "settingsHost.connections",
                            } as const
                          )[label],
                        )}
                      </dt>
                      <dd className="m-0 text-heading tabular-nums">
                        {Number.isFinite(value)
                          ? value.toLocaleString(formattingLocale())
                          : "–"}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p role="status" className="m-0 text-body-sm text-muted">
                  {t("settingsHost.brokerUnavailable")}
                </p>
              )}
            </SettingsGroup>
          </section>
        )}
        {clientMetrics.enabled && <ClientMetricsPanel />}
        <div className="space-y-2">
          <InlineHeader title={t("settingsHost.runtimeSettings")} />
          <SettingsGroup layout="form">
            <PreferenceRow
              title={t("settingsHost.logLevel")}
              subtitle={t("settingsHost.logLevelSaved")}
              trailing={
                <Select
                  label={t("settingsHost.logLevel")}
                  variant="compact"
                  value={level}
                  disabled={!settingsReady || saving}
                  onValueChange={(value) => void saveLevel(value)}
                  groups={[
                    {
                      label: "",
                      options: Object.keys(LOG_LEVELS).map((value) => ({
                        value,
                        label: t(
                          (
                            {
                              silent: "settingsHost.logSilent",
                              error: "settingsHost.logError",
                              warn: "settingsHost.logWarn",
                              info: "settingsHost.logInfo",
                              debug: "settingsHost.logDebug",
                              trace: "settingsHost.logTrace",
                            } as const
                          )[value as keyof typeof LOG_LEVELS],
                        ),
                      })),
                    },
                  ]}
                />
              }
            />
            <p className="m-0 text-body-sm text-subtle">
              {t("settingsHost.logLevelsDescription")}
            </p>
            {settingsError && (
              <p role="alert" className="m-0 text-body-sm text-muted">
                {resolveMessage(settingsError)}
              </p>
            )}
          </SettingsGroup>
        </div>
        <div className="space-y-2">
          <InlineHeader
            title={t("settingsHost.agentImport")}
            subtitle={t("settingsHost.importSubtitle")}
          />
          <SettingsGroup layout="form">
            <PreferenceRow
              title={t("settingsHost.importFinds")}
              trailing={
                <Select
                  label={t("settingsHost.importFinds")}
                  variant="compact"
                  value={scenario.scenario}
                  onValueChange={(value) => {
                    const next = IMPORT_SCENARIOS.find(
                      (item) => item.value === value,
                    );
                    if (next) setImportScenario({ scenario: next.value });
                  }}
                  groups={[
                    {
                      label: "",
                      options: IMPORT_SCENARIOS.map((item) => ({
                        ...item,
                        label: t(
                          (
                            {
                              off: "settingsHost.importReal",
                              none: "settingsHost.importNone",
                              both: "settingsHost.importBoth",
                              communities: "settingsHost.importCommunities",
                              old: "settingsHost.importOld",
                            } as const
                          )[item.value],
                        ),
                      })),
                    },
                  ]}
                />
              }
            />
            <SwitchPreferenceRow
              label={t("settingsHost.newCommunity")}
              description={t("settingsHost.newCommunityDescription")}
              checked={scenario.empty}
              onCheckedChange={(empty) => setImportScenario({ empty })}
            />
          </SettingsGroup>
        </div>
        <SettingsGroup layout="form">
          <PreferenceRow
            title={t("settingsHost.caches")}
            subtitle={t("settingsHost.cachesDescription")}
            trailing={
              <div className={styles.actions}>
                <Button
                  type="button"
                  disabled={clearing}
                  onClick={() => void clearCache()}
                >
                  {clearing
                    ? t("settingsHost.clearing")
                    : t("settingsHost.clearCache")}
                </Button>
              </div>
            }
          />
          {status && (
            <p role="status" className="m-0 text-body-sm text-muted">
              {resolveMessage(status)}
            </p>
          )}
        </SettingsGroup>
      </div>
    </section>
  );
}
