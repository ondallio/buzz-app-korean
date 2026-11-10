import { t, useLanguage, formattingLocale } from "../../shared/i18n";
import { rich } from "../../shared/i18n/rich";
import { Children, useState } from "react";
import type { InboxReaction } from "../../features/relay/inbox-reactions";
import { groupReactions } from "../../features/relay/fold";
import { useReactionName } from "../../features/messages/use-reaction-name";
import type { ComponentProps, ReactNode } from "react";
import { channelText } from "../../features/channels/channel-icon";
import type { ChannelSummary, Profile } from "../../features/relay/contracts";
import type { InboxItem } from "../../features/relay/inbox";
import type { InboxFeedSnapshot } from "../../features/relay/inbox-feed";
import type { RelaySession } from "../../features/relay/session";
import { messagePreview } from "../../features/notifications/content";
import { avatarMedia } from "../../shared/avatar-source";
import { LightningIcon } from "../../shared/design-system/icons";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import { formatPublicKey } from "../../shared/identity/public-key";
import { dmLabel } from "./dm-label";
import styles from "./Inbox.module.css";
import rowStyles from "../../features/messages/MessageListRow.module.css";
import { MessageListRow } from "../../features/messages/MessageListRow";

/** Display-only Activity time; canonical shared timestamp output stays unchanged. */
export function inboxTimestamp(
  unixSeconds: number,
  nowSeconds = Date.now() / 1000,
) {
  const age = Math.max(0, nowSeconds - unixSeconds);
  if (age < 60) return t("inbox.justNow");
  if (age < 3600) {
    const count = Math.floor(age / 60);
    return t(count === 1 ? "inbox.minuteOne" : "inbox.minuteMany", { count });
  }
  if (age < 86400) {
    const count = Math.floor(age / 3600);
    return t(count === 1 ? "inbox.hourOne" : "inbox.hourMany", { count });
  }
  if (age < 604800) {
    const count = Math.floor(age / 86400);
    return t(count === 1 ? "inbox.dayOne" : "inbox.dayMany", { count });
  }
  return t("inbox.onDate", {
    date: new Date(unixSeconds * 1000).toLocaleDateString(formattingLocale(), {
      month: "short",
      day: "numeric",
    }),
  });
}

// Both catalogs put sender first. Keep its shrinkable strong and the remaining
// whole-template text/glyphs in the original nonshrinking tail. The colocated
// test binds this slot/position contract to the production templates.
function reactionHeading(
  sender: Exclude<ReactNode, undefined>,
  reactions: Exclude<ReactNode, undefined>,
) {
  const [heading, ...tail] = Children.toArray(
    rich("inbox.reactionCaption", { sender, reactions }),
  ).filter((part) => part !== "");
  return (
    <>
      {heading}
      <span className={`text-body-sm text-standard ${styles.reactionTail}`}>
        {tail}
      </span>
    </>
  );
}

type ResolveName = (
  key: string,
  fallback: string,
  candidates?: readonly string[],
) => string;

export const hasUnread = (item: InboxItem) =>
  item.unreadCount > 0 || item.manual;

/** What a preview shows instead of a body whose stored edits or deletions are
 * not settled yet, or undefined when none of `ids` is incomplete. */
export const incompletePreview = (
  feed: InboxFeedSnapshot,
  ids: readonly (string | undefined)[],
) =>
  ids.some((id) => id !== undefined && feed.incomplete.includes(id))
    ? feed.status === "error"
      ? t("inbox.previewUnavailable")
      : t("inbox.previewUpdating")
    : undefined;

/** Who sent a row and where, as the Inbox page and its dock preview name it. */
export function rowIdentity(
  item: InboxItem,
  channel: ChannelSummary | undefined,
  profiles: ReadonlyMap<string, Profile>,
  name: ResolveName,
) {
  const displayId = item.workflowOwnerId ?? item.authorId;
  const profile = profiles.get(displayId);
  const resolved = name(
    displayId,
    profile?.name ?? formatPublicKey(displayId) ?? t("inbox.unknownSender"),
    channel?.members,
  );
  const sender = item.workflowOwnerId
    ? t("inbox.workflowCaption", { name: resolved })
    : resolved;
  const context =
    channel?.channelType === "dm"
      ? t("inbox.dmContext", {
          name:
            channel.participants?.length === 0
              ? t("inbox.notesSelf")
              : dmLabel(
                  channel.participants,
                  profiles,
                  name,
                  channel.name ?? t("inbox.directMessage"),
                ),
        })
      : channel
        ? channelText(channel)
        : t("inbox.conversation");
  return { sender, context, profile };
}

/** Profiles a row names: its sender or workflow owner and up to three DM participants. */
export const rowProfileIds = (
  item: Pick<InboxItem, "workflowOwnerId">,
  channel: ChannelSummary | undefined,
): string[] => [
  ...(item.workflowOwnerId ? [item.workflowOwnerId] : []),
  ...(channel?.channelType === "dm"
    ? (channel.participants?.slice(0, 3) ?? [])
    : []),
];

