import { t, useLanguage } from "../../shared/i18n";
import { OnboardingBack } from "./OnboardingBack";
import { useState } from "react";
import { npubEncode } from "nostr-tools/nip19";
import { publicKeyLabels } from "../../shared/identity/public-key";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { Radio, RadioGroup } from "../../shared/design-system/ui/RadioGroup";
import { type Identity, type RecoveryState, recoveryOff } from "./service";

/**
 * Recovered backups to restore one from. With `expectedPubkey`, only that key
 * is offered: when no backup holds it, nothing can be restored, and `onImport`
 * offers Enter your private key instead. Try recovery again is offered only
 * where a retry may help, which includes a backup that failed to come back:
 * it may hold the key.
 */
export function RestoreIdentity({
  identity,
  recovery,
  expectedPubkey,
  onImport,
}: {
  identity: Pick<
    Identity,
    "beginRecovery" | "installRecovery" | "cancelRecovery"
  >;
  recovery: RecoveryState;
  /** The hex key linked to the signed-in account, when only it may be restored. */
  expectedPubkey?: string | undefined;
  /** No backup holds `expectedPubkey`: leave recovery for the import page. */
  onImport?: (() => void) | undefined;
}) {
  useLanguage();
  const [selected, setSelected] = useState<{
    recovery: RecoveryState;
    handle: string;
  }>();
  const recovered = recovery.status === "choosing" ? recovery.candidates : [];
  const candidates =
    expectedPubkey === undefined
      ? recovered
      : recovered.filter((candidate) => candidate.pubkey === expectedPubkey);
  const labels = publicKeyLabels(
    candidates.map((candidate) => candidate.pubkey),
  );
  const current =
    recovery.status === "choosing"
      ? candidates.find(
          (candidate) => candidate.pubkey === recovery.currentPubkey,
        )
      : undefined;
  const handle =
    selected?.recovery === recovery ? selected.handle : current?.handle;
  const mismatched = recovered.length > 0 && candidates.length === 0;
  // A backup that failed to come back may hold the key: a retry may help.
  const failed = recovery.status === "choosing" && recovery.failedCount > 0;
  return (
    <section
      className="flex flex-1 flex-col gap-4"
      aria-label={t("identityMore.restoreBackup")}
    >
      {recovery.status === "waiting" ? (
        <p role="status">{t("identityMore.findBackups")}</p>
      ) : recovery.status === "saving" ? (
        <p role="status">{t("identityMore.savingIdentity")}</p>
      ) : recovery.status === "canceling" ? (
        <p role="status">{t("identityMore.cancelingRecovery")}</p>
      ) : recovery.status === "error" ? (
        <p role="alert">{recovery.error}</p>
      ) : mismatched ? (
        <p role="alert">
          {failed
            ? t("identityMore.someBackupsMismatch")
            : t("identityMore.noBackupsMatch")}
        </p>
      ) : candidates.length === 0 ? (
        <p role={recovery.failedCount ? "alert" : "status"}>
          {recovery.failedCount
            ? t("identityMore.backupsFailed")
            : t("identityMore.backupsNotFound")}
        </p>
      ) : (
        <>
          <p>
            {current
              ? t("identityMore.chooseIdentity")
              : recovery.currentPubkey
                ? t("identityMore.currentNotBackedUp")
                : t("identityMore.chooseIdentity")}
          </p>
          <p>{t("identityMore.linkedUnchanged")}</p>
          {recovery.failedCount > 0 && (
            <p role="status">{t("identityMore.someBackupsFailed")}</p>
          )}
          <Field
            label={t("identityMore.identityToRestore")}
            nativeLabel={false}
          >
            <RadioGroup
              aria-label={t("identityMore.identityToRestore")}
              value={handle ?? null}
              onValueChange={(value) =>
                value && setSelected({ recovery, handle: value })
              }
            >
              {candidates.map((candidate) => (
                <Radio
                  key={candidate.handle}
                  value={candidate.handle}
                  label={labels.get(candidate.pubkey)}
                  description={
                    <>
                      {candidate.pubkey === current?.pubkey
                        ? t("identityMore.currentIdentity")
                        : t("identityMore.previousIdentity")}
                      <code className="block break-all text-mono">
                        {npubEncode(candidate.pubkey)}
                      </code>
                    </>
                  }
                />
              ))}
            </RadioGroup>
          </Field>
        </>
      )}
      <div data-onboarding-actions="">
        <OnboardingBack
          aria-label={
            recovery.status === "waiting"
              ? t("identity.cancel")
              : t("identity.back")
          }
          disabled={
            recovery.status === "saving" || recovery.status === "canceling"
          }
          onClick={() => void identity.cancelRecovery()}
        />
        {recovery.status === "choosing" && candidates.length > 0 ? (
          <Button
            size="lg"
            variant="primary"
            disabled={!handle}
            onClick={() => handle && void identity.installRecovery(handle)}
          >
            {t("identityMore.restoreThis")}
          </Button>
        ) : mismatched && onImport ? (
          <>
            <Button
              size="lg"
              variant={failed ? "subtle" : "prominent"}
              onClick={onImport}
            >
              {t("identityMore.enterPrivateKey")}
            </Button>
            {failed && (
              <Button
                size="lg"
                variant="prominent"
                onClick={() => void identity.beginRecovery()}
              >
                {t("identityMore.retryRecovery")}
              </Button>
            )}
          </>
        ) : (recovery.status === "error" && !recoveryOff(recovery)) ||
          (recovery.status === "choosing" && recovered.length === 0) ? (
          <Button
            size="lg"
            variant="primary"
            onClick={() => void identity.beginRecovery()}
          >
            {t("identityMore.retryRecovery")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
