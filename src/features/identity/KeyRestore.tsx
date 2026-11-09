import { t, useLanguage } from "../../shared/i18n";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import type { Recovery } from "./builderlab-account";
import { OnboardingBack } from "./OnboardingBack";
import { OnboardingScreen } from "./OnboardingScreen";
import { recoveryOff } from "./service";

/** First-run recovery only installs the key linked to the current account. */
export function KeyRestore({
  recovery,
  expectedPubkey,
  email,
  onBack,
  onLost,
  onImport,
  onInstalled,
}: {
  recovery: Recovery;
  expectedPubkey: string;
  email?: string | undefined;
  onBack: () => void;
  onLost?: (() => void) | undefined;
  onImport: () => void;
  onInstalled: () => void;
}) {
  useLanguage();
  const state = useSyncExternalStore(recovery.subscribe, recovery.snapshot);
  const candidate =
    state?.status === "choosing"
      ? state.candidates.find((item) => item.pubkey === expectedPubkey)
      : undefined;
  const installedHandle = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!candidate || installedHandle.current === candidate.handle) return;
    installedHandle.current = candidate.handle;
    void recovery.installRecovery(candidate.handle).then(onInstalled);
  }, [candidate, recovery, onInstalled]);
  const leave = async (then: () => void) => {
    if (await recovery.cancelRecovery()) then();
  };
  const retry = async () => {
    if (!(await recovery.cancelRecovery())) return;
    installedHandle.current = undefined;
    await recovery.beginRecovery();
  };
  const saving = !!candidate || state?.status === "saving";
  const canceling = state?.status === "canceling";
  const failed =
    state?.status === "error" || (state?.status === "choosing" && !candidate);
  const partial = state?.status === "choosing" && state.failedCount > 0;
  const off = recoveryOff(state);
  const canRetry = !off && (state?.status === "error" || partial);
  const description = off
    ? t("identityMore.restoreUnavailable")
    : partial
      ? t("identityMore.restorePartial")
      : state?.status === "choosing" && !candidate
        ? state.candidates.length === 0
          ? t("identityMore.restoreNotFound")
          : t("identityMore.restoreMismatch")
        : failed
          ? t("identityMore.restoreRetryHelp")
          : saving
            ? t("identityMore.restoringKey")
            : canceling
              ? t("identityMore.cancelingRecovery")
              : t("identityMore.restoringKey");
  return (
    <OnboardingScreen
      labelledBy="welcome-title"
      intro={
        <>
          <h1
            id="welcome-title"
            tabIndex={-1}
            className="text-heading text-standard"
          >
            {failed
              ? t("identityMore.restoreKeyFailed")
              : t("identityMore.restoreKey")}
          </h1>
          {email && (
            <p className="break-words text-body-sm text-subtle">
              {t("identityMore.signedInAs", { email })}
            </p>
          )}
          <p
            role={failed ? "alert" : "status"}
            className="mt-2 text-body text-subtle"
          >
            {description}
          </p>
          {state?.status === "waiting" && (
            <p className="text-body-sm text-subtle">
              {t("identityMore.browserSignIn")}
            </p>
          )}
        </>
      }
    >
      {failed && (
        <>
          <Button
            size="lg"
            variant="prominent"
            onClick={() => void leave(onImport)}
          >
            {t("identityMore.enterMyPrivateKey")}
          </Button>
          {onLost && (
            <Button size="lg" onClick={() => void leave(onLost)}>
              {t("identityMore.lostKeyAction")}
            </Button>
          )}
          {canRetry && (
            <Button size="lg" variant="ghost" onClick={() => void retry()}>
              {t("identity.failure.retry")}
            </Button>
          )}
        </>
      )}
      <div data-onboarding-actions="">
        <OnboardingBack
          aria-label={
            !failed && !saving ? t("identity.cancel") : t("identity.back")
          }
          disabled={saving || canceling}
          onClick={() => void leave(onBack)}
        />
      </div>
    </OnboardingScreen>
  );
}
