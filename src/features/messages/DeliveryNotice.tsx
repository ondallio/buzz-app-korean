import { Button } from "../../shared/design-system/ui/Button";
import { ArrowsClockwiseIcon } from "../../shared/design-system/icons";
import { useEffect, useState } from "react";
import type { ChannelMessage } from "../relay/contracts";
import { DELIVERY_GRACE_MS, deliveryFeedback } from "./delivery";
import { t, useLanguage } from "../../shared/i18n";
import styles from "./Messages.module.css";

export function DeliveryNotice({
  row,
  retry,
}: {
  row: ChannelMessage;
  retry?: ((id: string) => void) | undefined;
}) {
  useLanguage();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!row.delivery || row.delivery === "seen") return;
    setNow(Date.now());
    const remaining = row.createdAt * 1000 + DELIVERY_GRACE_MS - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [row.createdAt, row.delivery]);
  const feedback = deliveryFeedback(row, now);
  if (!feedback) return null;
  const message =
    row.delivery === "failed"
      ? t("messageNotices.delivery.failed")
      : row.deliveryError
        ? t("messageNotices.delivery.unconfirmedError", {
            error: row.deliveryError,
          })
        : t("messageNotices.delivery.unconfirmed");
  const canRetry =
    (row.delivery === "failed" || row.delivery === "unknown") && retry;
  return (
    <div className={styles.delivery}>
      <span role="status" className={canRetry ? "sr-only" : undefined}>
        {message}
      </span>
      {canRetry && (
        <Button
          size="inline"
          variant="ghost"
          title={message}
          onClick={() => retry(row.id)}
        >
          <ArrowsClockwiseIcon size={12} aria-hidden="true" />{" "}
          {t("messageNotices.delivery.retry")}
        </Button>
      )}
    </div>
  );
}
