import { t } from "../../shared/i18n";
import type { BackupFailureKind } from "./backup-failure";

/** Display copy for `BACKUP_FAILURES`, which stays a leaf module of canonical English. */
export function backupFailureText(kind: BackupFailureKind): {
  cause?: string;
  message: string;
} {
  switch (kind) {
    case "unavailable":
      return { message: t("v1id.backupFailure.unavailable") };
    case "busy":
      return {
        cause: t("v1id.backupFailure.busyCause"),
        message: t("v1id.backupFailure.busy"),
      };
    case "interrupted":
      return {
        cause: t("v1id.backupFailure.interruptedCause"),
        message: t("v1id.backupFailure.interrupted"),
      };
    case "timeout":
      return {
        cause: t("v1id.backupFailure.timeoutCause"),
        message: t("v1id.backupFailure.timeout"),
      };
    case "signed_out":
      return {
        cause: t("v1id.backupFailure.signedOut"),
        message: t("v1id.backupFailure.signedOut"),
      };
    case "not_offered":
      return { message: t("v1id.backupFailure.notOffered") };
    case "not_linked":
      return { message: t("v1id.backupFailure.notLinked") };
    case "other_key_linked":
      return { message: t("v1id.backupFailure.otherKeyLinked") };
    case "invalid_service":
      return { message: t("v1id.backupFailure.invalidService") };
    case "refused":
      return { message: t("v1id.backupFailure.refused") };
    case "unreachable":
      return {
        cause: t("v1id.backupFailure.unreachableCause"),
        message: t("v1id.backupFailure.unreachable"),
      };
    case "unconfirmed":
      return {
        cause: t("v1id.backupFailure.unconfirmedCause"),
        message: t("v1id.backupFailure.unconfirmed"),
      };
    case "storage":
      return {
        cause: t("v1id.backupFailure.storageCause"),
        message: t("v1id.backupFailure.storage"),
      };
    case "unknown":
      return { message: t("v1id.backupFailure.unknown") };
  }
}
