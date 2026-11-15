import { t, useLanguage } from "../shared/i18n";
export function RecommendationCount({ count }: { count: number }) {
  useLanguage();
  if (!count) return null;
  return (
    <span className="text-caption text-muted">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        {count === 1
          ? t("v1id.recommendedOne", { count })
          : t("v1id.recommendedMany", { count })}
      </span>
    </span>
  );
}
