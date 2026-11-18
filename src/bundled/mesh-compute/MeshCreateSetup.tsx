import { useEffect, useRef, useState } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { t, useLanguage } from "../../shared/i18n";
import type { MeshStatus } from "./index";

/** Creation borrows the existing compute page's lifecycle; no setup record or runner. */
export function MeshCreateSetup({
  status,
  busy,
  disabled,
  leaseReady,
  otherCommunity,
  error,
  share,
  refresh,
}: {
  status: MeshStatus | null;
  busy: boolean;
  disabled: boolean;
  leaseReady: boolean;
  otherCommunity: boolean;
  error: string | null;
  share(): void;
  refresh(): void;
}) {
  useLanguage();
  const [choice, setChoice] = useState<"share" | "use" | null>(null);
  const confirmation = useRef<HTMLParagraphElement>(null);
  const phase = status?.lifecycle?.state;
  const sharing =
    !otherCommunity &&
    Boolean(status?.sharing) &&
    (phase === "ready" || phase === "starting");
  const failure =
    error ??
    status?.settingsError ??
    (phase === "failed" ? t("fubestie.setup.needsRecovery") : null);
  const confirmed =
    choice === "use" || (choice === "share" && sharing && !failure);
  useEffect(() => {
    if (confirmed) confirmation.current?.focus();
  }, [confirmed]);
  // Existing sharing needs no setup; a choice made here keeps its confirmation.
  if (sharing && choice === null && !failure) return null;
  const canShare =
    status &&
    leaseReady &&
    !otherCommunity &&
    phase !== "failed" &&
    phase !== "stopping";
  return (
    <section aria-label={t("fubestie.setup.label")} className="grid gap-2">
      <p className="m-0 text-body-sm text-secondary">
        {t("fubestie.setup.privacy")}
      </p>
      {confirmed ? (
        <div className="grid gap-2">
          <p
            ref={confirmation}
            tabIndex={-1}
            role="status"
            className="m-0 text-body"
          >
            {choice === "use"
              ? t("fubestie.setup.usingCommunity")
              : phase === "ready"
                ? t("fubestie.setup.sharing")
                : t("fubestie.setup.sharingStarting")}
          </p>
          {choice === "use" && (
            <Button
              size="sm"
              disabled={disabled || busy}
              onClick={() => setChoice(null)}
            >
              {t("fubestie.setup.change")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <SettingsGroup>
            <PreferenceRow
              title={t("fubestie.setup.useThis")}
              subtitle={t("fubestie.setup.useThisHint")}
              trailing={
                <Button
                  size="sm"
                  variant="primary"
                  aria-label={t("fubestie.setup.startAuto")}
                  disabled={disabled || busy || !canShare}
                  loading={busy}
                  onClick={() => {
                    setChoice("share");
                    share();
                  }}
                >
                  {t("fubestie.setup.start")}
                </Button>
              }
            />
            <PreferenceRow
              title={t("fubestie.setup.useCommunity")}
              subtitle={t("fubestie.setup.useCommunityHint")}
              trailing={
                <Button
                  size="sm"
                  aria-label={t("fubestie.setup.continueWithout")}
                  disabled={disabled || busy}
                  onClick={() => setChoice("use")}
                >
                  {t("fubestie.setup.continue")}
                </Button>
              }
            />
          </SettingsGroup>
          {(busy || !status || otherCommunity) && (
            <p role="status" className="m-0 text-body-sm text-secondary">
              {busy
                ? t("fubestie.setup.startingCompute")
                : !status
                  ? t("fubestie.mesh.checking")
                  : otherCommunity
                    ? t("fubestie.setup.otherCommunity")
                    : t("fubestie.setup.changeLater")}
            </p>
          )}
        </>
      )}
      {failure && (
        <div className="grid gap-2">
          <p role="alert" className="m-0 text-body-sm text-danger">
            {failure}
          </p>
          <Button size="sm" disabled={disabled || busy} onClick={refresh}>
            {t("fubestie.setup.checkAgain")}
          </Button>
        </div>
      )}
    </section>
  );
}
