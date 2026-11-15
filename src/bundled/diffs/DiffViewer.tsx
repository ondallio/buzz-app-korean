import { Diff, Hunk, type FileData } from "react-diff-view";
import "react-diff-view/style/index.css";
import { diffType, fileLabel } from "./parse";
import styles from "./Diffs.module.css";
import { t, useLanguage } from "../../shared/i18n";

export function DiffViewer({
  content,
  files,
  filePath,
  viewType = "unified",
}: {
  content: string;
  files: FileData[] | undefined;
  filePath?: string | undefined;
  viewType?: "unified" | "split";
}) {
  useLanguage();
  if (!files)
    return (
      // biome-ignore lint/a11y/useSemanticElements: The raw scroll region preserves preformatted text and needs keyboard access.
      <pre
        className={styles.raw}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The scroll owner must support keyboard panning.
        tabIndex={0}
        role="region"
        aria-label={t("v1wf.diff.raw")}
      >
        {content}
      </pre>
    );
  if (!files.length)
    return <p className="text-body-sm">{t("v1wf.diff.empty")}</p>;
  return (
    <div className={styles.viewer}>
      {files.map((file) => {
        const label = fileLabel(file, filePath);
        const type = diffType(file);
        const changes = file.hunks.flatMap((hunk) => hunk.changes);
        const additions = changes.filter(
          (change) => change.type === "insert",
        ).length;
        const deletions = changes.filter(
          (change) => change.type === "delete",
        ).length;
        return (
          <section
            className={styles.file}
            key={`${file.oldPath}:${file.newPath}:${file.oldRevision}:${file.newRevision}`}
            aria-label={label}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: The scroll owner must support keyboard panning.
            tabIndex={0}
          >
            {(files.length > 1 || label !== filePath || type !== "modify") && (
              <header className={styles.fileHeader}>
                <span className={styles.filename}>{label}</span>
                <span>{t(`v1wf.diff.type.${type}`)}</span>
                <span className={styles.added}>+{additions}</span>
                <span className={styles.removed}>−{deletions}</span>
              </header>
            )}
            {file.hunks.length ? (
              <Diff
                className={
                  (viewType === "split" ? styles.split : styles.unified) ?? ""
                }
                diffType={type}
                hunks={file.hunks}
                viewType={viewType}
              >
                {(hunks) =>
                  hunks.map((hunk) => (
                    <Hunk
                      key={`${hunk.oldStart}:${hunk.newStart}:${hunk.content}`}
                      hunk={hunk}
                    />
                  ))
                }
              </Diff>
            ) : (
              <p className={styles.notice}>{t("v1wf.diff.noHunks")}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
