import { t, useLanguage } from "../../shared/i18n";
import { Button } from "../../shared/design-system/ui/Button";
import { isWorkflowOperation } from "../../features/workflows/protocol";
import { useState, useSyncExternalStore } from "react";
import type { RelayProfiler } from "../../features/relay/profiling";
import { RelayTimings } from "./RelayTimings";
import { PRODUCT_FEEDBACK_KIND } from "../../features/relay/product-feedback";
import type { Outbox } from "../../features/relay/outbox";
import type { RelaySession } from "../../features/relay/session";
import { isBatchAddition } from "../../features/channel-members/members";

/** A batch names everyone its Retry re-adds. */
function additionLabel(tags: readonly (readonly string[])[]) {
  const people = tags.filter(([tag]) => tag === "p");
  return people.length > 1
    ? t("v1shell.outbox.addPeople", { count: people.length })
    : t("v1shell.outbox.addAgent", { id: people[0]?.[1]?.slice(0, 12) ?? "" });
}

/** Delivery belongs to the session, including messages from other pages or a previous launch. */
export function OutboxStatus({
  outbox,
  profiling,
  memberAdditions,
}: {
  outbox: Outbox;
  profiling: RelayProfiler;
  memberAdditions: Pick<RelaySession["memberAdditions"], "add">;
}) {
  useLanguage();
  const operations = useSyncExternalStore(
    outbox.subscribe,
    outbox.snapshot,
    outbox.snapshot,
  ).filter((item) => item.event.kind !== PRODUCT_FEEDBACK_KIND);
  const [error, setError] = useState<string>();

  return (
    <details>
      <summary>
        {t("v1shell.outbox.summary", { count: operations.length })}
      </summary>
      <p>{t("v1shell.outbox.removeNote")}</p>
      <ul
        style={{
          maxHeight: "10rem",
          overflow: "auto",
          paddingInlineStart: "1.2rem",
        }}
      >
        {operations.map((item) => (
          <li key={item.event.id}>
            <span>
              {item.event.kind === 9000
                ? additionLabel(item.event.tags)
                : item.event.content.slice(0, 100)}{" "}
              ·{" "}
              {t(
                (
                  {
                    sending: "v1shell.outbox.sending",
                    accepted: "v1shell.outbox.sent",
                    unknown: "v1shell.outbox.unconfirmed",
                    failed: "v1shell.outbox.notSent",
                    seen: "v1shell.outbox.sent",
                  } as const
                )[item.delivery],
              )}
            </span>{" "}
            {!isWorkflowOperation(item.event) &&
              !item.guarded &&
              (item.delivery === "failed" ||
                item.delivery === "unknown" ||
                // A kept batch still names someone unsettled.
                (isBatchAddition(item) && item.delivery !== "sending")) && (
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      if (
                        item.event.kind === 9000 &&
                        (item.recovery?.key.startsWith("member-add:") ||
                          !item.event.tags.some(([tag]) => tag === "role"))
                      ) {
                        const channelId = item.event.tags.find(
                          ([tag]) => tag === "h",
                        )?.[1];
                        const pubkeys = item.event.tags.flatMap(
                          ([tag, value]) =>
                            tag === "p" && value ? [value] : [],
                        );
                        if (!channelId || !pubkeys.length)
                          throw new Error(t("v1shell.outbox.reopenMembers"));
                        // A stale explicit role must never overwrite a newer
                        // admission, so each person is checked again. A guest
                        // addition is retried as one, so it never sends a
                        // writing role. A single addition finishes only its own
                        // receipt. A batch is never resumed, so each person it
                        // names is added again; it clears once all are settled.
                        const guest = item.event.tags.some(
                          ([tag, value]) => tag === "role" && value === "guest",
                        );
                        const batch = isBatchAddition(item);
                        const results = await Promise.allSettled(
                          pubkeys.map((pubkey) =>
                            memberAdditions.add(channelId, pubkey, {
                              ...(guest ? { role: "guest" as const } : {}),
                              ...(batch ? {} : { retry: true as const }),
                            }),
                          ),
                        );
                        const failed = results.find(
                          (result) => result.status === "rejected",
                        );
                        if (failed) throw failed.reason;
                      } else outbox.retry(item.event.id);
                      setError(undefined);
                    } catch (reason) {
                      setError(String(reason));
                    }
                  }}
                >
                  {t("channelForms.retry")}
                </Button>
              )}{" "}
            {item.guarded &&
              (item.delivery === "failed" || item.delivery === "unknown") && (
                <span>{t("v1shell.outbox.guarded")}</span>
              )}{" "}
            {item.delivery !== "sending" && (
              <Button
                type="button"
                onClick={async () => {
                  try {
                    const shareReceipt =
                      item.event.kind === 9 &&
                      // Share receipts, including those of earlier flows.
                      /^(snapshot-share:(agent|team)|solo-share-link:[^:]+|agent-share:[^:]+):.+$/.test(
                        item.recovery?.key ?? "",
                      ) &&
                      (item.delivery === "accepted" ||
                        item.delivery === "seen");
                    if (shareReceipt) await outbox.acknowledge(item.event.id);
                    await outbox.dismiss(item.event.id);
                    setError(undefined);
                  } catch (reason) {
                    setError(String(reason));
                  }
                }}
              >
                {t("v1shell.outbox.remove")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      <RelayTimings profiling={profiling} />
    </details>
  );
}
