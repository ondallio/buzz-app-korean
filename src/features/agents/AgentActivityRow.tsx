import { t, useLanguage } from "../../shared/i18n";
import type { ReactNode } from "react";
import { Avatar } from "../../shared/Avatar";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { ListBulletsIcon } from "../../shared/design-system/icons";
import styles from "./ActivityRows.module.css";

/** Shared working row: conversation navigation and activity are separate actions. */
export function AgentActivityRow({
  name,
  picture,
  status,
  meta,
  scope,
  openLabel,
  onOpen,
  onOpenActivity,
}: {
  name: string;
  picture?: string | undefined;
  status: string;
  meta?: ReactNode;
  scope?: string | undefined;
  openLabel: string;
  onOpen?: (() => void) | undefined;
  onOpenActivity?: (() => void) | undefined;
}) {
  useLanguage();
  const avatar = (
    <Avatar
      name={name}
      src={picture}
      shape="squircle"
      className={styles.activityAvatar ?? ""}
    />
  );
  const body = (
    <span className={styles.activityItemBody}>
      <span className={styles.activityItemHeading}>
        <strong>{name}</strong>
        {meta !== undefined && (
          <span className={styles.activityTimestamp}>{meta}</span>
        )}
      </span>
      {/* One clipped line: the hint keeps a cut-off scope readable. */}
      <span className={styles.activityItemMeta} title={scope || undefined}>
        <span>{status}</span>
        {scope && (
          <>
            {" "}
            · <span>{scope}</span>
          </>
        )}
      </span>
    </span>
  );
  return (
    <div
      className={`${styles.activityItem} ${onOpenActivity ? styles.activityItemWithAction : ""}`}
    >
      {onOpen ? (
        <NavigationItem
          type="button"
          aria-label={openLabel}
          onClick={onOpen}
          icon={avatar}
          label={body}
        />
      ) : (
        <div className={styles.activityStatic}>
          {avatar}
          {body}
        </div>
      )}
      {onOpenActivity && (
        <span className={styles.activityItemAction}>
          <IconButton
            size="toolbar"
            icon={<ListBulletsIcon />}
            aria-label={t("v1agent.activity.viewNamed", { name })}
            title={t("v1agent.activity.view")}
            onClick={onOpenActivity}
          />
        </span>
      )}
    </div>
  );
}
