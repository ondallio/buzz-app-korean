import {
  localMessage,
  localError,
  errorMessage,
  resolveMessage,
  type DisplayMessage,
} from "../shared/i18n/deferred-message";
import { t, useLanguage } from "../shared/i18n";
import { useEffect, useRef, useState } from "react";
import { npubEncode } from "nostr-tools/nip19";
import { prepareRemoteAgentAuthorization } from "../features/host/service";
import { writeClipboardText } from "../shared/clipboard";
import { Button } from "../shared/design-system/ui/Button";
import { AlertDialog } from "../shared/design-system/ui/AlertDialog";
import { Field } from "../shared/design-system/ui/Field";
import { InlineHeader } from "../shared/design-system/ui/Header";
import { Input } from "../shared/design-system/ui/Input";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Textarea } from "../shared/design-system/ui/Textarea";

/** Mounted with the viewer as its key, so a different owner gets a fresh form. */
export function ExternalIdentityAuthorization({ viewer }: { viewer: string }) {
  useLanguage();
  const [publicKey, setPublicKey] = useState("");
  const [proof, setProof] = useState("");
  const [error, setError] = useState<DisplayMessage>("");
  const [copyStatus, setCopyStatus] = useState<{
    proof: string;
    message: DisplayMessage;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const copyAttempt = useRef(0);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);

  function requestApproval() {
    if (operation.current) return;
    setProof("");
    setCopyStatus(null);
    const agent = publicKey.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(agent) || agent === viewer) {
      setError(localMessage("accessDialogs.invalidApplicationKey"));
      return;
    }
    setError("");
    setConfirmKey(agent);
  }

  async function authorize(agent: string) {
    if (operation.current) return;
    const attempt = new AbortController();
    operation.current = attempt;
    setConfirmKey(null);
    setPending(true);
    setError("");
    try {
      const tag = await prepareRemoteAgentAuthorization(agent, attempt.signal);
      if (attempt.signal.aborted) return;
      if (tag[1] !== viewer) throw localError("accessDialogs.identityChanged");
      setProof(JSON.stringify(tag));
    } catch (failure) {
      if (!attempt.signal.aborted)
        setError(
          failure instanceof Error
            ? errorMessage(failure)
            : localMessage("accessDialogs.authorizeFailed"),
        );
    } finally {
      if (!attempt.signal.aborted) {
        operation.current = null;
        setPending(false);
      }
    }
  }

  async function copy() {
    const attempt = ++copyAttempt.current;
    try {
      await writeClipboardText(proof);
      if (attempt === copyAttempt.current)
        setCopyStatus({
          proof,
          message: localMessage("accessDialogs.proofCopied"),
        });
    } catch {
      if (attempt === copyAttempt.current)
        setCopyStatus({
          proof,
          message: localMessage("accessDialogs.proofCopyFailed"),
        });
    }
  }

  return (
    <div className="mt-8">
      <InlineHeader
        title={t("accessDialogs.authorizeTitle")}
        subtitle={t("accessDialogs.authorizeDescription")}
      />
      <SettingsGroup layout="form">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            requestApproval();
          }}
        >
          <Field
            label={t("accessDialogs.applicationKey")}
            description={t("accessDialogs.applicationKeyDescription")}
            error={resolveMessage(error)}
          >
            <Input
              value={publicKey}
              readOnly={pending || confirmKey !== null}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onValueChange={(value) => {
                setPublicKey(value);
                setProof("");
                setError("");
                setCopyStatus(null);
              }}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="prominent"
              loading={pending}
              disabled={!publicKey.trim()}
            >
              {t(
                pending
                  ? "accessDialogs.authorizing"
                  : "accessDialogs.authorizeIdentity",
              )}
            </Button>
          </div>
          {proof && (
            <>
              <Field
                label={t("accessDialogs.proof")}
                description={t("accessDialogs.proofDescription")}
              >
                <Textarea variant="code" readOnly value={proof} rows={4} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void copy()}>
                  {t("accessDialogs.copyProof")}
                </Button>
              </div>
            </>
          )}
          {copyStatus?.proof === proof && (
            <p role="status" className="text-body-sm text-muted">
              {resolveMessage(copyStatus.message)}
            </p>
          )}
        </form>
      </SettingsGroup>
      {confirmKey && (
        <AlertDialog
          title={t("accessDialogs.authorizeConfirm")}
          description={t("accessDialogs.authorizeConfirmDescription")}
          initialFocus={cancelButton}
          onClose={() => setConfirmKey(null)}
          actions={
            <>
              <Button ref={cancelButton} onClick={() => setConfirmKey(null)}>
                {t("accessDialogs.cancel")}
              </Button>
              <Button
                variant="prominent"
                onClick={() => void authorize(confirmKey)}
              >
                {t("accessDialogs.authorizeKey")}
              </Button>
            </>
          }
        >
          <Field label={t("accessDialogs.applicationIdentity")}>
            <Textarea
              variant="code"
              readOnly
              value={npubEncode(confirmKey)}
              rows={2}
            />
          </Field>
        </AlertDialog>
      )}
    </div>
  );
}