/** One Inbox conversation row's button: avatar, sender, source, time, preview and unread mark. */
export function InboxRowButton({
  item,
  identity: { sender, context, profile },
  media,
  feed,
  time,
  previewId,
  ...props
}: {
  item: InboxItem;
  identity: ReturnType<typeof rowIdentity>;
  media: RelaySession["media"];
  feed: InboxFeedSnapshot;
  time: ReactNode;
  previewId?: string | undefined;
} & Omit<
  ComponentProps<typeof NavigationItem>,
  "icon" | "label" | "trailing" | "aria-label"
>) {
  useLanguage();
  const unread = hasUnread(item);
  return (
    <MessageListRow
      {...props}
      aria-label={t("inbox.openRow", { sender, context })}
      aria-describedby={previewId}
      avatar={
        <Avatar
          size="fill"
          alt=""
          fallback={sender}
          fallbackContent={
            item.workflowOwnerId ? <LightningIcon size={20} /> : undefined
          }
          src={
            item.workflowOwnerId
              ? undefined
              : avatarMedia(profile?.picture, media)
          }
          shape={
            item.workflowOwnerId || profile?.isAgent ? "squircle" : "circle"
          }
        />
      }
      sender={sender}
      source={context}
      time={
        <time dateTime={new Date(item.createdAt * 1000).toISOString()}>
          {time}
        </time>
      }
      unread={unread}
      previewId={previewId}
      preview={
        incompletePreview(feed, [item.previewMessageId, ...item.messageIds]) ??
        messagePreview(item.preview)
      }
    />
  );
}

/** Reaction activity is context, never an unread conversation or a read action. */
export function ReactionRowButton({
  item,
  session,
  profiles,
  name,
  channel,
  time = inboxTimestamp(item.createdAt),
  ...props
}: {
  item: InboxReaction;
  time?: ReactNode;
  session: RelaySession;
  profiles: ReadonlyMap<string, Profile>;
  name: ResolveName;
  channel: ChannelSummary | undefined;
} & Pick<ComponentProps<typeof NavigationItem>, "selected" | "onClick">) {
  useLanguage();
  const reactionName = useReactionName();
  const authors = [...new Set(item.events.map((event) => event.pubkey))];
  const names = authors
    .slice(0, authors.length === 3 ? 3 : 2)
    .map((id) =>
      name(
        id,
        profiles.get(id)?.name ?? formatPublicKey(id) ?? t("inbox.someone"),
        channel?.members,
      ),
    );
  const sender =
    authors.length > 3
      ? t("inbox.senderMore", {
          names: names.join(", "),
          count: authors.length - 2,
        })
      : authors.length === 3
        ? t("inbox.senderThree", {
            first: names[0] ?? "",
            second: names[1] ?? "",
            third: names[2] ?? "",
          })
        : names.length === 2
          ? t("inbox.senderTwo", {
              first: names[0] ?? "",
              second: names[1] ?? "",
            })
          : names.join(" and ");
  const profile = profiles.get(authors[0] ?? "");
  const context =
    channel?.channelType === "dm"
      ? t("inbox.dmWith", {
          name:
            channel.participants?.length === 0
              ? t("inbox.notesSelf")
              : dmLabel(
                  channel.participants,
                  profiles,
                  name,
                  channel.name ?? t("inbox.directMessage"),
                ),
        })
      : channel
        ? channelText(channel)
        : t("inbox.conversation");
  const reactions = groupReactions(item.events);
  const preview = messagePreview(item.message.content);
  const emojiNames = reactions
    .map((reaction) =>
      reaction.emoji
        ? `:${reaction.emoji.shortcode}:`
        : (reactionName?.(reaction.content) ?? reaction.content)
            .replaceAll(":", "")
            .replaceAll("_", " "),
    )
    .join(", ");
  return (
    <NavigationItem
      {...props}
      aria-label={t("inbox.reactedAria", {
        sender,
        reactions: emojiNames,
        preview,
      })}
      icon={
        <Avatar
          size="default"
          alt=""
          fallback={sender}
          src={avatarMedia(profile?.picture, session.media)}
          shape={profile?.isAgent ? "squircle" : "circle"}
        />
      }
      trailing={<span className={rowStyles.unreadSlot} aria-hidden="true" />}
      label={
        <span className={rowStyles.content}>
          <span className={rowStyles.heading}>
            <span className={rowStyles.identity}>
              <span className={styles.reactionHeading}>
                {reactionHeading(
                  <strong
                    className={`text-label-sm text-standard ${rowStyles.sender}`}
                  >
                    {sender}
                  </strong>,
                  reactions.map((reaction) => (
                    <ActivityReactionGlyph
                      key={JSON.stringify([
                        reaction.content,
                        reaction.emoji?.url,
                      ])}
                      reaction={reaction}
                      session={session}
                    />
                  )),
                )}
              </span>
            </span>
            <time
              data-inbox-date=""
              className={`text-caption text-subtle ${rowStyles.rowDate}`}
              dateTime={new Date(item.createdAt * 1000).toISOString()}
            >
              {time}
            </time>
          </span>
          <span className={`text-body text-subtle ${styles.reactionPreview}`}>
            {preview}
          </span>
          <span className={`text-caption ${rowStyles.source}`}>
            {t("inbox.inContext", { context })}
          </span>
        </span>
      }
    />
  );
}
function ActivityReactionGlyph({
  reaction,
  session,
}: {
  reaction: ReturnType<typeof groupReactions>[number];
  session: RelaySession;
}) {
  const source = reaction.emoji ? session.media(reaction.emoji.url) : undefined;
  const [failed, setFailed] = useState<string>();
  return source && source !== failed ? (
    <img
      src={source}
      className={styles.reactionEmoji}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailed(source)}
    />
  ) : (
    <span aria-hidden="true">{reaction.content} </span>
  );
}
