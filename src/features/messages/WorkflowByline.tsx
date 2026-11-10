import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { InfoIcon } from "../../shared/design-system/icons";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPopup,
  PopoverTitle,
  PopoverDescription,
} from "../../shared/design-system/ui/Popover";
import { profileTarget } from "../profiles/target";
import styles from "./Messages.module.css";
import { t, useLanguage } from "../../shared/i18n";
import { rich } from "../../shared/i18n/rich";

export function WorkflowByline({
  ownerId,
  ownerName,
  canOpenLink,
  onOpenLink,
}: {
  ownerId: string;
  ownerName: string;
  canOpenLink?: ((url: string) => boolean) | undefined;
  onOpenLink(url: string): boolean;
}) {
  useLanguage();
  const target = profileTarget(ownerId);
  return (
    <span className={styles.workflowAttribution}>
      <strong className={styles.author}>{t("messageRow.workflow")}</strong>
      <span className={styles.workflowOwner}>
        <span aria-hidden="true">· </span>
        {rich("messageRow.workflowOwner", {
          owner:
            target && canOpenLink?.(target) ? (
              <Button
                variant="link"
                size="inline"
                aria-label={t("messageRow.viewWorkflowOwner", {
                  name: ownerName,
                })}
                onClick={() => onOpenLink(target)}
              >
                {ownerName}
              </Button>
            ) : (
              ownerName
            ),
        })}
      </span>
      <PopoverRoot>
        <PopoverTrigger
          openOnHover="preview"
          render={
            <IconButton
              size="xs"
              variant="ghost"
              aria-label={t("messageRow.workflowDetails")}
              icon={<InfoIcon />}
            />
          }
        />
        <PopoverPopup size="compact">
          <PopoverTitle>{t("messageRow.workflowMessage")}</PopoverTitle>
          <PopoverDescription>
            {t("messageRow.workflowExplanation")}
          </PopoverDescription>
        </PopoverPopup>
      </PopoverRoot>
    </span>
  );
}
