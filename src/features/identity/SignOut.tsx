import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { t, useLanguage } from "../../shared/i18n";
import { useEffect, useState } from "react";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import { Checkbox } from "../../shared/design-system/ui/Checkbox";
import { Input } from "../../shared/design-system/ui/Input";
import { PrivateKey } from "./PrivateKey";
import type { Identity } from "./service";

export const WIPE_PHRASE = "erase all my data";

/** Confirm only after the key was revealed or copied and the user says they have it. */
export function signOutReady(state: {
  touched: boolean;
  haveKey: boolean;
  wipe: boolean;
  phrase: string;
}) {
  return (
    state.touched &&
    state.haveKey &&
    (!state.wipe || state.phrase.trim() === WIPE_PHRASE)
  );
}

/** Native refusals carry `{ message }`; anything else is a plain error. */
export function signOutFailure(reason: unknown) {
  if (
    typeof reason === "object" &&
    reason !== null &&
    "message" in reason &&
    typeof reason.message === "string"
  )
    return reason.message;
  return String(reason);
}

export function SignOutDialog({
  identity,
  onClose,
}: {
  identity: Identity;
  onClose(): void;
}) {
  useLanguage();
  const [touched, setTouched] = useState(false);
  const [haveKey, setHaveKey] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [removeAgents, setRemoveAgents] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Asked of the native side, which enforces it; wipe stays off until it answers.
  const [wipeRefusal, setWipeRefusal] = useState<DisplayMessage | null>();
  useEffect(() => {
    let current = true;
    identity
      .wipeRefusal()
      .catch(() => localMessage("accessDialogs.wipeCheckFailed"))
      .then((reason) => {
        if (current) setWipeRefusal(reason ?? null);
      });
    return () => {
      current = false;
    };
  }, [identity]);
  const ready = signOutReady({ touched, haveKey, wipe, phrase });
  async function confirm() {
    setPending(true);
    setError("");
    try {
      await identity.signOut({ wipe, removeAgents: wipe && removeAgents });
    } catch (reason) {
      setError(signOutFailure(reason));
      setPending(false);
    }
  }
  return (
    <AlertDialog
      title={t("accessDialogs.signOutTitle")}
      description={t("accessDialogs.signOutDescription")}
      onClose={onClose}
      pending={pending}
      actions={
        <>
          <Button type="button" disabled={pending} onClick={onClose}>
            {t("accessDialogs.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!ready || pending}
            onClick={() => void confirm()}
          >
            {t(wipe ? "accessDialogs.signOutErase" : "accessDialogs.signOut")}
          </Button>
        </>
      }
    >
      <PrivateKey identity={identity} onInteraction={() => setTouched(true)} />
      <div className="mt-6 flex flex-col gap-3">
        <Checkbox
          label={t("accessDialogs.haveKey")}
          checked={haveKey}
          disabled={!touched || pending}
          onCheckedChange={setHaveKey}
        />
        <Checkbox
          label={t("accessDialogs.alsoErase")}
          checked={wipe}
          disabled={pending || wipeRefusal !== null}
          onCheckedChange={(checked) => {
            setWipe(checked);
            if (!checked) {
              setRemoveAgents(false);
              setPhrase("");
            }
          }}
        />
        {wipeRefusal && (
          <p className="text-body-sm text-muted">
            {typeof wipeRefusal === "string"
              ? `${wipeRefusal}.`
              : resolveMessage(wipeRefusal)}
          </p>
        )}
        {wipe && (
          <>
            <Checkbox
              label={t("accessDialogs.removeAgents")}
              checked={removeAgents}
              disabled={pending}
              onCheckedChange={setRemoveAgents}
            />
            <label className="block text-label-sm" htmlFor="sign-out-phrase">
              {t("accessDialogs.confirmPhrase", { phrase: WIPE_PHRASE })}
            </label>
            <Input
              id="sign-out-phrase"
              autoComplete="off"
              value={phrase}
              disabled={pending}
              onChange={(event) => setPhrase(event.currentTarget.value)}
            />
            <p className="text-body-sm text-muted">
              {t(
                removeAgents
                  ? "accessDialogs.eraseDescription"
                  : "accessDialogs.eraseKeepAgentsDescription",
              )}
            </p>
          </>
        )}
        {!wipe && (
          <p className="text-body-sm text-muted">
            {t("accessDialogs.keepDataDescription")}
          </p>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </AlertDialog>
  );
}
