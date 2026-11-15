import { formattingLocale, t } from "./i18n";

/** Matches Buzz desktop's thread-summary recency ladder (dateFormatters.ts). */
export function relativeTimestamp(
  unixSeconds: number,
  nowSeconds = Date.now() / 1000,
) {
  const age = Math.max(0, nowSeconds - unixSeconds);
  if (age < 60) return t("inbox.justNow");
  if (age < 3600) {
    const count = Math.floor(age / 60);
    return t(count === 1 ? "inbox.minuteOne" : "inbox.minuteMany", { count });
  }
  if (age < 86400) {
    const count = Math.floor(age / 3600);
    return t(count === 1 ? "inbox.hourOne" : "inbox.hourMany", { count });
  }
  if (age < 604800) {
    const count = Math.floor(age / 86400);
    return t(count === 1 ? "inbox.dayOne" : "inbox.dayMany", { count });
  }
  return t("inbox.onDate", {
    date: new Date(unixSeconds * 1000).toLocaleDateString(formattingLocale(), {
      month: "short",
      day: "numeric",
    }),
  });
}
