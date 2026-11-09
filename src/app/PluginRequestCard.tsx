import { t, useLanguage } from "../shared/i18n";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChannelMessage } from "../features/relay/contracts";
import type { PluginManager } from "../plugins/manager";
import type { PluginRequest } from "../plugins/requests";
import { Button } from "../shared/design-system/ui/Button";
import { requestTitle, RequestReview } from "./AgentPluginRequests";
import styles from "./PluginRequestCard.module.css";

type Authorize = NonNullable<
  Parameters<typeof RequestReview>[0]["authorizeGit"]
>;
const DONE = {
  install: "pluginRequests.installed",
  update: "pluginRequests.updated",
  enable: "pluginRequests.enabled",
  remove: "pluginRequests.deleted",
} as const;

/** An agent's plugin request, in the conversation it asked from. The owner
 * reviews it here when this device holds the request; elsewhere, or after the
 * app restarts, the message is all that is left of it. */
export function PluginRequestCard({
  message,
  plugins,
  authorizeGit,
  holdReview,
}: {
  message: ChannelMessage;
  plugins: PluginManager;
  authorizeGit?: Authorize | undefined;
  holdReview?: (() => () => void) | undefined;
}) {
  useLanguage();
  const { requests } = plugins;
  const id = message.pluginRequest?.id ?? "";
  const waiting = useSyncExternalStore(requests.subscribe, () =>
    requests.pending().find((item) => item.id === id),
  );
  const decided = useSyncExternalStore(requests.subscribe, () =>
    requests.decided(id),
  );
  const { configuration, busy } = useSyncExternalStore(
    plugins.subscribe,
    plugins.snapshot,
  );
  // Held, not looked up, so settling the request never remounts the review.
  const [reviewing, setReviewing] = useState<PluginRequest>();
  const trigger = useRef<HTMLElement | null>(null);
  const outcome = useRef<HTMLSpanElement>(null);
  const declining = useRef(false);
  // Settling removes the button that had focus; the outcome replaces it.
  useEffect(() => {
    const opener = trigger.current;
    const lost =
      !!opener &&
      !opener.isConnected &&
      document.activeElement === document.body;
    if (!declining.current && !lost) return;
    declining.current = false;
    trigger.current = null;
    outcome.current?.focus();
  });
  // Anyone can write the tag; only the agent that asked can claim the request.
  const request = [waiting, decided].find(
    (item) => item?.requester.pubkey === message.authorId,
  );
  if (!request)
    return (
      <section aria-label={t("pluginRequests.request")} className={styles.card}>
        <div className={styles.details}>
          <span className={styles.reason}>{message.content}</span>
          <span className="text-secondary">
            {t("pluginRequests.noLongerAvailable")}
          </span>
        </div>
      </section>
    );
  const name = request.pluginName;
  return (
    <>
      <section
        aria-label={t("pluginRequests.requestNamed", { name })}
        className={styles.card}
      >
        <div className={styles.details}>
          <strong>{requestTitle(request)}</strong>
          <span className={`${styles.reason} text-secondary`}>
            {t("pluginRequests.requestReason", {
              requester: request.requester.name,
              reason: request.reason,
            })}
          </span>
        </div>
        <div className={styles.actions}>
          {waiting ? (
            <>
              <Button
                size="sm"
                variant="subtle"
                aria-label={t("pluginRequests.declineNamed", { name })}
                onClick={() => {
                  declining.current = true;
                  requests.settle(waiting.id, "declined");
                }}
              >
                {t("pluginRequests.decline")}
              </Button>
              <Button
                size="sm"
                variant="prominent"
                disabled={busy || configuration.status !== "ready"}
                aria-label={t("pluginRequests.reviewNamed", { name })}
                onClick={(event) => {
                  trigger.current = event.currentTarget;
                  setReviewing(waiting);
                }}
              >
                {t("pluginRequests.review")}
              </Button>
            </>
          ) : (
            <span
              ref={outcome}
              tabIndex={-1}
              role="status"
              className="text-secondary"
            >
              {decided?.state === "approved"
                ? t(DONE[request.action])
                : t("pluginRequests.declined")}
            </span>
          )}
        </div>
      </section>
      {reviewing && configuration.status === "ready" && (
        <RequestReview
          plugins={plugins}
          catalog={configuration.catalog}
          busy={busy}
          request={reviewing}
          authorizeGit={authorizeGit}
          holdReview={holdReview}
          returnFocus={() => outcome.current ?? trigger.current}
          onClose={() => setReviewing(undefined)}
        />
      )}
    </>
  );
}
