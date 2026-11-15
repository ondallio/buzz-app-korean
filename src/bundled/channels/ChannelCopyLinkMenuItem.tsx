import { t, useLanguage } from "../../shared/i18n";
import { localMessage } from "../../shared/i18n/deferred-message";
import { TranslatedMessage } from "../../shared/i18n/Message";
import { LinkIcon } from "../../shared/design-system/icons";
import { MenuIcon, MenuItem } from "../../shared/design-system/ui/Menu";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import { writeClipboardText } from "../../shared/clipboard";

/** The link carries no community; it opens in the recipient's selected one. */
export function ChannelCopyLinkMenuItem({ channelId }: { channelId: string }) {
  useLanguage();
  const notify = useToastNotification();
  return (
    <MenuItem
      onClick={() =>
        writeClipboardText(
          `buzz://channel/${encodeURIComponent(channelId)}`,
        ).then(
          () =>
            notify(
              <TranslatedMessage
                value={localMessage("channelsMenus.copy.success")}
              />,
              "success",
            ),
          () =>
            notify(
              <TranslatedMessage
                value={localMessage("channelsMenus.copy.failure")}
              />,
              "error",
            ),
        )
      }
    >
      <MenuIcon>
        <LinkIcon size={14} />
      </MenuIcon>
      {t("channelsMenus.copy.label")}
    </MenuItem>
  );
}
