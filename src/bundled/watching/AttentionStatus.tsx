import type { RefObject } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { CircleIcon } from "../../shared/design-system/icons";
import {
  MenuRoot,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuGroup,
  MenuGroupLabel,
  MenuSeparator,
} from "../../shared/design-system/ui/Menu";
import { t, useLanguage } from "../../shared/i18n";

export function AttentionStatus({
  name,
  heading,
  active,
  pending,
  onChange,
  onDelete,
  triggerRef,
  returnFocus,
  popupRef,
  deleteConfirms = false,
  label,
}: {
  name: string;
  heading?: string;
  popupRef?: RefObject<HTMLDivElement | null>;
  deleteConfirms?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  label?: string;
  onDelete?(): void;
  active: boolean;
  pending: boolean;
  onChange(active: boolean): void;
}) {
  useLanguage();
  const menuLabel = label ?? t("v1wf.watch.statusFor", { name });
  return (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button
            ref={triggerRef}
            variant="subtle"
            size="xs"
            aria-label={menuLabel}
          >
            <CircleIcon
              data-accent={active ? "citrus" : undefined}
              data-color-mode={active ? "light" : undefined}
              size={12}
              fill="currentColor"
              strokeWidth={0}
              aria-hidden="true"
              style={{
                color: active
                  ? "var(--affordance-accent-prominent)"
                  : "var(--text-subtle)",
              }}
            />
            {active ? t("v1wf.watch.active") : t("v1wf.watch.paused")}
          </Button>
        }
      />
      <MenuPopup
        ref={popupRef}
        finalFocus={() =>
          triggerRef?.current?.isConnected
            ? triggerRef.current
            : (returnFocus?.current ?? true)
        }
        size="compact"
        align="end"
        aria-label={menuLabel}
      >
        <MenuGroup>
          <MenuGroupLabel>
            {heading ?? t("v1wf.watch.attention")}
          </MenuGroupLabel>
          <MenuItem
            disabled={pending}
            closeOnClick={false}
            onClick={() => onChange(!active)}
          >
            {active ? t("v1wf.watch.pause") : t("v1wf.watch.resume")}
          </MenuItem>
          {onDelete && <MenuSeparator />}
          {onDelete && (
            <MenuItem
              tone="danger"
              disabled={pending}
              closeOnClick={deleteConfirms}
              onClick={onDelete}
            >
              {t("v1wf.watch.delete")}
            </MenuItem>
          )}
        </MenuGroup>
      </MenuPopup>
    </MenuRoot>
  );
}
