import { CaretRightIcon } from "../../shared/design-system/icons";
import { t, useLanguage } from "../../shared/i18n";
import styles from "./Compute.module.css";

export type ComputeActivityData = {
  otherNodes: number | null;
  sharingNodes: number | null;
  outputTokens: number | null;
  completedRequests: number | null;
  finishedRequests: number | null;
  retries: number | null;
  activeRequests: number | null;
  tokensPerSecond: number | null;
};

export function ComputeActivity({
  data,
}: {
  data: ComputeActivityData | null;
}) {
  useLanguage();
  const format = (value: number | null) =>
    value == null
      ? "—"
      : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return (
    <section
      aria-label={t("fubestie.activity.title")}
      className={styles.activity}
    >
      <div className={styles.activityHeader}>
        <h2 className="m-0 text-body">{t("fubestie.activity.title")}</h2>
        <span className={`${styles.sessionStatus} text-caption text-secondary`}>
          <span
            className={styles.statusLight}
            data-active={
              data?.activeRequests != null && data.activeRequests > 0
            }
            aria-hidden="true"
          />
          {data?.activeRequests == null
            ? t("fubestie.activity.thisSession")
            : data.activeRequests > 0
              ? t("fubestie.activity.processing")
              : t("fubestie.activity.standby")}
        </span>
      </div>
      {data ? (
        <dl className={styles.metrics}>
          {(
            [
              [t("fubestie.activity.outputTokens"), data.outputTokens],
              [t("fubestie.activity.completed"), data.completedRequests],
              [t("fubestie.activity.sharingNodes"), data.sharingNodes],
              [t("fubestie.activity.tokensPerSecond"), data.tokensPerSecond],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className={styles.metric}>
              <dt
                className={`${styles.metricLabel} text-caption text-secondary`}
              >
                {label}
              </dt>
              <dd
                className={`${styles.readout} m-0 text-body`}
                title={
                  value == null
                    ? t("fubestie.activity.notAvailable")
                    : format(value)
                }
              >
                {value == null ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">
                      {t("fubestie.activity.notAvailable")}
                    </span>
                  </>
                ) : (
                  format(value)
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-body-sm text-secondary">
          {t("fubestie.activity.unavailable")}
        </p>
      )}
      <details className={styles.details}>
        <summary className="text-body-sm text-secondary">
          <CaretRightIcon
            className={styles.detailsArrow}
            size={16}
            aria-hidden="true"
          />
          {t("fubestie.activity.details")}
        </summary>
        {data && (
          <dl className={styles.secondaryMetrics}>
            {(
              [
                [t("fubestie.activity.otherNodes"), data.otherNodes],
                [t("fubestie.activity.finished"), data.finishedRequests],
                [t("fubestie.activity.active"), data.activeRequests],
                [t("fubestie.activity.retries"), data.retries],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className={styles.metric}>
                <dt className="text-caption text-secondary">{label}</dt>
                <dd className={`${styles.readout} m-0 text-body`}>
                  {format(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </details>
    </section>
  );
}
