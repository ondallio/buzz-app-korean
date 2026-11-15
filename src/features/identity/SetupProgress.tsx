import { t, useLanguage } from "../../shared/i18n";
import styles from "./IdentitySetup.module.css";

export function SetupProgress({ label }: { label: string }) {
  useLanguage();
  return (
    <div className={styles.progress}>
      <span className={styles.loadingBee} aria-hidden="true" />
      <h1
        id="welcome-title"
        tabIndex={-1}
        className="text-heading text-standard"
      >
        {t("identity.progress.heading")}
      </h1>
      <span role="status" className="sr-only">
        {label}
      </span>
    </div>
  );
}
