import { useEffect, useSyncExternalStore } from "react";
import { useAgentPortraitSource } from "../agents/AgentCard";
import messageStyles from "../../features/messages/Messages.module.css";
import { RobotIcon } from "../../shared/design-system/icons";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { t, useLanguage } from "../../shared/i18n";
import {
  replaceView,
  subscribeView,
  viewRevision,
  writeView,
} from "../../shared/view-state";
import styles from "./PinnedBestie.module.css";

const key = (agent: string) => `bestie-first-agent.v1:${agent}`;

/** Capture creation provenance before the saved choice can unmount its chooser.
 * Optional local decoration: storage failure must not block agent creation. */
export function rememberFirstAgent(scope: string, agent: string) {
  writeView(scope, key(agent), { channel: null });
}

export function useFirstAgentWelcome(
  scope: string,
  agent: string,
  channel: string,
) {
  const revision = useSyncExternalStore(
    (listener) => subscribeView(scope, listener),
    () => viewRevision(scope, key(agent)),
  );
  let savedChannel: string | null | undefined;
  try {
    const receipt: unknown = JSON.parse(revision ?? "null");
    if (receipt && typeof receipt === "object" && "channel" in receipt) {
      if (receipt.channel === null || typeof receipt.channel === "string")
        savedChannel = receipt.channel;
    }
  } catch {
    // A malformed or unavailable receipt supplies no first-creation evidence.
  }
  useEffect(() => {
    if (savedChannel === null)
      replaceView(scope, key(agent), revision, { channel });
  }, [scope, agent, channel, revision, savedChannel]);
  return savedChannel === channel;
}

/** Local app content using incoming-message presentation, never a relay row. */
export function FirstAgentWelcome({
  name,
  picture,
  community,
}: {
  name: string;
  picture?: string | undefined;
  community?: string | undefined;
}) {
  useLanguage();
  const { src } = useAgentPortraitSource({ name, picture }, community);
  return (
    <article
      className={`${messageStyles.message} ${styles.welcome}`}
      data-layout="timeline"
      aria-label={t("fubestie.welcome.label")}
    >
      <span className={messageStyles.messageGutter} />
      <div className={messageStyles.messageBody}>
        <div className={messageStyles.messageContent}>
          <div className={messageStyles.messageAvatar}>
            <Avatar
              src={src}
              alt={t("fubestie.welcome.avatar", { name })}
              fallback={name}
              shape="squircle"
            />
          </div>
          <div className={messageStyles.byline}>
            <strong className={messageStyles.author}>
              <RobotIcon
                aria-hidden="true"
                className={messageStyles.authorAgentIcon}
              />
              {name}
            </strong>
          </div>
          <div className={messageStyles.messageBubble}>
            <div className={messageStyles.text}>
              <h3>{t("fubestie.welcome.title")}</h3>
              <p>{t("fubestie.welcome.findMe")}</p>
              <p>{t("fubestie.welcome.questions")}</p>
              <p>{t("fubestie.welcome.askAway")}</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
