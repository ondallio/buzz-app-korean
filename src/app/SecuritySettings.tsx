import { t, useLanguage, formattingLocale } from "../shared/i18n";
import { useCallback, useEffect, useState } from "react";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { Button } from "../shared/design-system/ui/Button";
import { EmptyState } from "../shared/design-system/ui/EmptyState";
import { LockIcon } from "../shared/design-system/icons";
import { ExternalIdentityAuthorization } from "./ExternalIdentityAuthorization";
import {
  listPairedTools,
  onPairingEvents,
  revokePairedTool,
  type PairedTool,
} from "../features/credential-pairing/service";

const date = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString(formattingLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/** Local paired tools and authorization for applications with their own key. */
export function SecuritySettings({
  viewer,
}: {
  /** Available only when the host has a native identity. */
  viewer?: string | undefined;
}) {
  useLanguage();
  const [tools, setTools] = useState<PairedTool[] | null>(null);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setTools(await listPairedTools());
      setError("");
    } catch (reason) {
      setTools(null);
      setError(String(reason));
    }
  }, []);
  useEffect(() => {
    void refresh();
    return onPairingEvents({ changed: () => void refresh() });
  }, [refresh]);
  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await revokePairedTool(id);
      setTools((current) => current?.filter((tool) => tool.id !== id) ?? null);
      setError("");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setRevoking(null);
    }
  };
  return (
    <section aria-labelledby="security-settings-title">
      <Header
        id="security-settings-title"
        title={t("settings.security")}
        subtitle={t("settings.securityDescription")}
      />
      <InlineHeader id="paired-tools-title" title={t("settings.pairedTools")} />
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {tools?.length === 0 ? (
        <EmptyState
          icon={<LockIcon />}
          title={t("settings.noPairedTools")}
          description={t("settings.pairInstructions")}
        />
      ) : (
        tools && (
          <SettingsGroup>
            {tools.map((tool) => (
              <PreferenceRow
                key={tool.id}
                title={tool.client}
                subtitle={t("settings.pairedDetails", {
                  relay: tool.relay,
                  paired: date(tool.created),
                  used: date(tool.lastUsed),
                  expires: date(tool.expires),
                })}
                trailing={
                  <Button
                    loading={revoking === tool.id}
                    disabled={revoking !== null}
                    onClick={() => void revoke(tool.id)}
                  >
                    {t("settings.revoke")}
                  </Button>
                }
              />
            ))}
          </SettingsGroup>
        )
      )}
      {viewer && <ExternalIdentityAuthorization key={viewer} viewer={viewer} />}
    </section>
  );
}
