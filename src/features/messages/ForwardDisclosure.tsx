import { t, useLanguage } from "../../shared/i18n";
import { LockIcon } from "../../shared/design-system/icons";
import styles from "./ForwardMessage.module.css";

export function ForwardDisclosure({
  id,
  audience,
}: {
  id?: string;
  audience: string;
}) {
  useLanguage();
  return (
    <p id={id} className={`text-body-sm ${styles.privacy}`}>
      <LockIcon size={14} aria-hidden="true" />
      <span>{t("v105msg.forward.disclosure", { audience })}</span>
    </p>
  );
}
