import { t, useLanguage } from "../../shared/i18n";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type ExternalApps,
  fullAgentAccess,
} from "../../features/agents/external-connection";
import { Header } from "../../shared/design-system/ui/Header";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { Button } from "../../shared/design-system/ui/Button";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";

/** The grant an open confirmation names, as it was when the dialog opened. */
type Confirming = Readonly<{ id: number; client: string; live: boolean }>;

export function ExternalConnectionSettings({
  connection,
}: {
  connection: ExternalApps;
}) {
  useLanguage();
  const state = useSyncExternalStore(connection.subscribe, connection.snapshot);
  // Takes focus when the Revoke button has gone but the row remains, which
  // happens when the app exits while the confirmation is open.
  const section = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const empty = useRef<HTMLParagraphElement>(null);
  const grant = state.grant;
  // Captured at open, it outlives the row, so the dialog closes only once
  // revoke settles and focus has somewhere to land.
  const [confirming, setConfirming] = useState<Confirming>();
  const [revoking, setRevoking] = useState(false);
  const id = grant?.id;
  // A fresh approval, under any name, can replace the grant while the dialog
  // is open. It was confirmed in its own consent dialog, not this one, so
  // this one closes rather than revoke it.
  useEffect(() => {
    if (confirming && !revoking && id !== confirming.id)
      setConfirming(undefined);
  }, [confirming, revoking, id]);
  const revoke = async () => {
    // The grant can also change between a render and the click.
    if (connection.snapshot().grant?.id !== confirming?.id) {
      setConfirming(undefined);
      return;
    }
    // Cleared first, so a repeated failure is announced again.
    connection.clearError();
    setRevoking(true);
    await connection.revoke();
    setRevoking(false);
    // A refused revoke reports through state.error and keeps the row.
    if (!connection.snapshot().grant) setConfirming(undefined);
  };
  // Shown inside the dialog while it is open, otherwise under the row.
  const error = state.error && (
    <p role="alert" className="m-0 text-body-sm text-danger">
      {state.error}
    </p>
  );
  return (
    <section ref={section} tabIndex={-1} aria-labelledby="external-apps-title">
      <Header
        id="external-apps-title"
        title={t("v1agent.external.title")}
        subtitle={t("v1agent.external.subtitle")}
      />
      <SettingsGroup layout="form">
        <p className="m-0 text-body-sm text-secondary">
          {t("v1agent.external.intro")}
        </p>
        {grant ? (
          <PreferenceRow
            title={grant.client}
            subtitle={
              state.pairing && !fullAgentAccess(state.pairing.approval.scopes)
                ? t("v1agent.external.limited")
                : grant.phase === "connected"
                  ? t("v1agent.external.connected")
                  : grant.phase === "waiting"
                    ? t("v1agent.external.waiting")
                    : grant.phase === "starting"
                      ? t("v1agent.external.authorizing")
                      : state.pairing
                        ? t("v1agent.external.approved")
                        : t("v1agent.external.ended")
            }
            trailing={
              state.pairing || grant.phase !== "ended" ? (
                <Button
                  ref={trigger}
                  variant="outline"
                  onClick={() => {
                    // An earlier error would otherwise read as a revoke failure.
                    connection.clearError();
                    setConfirming({
                      id: grant.id,
                      client: grant.client,
                      live: grant.phase !== "ended",
                    });
                  }}
                >
                  {t("v1agent.external.revoke")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          // Takes focus when a confirmed revoke unmounts the Revoke button.
          <p
            ref={empty}
            tabIndex={-1}
            role="status"
            className="m-0 text-body-sm text-secondary"
          >
            {t("v1agent.external.none")}
          </p>
        )}
        {!confirming && error}
      </SettingsGroup>
      {confirming && (
        <AlertDialog
          title={t("v1agent.external.revokeTitle", {
            client: confirming.client,
          })}
          description={
            confirming.live
              ? t("v1agent.external.revokeLive")
              : t("v1agent.external.revokeSaved")
          }
          pending={revoking}
          initialFocus={cancel}
          finalFocus={() =>
            trigger.current?.isConnected
              ? trigger.current
              : (empty.current ?? section.current)
          }
          onClose={() => setConfirming(undefined)}
          actions={
            <>
              <Button
                ref={cancel}
                disabled={revoking}
                onClick={() => setConfirming(undefined)}
              >
                {t("channelForms.cancel")}
              </Button>
              <Button
                variant="destructive"
                loading={revoking}
                onClick={() => void revoke()}
              >
                {t("v1agent.external.revoke")}
              </Button>
            </>
          }
        >
          {error}
        </AlertDialog>
      )}
    </section>
  );
}
