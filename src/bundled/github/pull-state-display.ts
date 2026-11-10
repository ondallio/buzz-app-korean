import { t } from "../../shared/i18n";
import { describePull } from "./pull-state-view";

/** Render-only PR wording; inputs and the canonical English producer stay unchanged. */
export function displayPull(read: Parameters<typeof describePull>[0]): string {
  if (!read.failed && read.state?.state === "merged")
    return t("githubPullLinks.pull.merged");
  return describePull(read);
}
