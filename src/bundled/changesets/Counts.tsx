import { t } from "../../shared/i18n";
import styles from "./Changesets.module.css";

export function Counts({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  return (
    <span className={styles.counts}>
      <span className={styles.added}>+{additions}</span>
      <span className={styles.removed}>−{deletions}</span>
    </span>
  );
}

export const fileCount = (count: number) =>
  t(count === 1 ? "u275f00.changes.file" : "u275f00.changes.files", {
    count: String(count),
  });

export const totals = (
  files: readonly { additions: number; deletions: number }[],
) => ({
  additions: files.reduce((sum, file) => sum + file.additions, 0),
  deletions: files.reduce((sum, file) => sum + file.deletions, 0),
});
