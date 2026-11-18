import { useProfileGeneration } from "../../features/relay/react";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useIdentityNames } from "../../features/identity-names/react";
import type { PanelProps } from "../../features/panels/service";
import { profileTarget } from "../../features/profiles/target";
import { selectProfiles } from "../../features/relay/profile-selection";
import type { RelaySession } from "../../features/relay/session";
import { Button } from "../../shared/design-system/ui/Button";
import { formatPublicKey } from "../../shared/identity/public-key";
import styles from "./Profiles.module.css";
import { t, useLanguage } from "../../shared/i18n";

export function ProfileAgentIdentity({
  session,
  owner,
  viewer,
  context,
}: {
  session: RelaySession;
  owner: string;
  viewer: string | undefined;
  context: PanelProps["context"];
}) {
  useLanguage();
  return (
    <section
      aria-label={t("fubuilderlab.profile.agentIdentity")}
      className={styles.agentIdentity}
    >
      <h3 className="text-body">{t("fubuilderlab.profile.managedBy")}</h3>
      <OwnerLink
        session={session}
        owner={owner}
        self={owner === viewer}
        context={context}
      />
    </section>
  );
}

function OwnerLink({
  session,
  owner,
  self,
  context,
}: {
  session: RelaySession;
  owner: string;
  self: boolean;
  context: PanelProps["context"];
}) {
  const selection = useMemo(
    () => selectProfiles(session.profiles, [owner]),
    [session.profiles, owner],
  );
  const profiles = useSyncExternalStore(
    selection.subscribe,
    selection.snapshot,
    selection.snapshot,
  );
  const profileGeneration = useProfileGeneration(session.profiles);
  useEffect(() => {
    void profileGeneration;
    void session.profiles.ensure([owner], "background").catch(() => {});
  }, [session, owner, profileGeneration]);
  const identityName = useIdentityNames(session.names);
  const shown = identityName(
    owner,
    profiles.get(owner)?.name ?? formatPublicKey(owner) ?? owner,
  );
  const name = self ? t("channelForms.members.you", { name: shown }) : shown;
  const target = profileTarget(owner);
  return (
    <div>
      {target && context?.canOpen(target) ? (
        <Button
          size="compact"
          variant="ghost"
          aria-label={t("fubuilderlab.profile.openOwner", { name })}
          onClick={() => (context.push ?? context.open)(target)}
        >
          {name}
        </Button>
      ) : (
        name
      )}
    </div>
  );
}
