import { t, useLanguage } from "../../shared/i18n";
import {
  ArrowUpRightIcon,
  ArrowsClockwiseIcon,
  CheckIcon,
  CircleNotchIcon,
  DownloadIcon,
} from "../../shared/design-system/icons/index";
import { FileTypeIcon } from "./FileTypeIcon";
import fileIconStyles from "./FileTypeIcon.module.css";
import type { Attachment } from "../relay/contracts";
import {
  isNativeMediaSource,
  isProxySource,
  safeOpenUrl,
} from "./attachment-source";
import styles from "./Messages.module.css";
import { useNativeDownload, type DownloadState } from "./use-native-download";
import type { ReactNode } from "react";

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${Math.round(size / (1024 * 1024))} MB`;
  return `${Math.round(size / (1024 * 1024 * 1024))} GB`;
}

function mimeLabel(mime: string | undefined): string | undefined {
  if (!mime) return undefined;
  const [type, subtype] = mime.split("/");
  if (!type || !subtype) return undefined;
  if (subtype === "pdf") return t("mediaViewing.file.type", { type: "PDF" });
  if (!/^[a-z0-9]+$/i.test(subtype)) return undefined;
  return t("mediaViewing.file.type", { type: subtype.toUpperCase() });
}

export function FileAttachment({
  attachment,
  source,
  onOpenLink,
}: {
  attachment: Attachment;
  source: string | undefined;
  onOpenLink(url: string): boolean;
}) {
  useLanguage();
  const displayName =
    attachment.name ??
    mimeLabel(attachment.mime) ??
    t("mediaViewing.file.name");
  const nativeSource = source ? isNativeMediaSource(source) : false;
  const proxySource = source ? isProxySource(source) || nativeSource : false;
  const externalSource = !!source && safeOpenUrl(source) && !proxySource;
  if (source && !proxySource && !externalSource)
    return (
      <UnavailableFileAttachment
        displayName={displayName}
        attachment={attachment}
      />
    );

  const content = (state: DownloadState = "idle") => (
    <>
      <span className={fileIconStyles.slot}>
        <FileTypeIcon name={attachment.name} mime={attachment.mime} />
      </span>
      <span className={styles.fileAttachmentBody}>
        <span className={styles.fileAttachmentName}>{displayName}</span>
        <span className={styles.fileAttachmentMeta}>
          {state === "pending"
            ? t("mediaViewing.download.pending")
            : state === "saved"
              ? t("mediaViewing.download.saved")
              : state === "failed"
                ? t("mediaViewing.file.retryHint")
                : source
                  ? attachment.size
                    ? formatFileSize(attachment.size)
                    : proxySource
                      ? t("mediaViewing.file.downloadLabel")
                      : t("mediaViewing.file.openLabel")
                  : t("mediaViewing.file.unavailable")}
        </span>
      </span>
      {state === "pending" ? (
        <CircleNotchIcon
          size={20}
          className="motion-safe:animate-spin"
          aria-hidden="true"
        />
      ) : state === "saved" ? (
        <CheckIcon size={20} aria-hidden="true" />
      ) : state === "failed" ? (
        <ArrowsClockwiseIcon size={20} aria-hidden="true" />
      ) : proxySource ? (
        <DownloadIcon size={20} aria-hidden="true" />
      ) : (
        <ArrowUpRightIcon size={20} aria-hidden="true" />
      )}
    </>
  );
  if (!source)
    return (
      <UnavailableFileAttachment
        displayName={displayName}
        attachment={attachment}
      />
    );
  if (externalSource)
    return (
      <a
        className={styles.fileAttachment}
        href={source}
        target="_blank"
        rel="noreferrer"
        aria-label={t("mediaViewing.file.open", { name: displayName })}
        title={displayName}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) return;
          if (onOpenLink(source)) event.preventDefault();
        }}
      >
        {content()}
      </a>
    );
  if (nativeSource)
    return (
      <NativeFileDownload
        key={JSON.stringify([source, attachment.name])}
        source={source}
        name={attachment.name ?? ""}
        displayName={displayName}
      >
        {content}
      </NativeFileDownload>
    );
  return (
    <a
      className={styles.fileAttachment}
      href={source}
      download={attachment.name ?? ""}
      aria-label={t("mediaViewing.file.download", { name: displayName })}
      title={displayName}
    >
      {content()}
    </a>
  );
}

/** A source/name change mounts a fresh download lifetime, retiring old results. */
function NativeFileDownload({
  source,
  name,
  displayName,
  children,
}: {
  source: string;
  name: string;
  displayName: string;
  children(state: DownloadState): ReactNode;
}) {
  const { state, download } = useNativeDownload(source, name);
  const announcement =
    state === "pending"
      ? t("mediaViewing.file.downloading", { name: displayName })
      : state === "saved"
        ? t("mediaViewing.file.saved", { name: displayName })
        : state === "failed"
          ? t("mediaViewing.file.failed", { name: displayName })
          : "";
  return (
    <>
      <button
        type="button"
        className={styles.fileAttachment}
        aria-label={t(
          state === "failed"
            ? "mediaViewing.file.retry"
            : "mediaViewing.file.download",
          { name: displayName },
        )}
        aria-disabled={state === "pending"}
        aria-busy={state === "pending"}
        title={displayName}
        onClick={() => void download()}
      >
        {children(state)}
      </button>
      <span className="sr-only" role={state === "failed" ? "alert" : "status"}>
        {announcement}
      </span>
    </>
  );
}

function UnavailableFileAttachment({
  displayName,
  attachment,
}: {
  displayName: string;
  attachment: Attachment;
}) {
  return (
    <span className={styles.fileAttachment} role="status" title={displayName}>
      <span className={fileIconStyles.slot}>
        <FileTypeIcon name={attachment.name} mime={attachment.mime} />
      </span>
      <span className={styles.fileAttachmentBody}>
        <span className={styles.fileAttachmentName}>{displayName}</span>
        <span className={styles.fileAttachmentMeta}>
          {t("mediaViewing.file.unavailable")}
        </span>
      </span>
    </span>
  );
}
