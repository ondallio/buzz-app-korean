import {
  localMessage,
  type LocalMessage,
} from "../shared/i18n/deferred-message";
import { TranslatedMessage } from "../shared/i18n/Message";
import type { LeaveOutcome } from "../features/communities/api";
import { t, useLanguage } from "../shared/i18n";
import { useEffect, useRef, useState } from "react";
import {
  communityActionLabel,
  communityDefaultName,
} from "../features/communities/names";
import { communityDestination } from "../features/communities/destination";
import type { Communities, Membership } from "../features/communities/service";
import {
  CommunityDepartureError,
  leaveCommunity,
  removeCommunityFromDevice,
} from "../features/communities/departure";
import { AlertDialog } from "../shared/design-system/ui/AlertDialog";
import { Button } from "../shared/design-system/ui/Button";
import { Header } from "../shared/design-system/ui/Header";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { useToastNotification } from "../shared/design-system/ui/Toast";

type Intent = "remove" | "leave";

function completedDeparture(
  name: string,
  outcome: LeaveOutcome | "remove",
  residue: boolean,
): LocalMessage {
  const keys = {
    remove: ["settings.removed", "settings.removedResidue"],
    left: ["settings.left", "settings.leftResidue"],
    "already-absent": ["settings.absent", "settings.absentResidue"],
    "access-revoked": ["settings.banned", "settings.bannedResidue"],
  } as const;
  return localMessage(keys[outcome][residue ? 1 : 0], { name });
}

function failedDeparture(
  name: string,
  intent: Intent,
  error: unknown,
): LocalMessage {
  const departure =
    error instanceof CommunityDepartureError ? error : undefined;
  const failure =
    intent === "leave" && departure?.phase === "device"
      ? departure.reason
      : (departure?.reason ?? error);
  if (intent === "leave" && departure?.phase !== "device")
    return localMessage(
      failure instanceof Error &&
        failure.message === "invalid: relay owner cannot leave"
        ? "settings.ownerCannotLeave"
        : "settings.leaveFailed",
      { name },
    );
  const words = (value: unknown) =>
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "";
  const reason = (
    words(failure instanceof Error ? failure.cause : undefined) ||
    words(failure)
  ).replace(/\.$/, "");
  const keys =
    intent === "remove"
      ? (["settings.removeFailed", "settings.removeFailedDetails"] as const)
      : departure?.outcome === "already-absent"
        ? ([
            "settings.absentCleanupFailed",
            "settings.absentCleanupFailedDetails",
          ] as const)
        : departure?.outcome === "access-revoked"
          ? ([
              "settings.bannedCleanupFailed",
              "settings.bannedCleanupFailedDetails",
            ] as const)
          : ([
              "settings.leftCleanupFailed",
              "settings.leftCleanupFailedDetails",
            ] as const);
  return reason
    ? localMessage(keys[1], { name, reason })
    : localMessage(keys[0], { name });
}

export function CommunityDepartureSettings({
  communities,
  community,
  onRemoved,
  onPending,
}: {
  communities: Communities;
  community: Membership;
  onRemoved(): void;
  onPending?: (pending: boolean) => void;
}) {
  useLanguage();
  const notify = useToastNotification();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const completed = useRef(false);
  const removeButton = useRef<HTMLButtonElement>(null);
  const leaveButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = async () => {
    if (!intent || busy.current) return;
    const viewer = communities.snapshot().viewer;
    busy.current = true;
    setPending(true);
    onPending?.(true);
    try {
      if (intent === "leave") {
        const result = await leaveCommunity(communities, community);
        // Removing the selected community can unmount this page before cleanup
        // finishes. Its result still belongs in the host toast, not a new form.
        if (communities.snapshot().viewer === viewer)
          notify(
            <TranslatedMessage
              value={completedDeparture(
                communityActionLabel(community),
                result.outcome,
                result.residue.length > 0,
              )}
            />,
            result.outcome === "left" ? "success" : "info",
          );
      } else {
        const result = await removeCommunityFromDevice(communities, community);
        if (communities.snapshot().viewer === viewer)
          notify(
            <TranslatedMessage
              value={completedDeparture(
                communityActionLabel(community),
                "remove",
                result.residue.length > 0,
              )}
            />,
            "success",
          );
      }
      if (mounted.current && communities.snapshot().viewer === viewer) {
        completed.current = true;
        setIntent(null);
        onRemoved();
      }
    } catch (error) {
      if (communities.snapshot().viewer !== viewer) return;
      notify(
        <TranslatedMessage
          value={failedDeparture(
            communityActionLabel(community),
            intent,
            error,
          )}
        />,
        "error",
      );
      if (mounted.current) setIntent(null);
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        onPending?.(false);
      }
    }
  };
  return (
    <section aria-labelledby="leave-community-title">
      <Header
        id="leave-community-title"
        title={t("settings.leaveRemove")}
        subtitle={t("settings.leaveRemoveDescription")}
      />
      <SettingsGroup>
        <PreferenceRow
          title={t("settings.removeDevice")}
          subtitle={t("settings.removeDescription")}
          trailing={
            <Button
              ref={removeButton}
              type="button"
              disabled={pending}
              onClick={() => setIntent("remove")}
            >
              {t("settings.removeDevice")}
            </Button>
          }
        />
        <PreferenceRow
          title={t("settings.leaveCommunity")}
          subtitle={t("settings.leaveDescription")}
          trailing={
            <Button
              ref={leaveButton}
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => setIntent("leave")}
            >
              {t("settings.leaveCommunity")}
            </Button>
          }
        />
      </SettingsGroup>
      {intent && (
        <AlertDialog
          title={
            intent === "leave"
              ? t("settings.leaveConfirm", {
                  community: communityDefaultName(community),
                })
              : t("settings.removeConfirm", {
                  community: communityDefaultName(community),
                })
          }
          description={
            intent === "leave"
              ? t("settings.leaveConfirmDescription")
              : t("settings.removeConfirmDescription")
          }
          pending={pending}
          finalFocus={() =>
            completed.current
              ? false
              : intent === "leave"
                ? leaveButton.current
                : removeButton.current
          }
          onClose={() => setIntent(null)}
          actions={
            <>
              <Button disabled={pending} onClick={() => setIntent(null)}>
                {t("settings.cancel")}
              </Button>
              <Button
                variant={intent === "leave" ? "destructive" : "prominent"}
                loading={pending}
                onClick={() => void run()}
              >
                {intent === "leave"
                  ? t("settings.leaveCommunity")
                  : t("settings.removeDevice")}
              </Button>
            </>
          }
        >
          <div className="min-w-0 space-y-2 text-body-sm">
            {community.localName &&
              community.localName !== communityDefaultName(community) && (
                <p className="text-muted">
                  {t("settings.shownAs", { name: community.localName })}
                </p>
              )}
            <p className="break-all">
              {communityDestination(community.id).url}
            </p>
          </div>
        </AlertDialog>
      )}
    </section>
  );
}
