import { t, useLanguage } from "../../shared/i18n";
import type { ReactNode, Ref } from "react";
import styles from "./Inbox.module.css";
import { Button } from "../../shared/design-system/ui/Button";
import { Switch } from "../../shared/design-system/ui/Switch";
import { Tabs } from "../../shared/design-system/ui/Tabs";
import {
  MenuRoot,
  MenuTrigger,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
} from "../../shared/design-system/ui/Menu";
import { CaretDownIcon } from "../../shared/design-system/icons";

export type ActivityFilter =
  | "all"
  | "threads"
  | "mentions"
  | "dms"
  | "reactions";
export type SenderFilter = "everyone" | "humans" | "agents";
const views = [
  { value: "all", label: "inbox.all" },
  { value: "threads", label: "inbox.threads" },
  { value: "mentions", label: "inbox.mentions" },
  { value: "dms", label: "inbox.dms" },
  { value: "reactions", label: "inbox.reactions" },
] as const;
const senders = [
  { value: "everyone", label: "inbox.anyone" },
  { value: "humans", label: "inbox.people" },
  { value: "agents", label: "inbox.agents" },
] as const satisfies readonly { value: SenderFilter; label: string }[];

/**
 * Type tabs, From and Unread as one left-aligned group, like Slack's Activity,
 * so Unread stays in view on a wide page. From's visible label stays short so
 * the bar fits one row in a narrow list; its name says the choice, and a fill
 * shows when it narrows the list.
 */
export function InboxFilters({
  view,
  sender,
  unreadOnly,
  triggerRef,
  onViewChange,
  onSenderChange,
  onUnreadChange,
  status,
}: {
  view: ActivityFilter;
  sender: SenderFilter;
  unreadOnly: boolean;
  triggerRef: Ref<HTMLButtonElement>;
  onViewChange(view: ActivityFilter): void;
  onSenderChange(sender: SenderFilter): void;
  onUnreadChange(checked: boolean): void;
  /** Refresh status, sharing the last line with Unread so it never adds one. */
  status?: ReactNode;
}) {
  useLanguage();
  const from = senders.find((entry) => entry.value === sender) ?? senders[0];
  const fromKeys = {
    everyone: "inbox.fromAnyone",
    humans: "inbox.fromPeople",
    agents: "inbox.fromAgents",
  } as const;
  const fromLabel = t(fromKeys[from.value]);
  return (
    <div className={styles.filters}>
      <div className={styles.typeTabs}>
        <Tabs
          label={t("inbox.activityType")}
          variant="panel"
          size="sm"
          value={view}
          items={views.map((item) => ({ ...item, label: t(item.label) }))}
          onValueChange={onViewChange}
        />
      </div>
      <MenuRoot>
        <MenuTrigger
          ref={triggerRef}
          render={
            <Button
              size="sm"
              variant={sender === "everyone" ? "ghost" : "subtle"}
              aria-label={fromLabel}
              title={fromLabel}
            >
              {t("inbox.from")}
              <CaretDownIcon size="1rem" />
            </Button>
          }
        />
        <MenuPopup
          aria-label={t("inbox.from")}
          style={{ maxHeight: "var(--available-height)" }}
        >
          <MenuRadioGroup
            value={sender}
            onValueChange={(value) => onSenderChange(value as SenderFilter)}
          >
            {senders.map(({ value, label }) => (
              <MenuRadioItem key={value} value={value} closeOnClick>
                {t(label)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </MenuRoot>
      <Switch
        label={t("inbox.unread")}
        checked={unreadOnly}
        onCheckedChange={onUnreadChange}
      />
      {status}
    </div>
  );
}
