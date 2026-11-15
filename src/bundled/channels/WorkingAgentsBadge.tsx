import { t, useLanguage } from "../../shared/i18n";
import { TypingDots } from "../../shared/design-system/ui/TypingDots";
import type { Profile } from "../../features/relay/contracts";
import { publicKeyLabels } from "../../shared/identity/public-key";
import styles from "./Channels.module.css";

export function WorkingAgentsBadge({
  agents,
  profiles,
  channelName,
  waiting = false,
}: {
  agents: readonly string[];
  profiles: ReadonlyMap<string, Profile>;
  channelName: string;
  waiting?: boolean;
}) {
  useLanguage();
  if (!agents.length) return null;
  const labels = publicKeyLabels(agents);
  const name = (agent: string) =>
    profiles.get(agent)?.name ?? labels.get(agent) ?? t("agentsDetails.agent");
  return (
    <span
      className={`${styles.thinkingBadge} buzz-arrive`}
      data-channel-working=""
      data-indicator-layer="working"
      role="img"
      aria-label={t(
        waiting ? "v1shell.working.waiting" : "v1shell.working.working",
        { names: agents.map(name).join(", "), channel: channelName },
      )}
    >
      <TypingDots state={waiting ? "waiting" : "working"} />
    </span>
  );
}
