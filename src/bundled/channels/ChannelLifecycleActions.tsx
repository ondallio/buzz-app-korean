import { t, useLanguage } from "../../shared/i18n";
import { lifecycleMessageKeys } from "./ChannelLifecycleDialog";
import type { ChannelSummary } from "../../features/relay/contracts";
import type { ChannelLifecycleAction } from "../../features/relay/channel-lifecycle-protocol";
import { Button } from "../../shared/design-system/ui/Button";
import {
  ArchiveIcon,
  SignOutIcon,
  TrashIcon,
} from "../../shared/design-system/icons";
import type { LifecycleNoun } from "./ChannelLifecycleDialog";
import { useLifecycleOffer, type LifecycleSession } from "./useLifecycleOffer";

/** Settings offers live-state actions; the sidebar owns confirmation. */
export function ChannelLifecycleActions({
  channel,
  session,
  choose,
  noun = "channel",
}: {
  channel: ChannelSummary;
  session: LifecycleSession;
  choose(action: ChannelLifecycleAction, trigger: HTMLElement): void;
  noun?: LifecycleNoun;
}) {
  useLanguage();
  const permissions = useLifecycleOffer(session, channel);
  if (!session.channelLifecycle.available)
    return <p>{t("channelsMenus.lifecycle.unavailable")}</p>;
  return (
    <>
      {permissions?.canLeave && (
        <Button onClick={(event) => choose("leave", event.currentTarget)}>
          <SignOutIcon size={16} aria-hidden="true" />
          {t(lifecycleMessageKeys("leave", noun).title)}
        </Button>
      )}
      {(permissions?.canArchive || permissions?.canUnarchive) && (
        <Button
          onClick={(event) =>
            choose(
              permissions.canUnarchive ? "unarchive" : "archive",
              event.currentTarget,
            )
          }
        >
          <ArchiveIcon size={16} aria-hidden="true" />
          {t(
            lifecycleMessageKeys(
              permissions.canUnarchive ? "unarchive" : "archive",
              noun,
            ).title,
          )}
        </Button>
      )}
      {permissions?.canDelete && (
        <Button
          variant="destructive"
          onClick={(event) => choose("delete", event.currentTarget)}
        >
          <TrashIcon size={16} aria-hidden="true" />
          {t(lifecycleMessageKeys("delete", noun).title)}
        </Button>
      )}
    </>
  );
}
