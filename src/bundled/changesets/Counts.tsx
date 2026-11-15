import styles from "./Changesets.module.css";
import { t } from "../../shared/i18n";

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
  t(count === 1 ? "v1wf.cs.files.one" : "v1wf.cs.files.other", { count });

export const filesChanged = (count: number) =>
  t(count === 1 ? "v1wf.cs.changed.one" : "v1wf.cs.changed.other", { count });

export const totals = (
  files: readonly { additions: number; deletions: number }[],
) => ({
  additions: files.reduce((sum, file) => sum + file.additions, 0),
  deletions: files.reduce((sum, file) => sum + file.deletions, 0),
});
