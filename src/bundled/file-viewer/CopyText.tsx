import { useEffect, useRef, useState } from "react";
import { writeClipboardText } from "../../shared/clipboard";
import { CopyIcon } from "../../shared/design-system/icons";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import { t } from "../../shared/i18n";

/** Copies the text `read` gives, read only when pressed: a PDF's text is read
 * from its pages then. Idle, then busy until the copy settles; leaving the
 * file stops a read in progress, and nothing is reported for it. */
export function CopyText({
  read,
  limit,
}: {
  read(signal: AbortSignal): string | Promise<string>;
  /** The most characters `read` gives; text that long says it was cut. */
  limit?: number;
}) {
  const notify = useToastNotification();
  const [busy, setBusy] = useState(false);
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);
  return (
    <IconButton
      aria-label={t("v1fv.copyText")}
      icon={<CopyIcon />}
      disabled={busy}
      onClick={() => {
        const controller = new AbortController();
        running.current = controller;
        setBusy(true);
        const live = () => !controller.signal.aborted;
        Promise.resolve()
          .then(() => read(controller.signal))
          .then((text) => {
            if (!live()) return;
            if (!/\S/.test(text)) return notify(t("v1fv.noText"), "info");
            return writeClipboardText(text).then(
              () =>
                notify(
                  limit !== undefined && text.length >= limit
                    ? `Copied the first ${limit.toLocaleString()} characters to clipboard`
                    : t("v1fv.copied"),
                  "success",
                ),
              () => notify(t("v1fv.copyFailed"), "error"),
            );
          })
          .catch(() => {
            if (live()) notify(t("v1fv.copyFailed"), "error");
          })
          .finally(() => {
            if (live()) setBusy(false);
          });
      }}
    />
  );
}
