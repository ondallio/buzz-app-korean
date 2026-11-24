import { t, useLanguage } from "../../shared/i18n";
import { CaretDownIcon } from "../../shared/design-system/icons";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import type { SectionCap } from "./sidebar-section-caps";
import styles from "./Channels.module.css";

/** Show more and Show fewer share one row below a capped section's rows. */
export function SectionShowMore({
  sectionKey,
  title,
  cap,
  more,
  fewer,
}: {
  sectionKey: string;
  title: string;
  cap: SectionCap;
  more(): void;
  fewer(): void;
}) {
  useLanguage();
  if (!cap.hidden && !cap.foldable) return null;
  return (
    <div className={styles.sectionShowMore} data-section-show-more={sectionKey}>
      {cap.hidden > 0 && (
        <NavigationItem
          variant="text"
          data-show-more-expand=""
          label={t("channelForms.members.showMore")}
          aria-label={t("v106ch.section.showMoreIn", { name: title })}
          icon={
            <span className={styles.sectionShowMoreIcon} aria-hidden="true">
              <CaretDownIcon size={16} />
            </span>
          }
          onClick={more}
        />
      )}
      {cap.foldable && (
        <NavigationItem
          variant="text"
          data-show-more-fold=""
          label={t("v1shell.workspace.showLess")}
          aria-label={t("v106ch.section.showFewerIn", { name: title })}
          onClick={fewer}
        />
      )}
    </div>
  );
}
