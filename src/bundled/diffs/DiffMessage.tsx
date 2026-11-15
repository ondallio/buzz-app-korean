import { useMemo, useRef, useState } from "react";
import type { ChannelMessage } from "../../features/relay/contracts";
import { safeMessageUrl } from "../../features/relay/message-content";
import { ArrowsOutIcon } from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { DiffViewer } from "./DiffViewer";
import { parsePatch } from "./parse";
import styles from "./Diffs.module.css";
import { t, useLanguage } from "../../shared/i18n";

export function DiffMessage({ message }: { message: ChannelMessage }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [viewType, setViewType] = useState<"unified" | "split">("unified");
  const expand = useRef<HTMLButtonElement>(null);
  const files = useMemo(() => parsePatch(message.content), [message.content]);
  const meta = message.diff;
  if (!meta) return null;
  const repoUrl = meta.repoUrl ? safeMessageUrl(meta.repoUrl) : undefined;
  const commit = meta.commitSha;
  const commitUrl =
    repoUrl && commit && /^[0-9a-f]{7,64}$/i.test(commit)
      ? `${repoUrl.replace(/\/$/, "")}/commit/${commit}`
      : undefined;
  const source = commitUrl || repoUrl;
  const title = meta.filePath || t("v1wf.diff.title");
  const viewer = { content: message.content, files, filePath: meta.filePath };
  const warning = meta.truncated && (
    <p className={styles.notice}>
      {t("v1wf.diff.truncated")}{" "}
      {source ? (
        <a href={source} target="_blank" rel="noreferrer noopener">
          {t("v1wf.diff.viewFullLink")}
        </a>
      ) : (
        t("v1wf.diff.viewFull")
      )}
    </p>
  );
  return (
    <>
      <section
        className={styles.card}
        aria-label={t("v1wf.diff.cardLabel", { title })}
      >
        <header className={styles.header}>
          <span className={styles.filename} title={title}>
            {title}
          </span>
          <span className={styles.source}>
            {source ? (
              <a href={source} target="_blank" rel="noreferrer noopener">
                {commit?.slice(0, 7) || t("v1wf.diff.source")}
              </a>
            ) : (
              commit?.slice(0, 7)
            )}
          </span>
          <IconButton
            ref={expand}
            size="sm"
            aria-label={t("v1wf.diff.expand")}
            icon={<ArrowsOutIcon size={16} aria-hidden="true" />}
            onClick={() => {
              setViewType("unified");
              setOpen(true);
            }}
          />
        </header>
        {meta.description && (
          <p className={styles.description}>{meta.description}</p>
        )}
        <section
          className={styles.preview}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: The preview scroll owner must support keyboard scrolling.
          tabIndex={0}
          aria-label={t("v1wf.diff.previewLabel", { title })}
        >
          <DiffViewer {...viewer} />
        </section>
        {warning}
      </section>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        size="expanded"
        closeLabel={t("v1wf.diff.close")}
        finalFocus={expand}
      >
        <fieldset className={styles.toolbar} aria-label={t("v1wf.diff.layout")}>
          <Button
            size="sm"
            aria-pressed={viewType === "unified"}
            variant={viewType === "unified" ? "subtle" : "ghost"}
            onClick={() => setViewType("unified")}
          >
            {t("v1wf.diff.unified")}
          </Button>
          <Button
            size="sm"
            aria-pressed={viewType === "split"}
            variant={viewType === "split" ? "subtle" : "ghost"}
            onClick={() => setViewType("split")}
          >
            {t("v1wf.diff.split")}
          </Button>
        </fieldset>
        {warning}
        <DiffViewer {...viewer} viewType={viewType} />
      </Dialog>
    </>
  );
}
