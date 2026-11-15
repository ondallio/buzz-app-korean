import type { Total } from "./stats";
import { t } from "../../shared/i18n";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** USD to the cent; a nonzero amount under a cent as such. */
export const cost = (usd: number) =>
  usd > 0 && usd < 0.005 ? "<$0.01" : dollars.format(usd);
export const percent = (share: number) => `${Math.round(share * 100)}%`;
/** A count in compact form, e.g. 12.4M, with `noun` pluralized. */
export function count(value: number, noun?: "session" | "agent") {
  const number = compact.format(value);
  if (!noun) return number;
  const plural = value === 1 ? "one" : "other";
  return t(`v1wf.usage.${noun}.${plural}`, { count: number });
}
/** A cost total as text: `Unavailable` when unknown, marked when partial. */
export const costText = (total: Total) =>
  total.value === undefined
    ? t("v1wf.usage.unavailable")
    : total.partial
      ? t("v1wf.usage.partialSuffix", { text: cost(total.value) })
      : cost(total.value);
/** A total's known value in `format`; `Unavailable` when none was known. */
export const amount = (total: Total, format: (value: number) => string) =>
  total.value === undefined ? t("v1wf.usage.unavailable") : format(total.value);
