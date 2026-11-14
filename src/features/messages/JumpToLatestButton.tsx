import { ArrowDownIcon } from "../../shared/design-system/icons/index";
import { Button } from "../../shared/design-system/ui/Button";
import { t, useLanguage } from "../../shared/i18n";
import styles from "./Messages.module.css";

export function JumpToLatestButton({
  visible,
  newMessageCount,
  onClick,
}: {
  visible: boolean;
  newMessageCount: number;
  onClick(): void;
}) {
  useLanguage();
  const label =
    newMessageCount > 0
      ? t(
          newMessageCount === 1
            ? "messageNotices.latest.one"
            : "messageNotices.latest.many",
          { count: newMessageCount },
        )
      : t("messageNotices.latest");
  return (
    <div
      className={styles.jumpToLatest}
      inert={!visible}
      aria-hidden={!visible}
      data-visible={visible}
    >
      <div className={styles.jumpToLatestSurface}>
        <Button
          data-jump-to-latest=""
          size="xs"
          shape="capsule"
          variant="ghost"
          onClick={onClick}
        >
          <ArrowDownIcon size={16} aria-hidden="true" />
          {label}
        </Button>
      </div>
    </div>
  );
}
