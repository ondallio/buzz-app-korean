import { t, useLanguage } from "../../shared/i18n";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { Input } from "../../shared/design-system/ui/Input";
import type { Identity } from "./service";
import { writeClipboardText } from "../../shared/clipboard";

// Mount only while Profile is active. Late native results must never repopulate a hidden key.
export function PrivateKey({
  identity,
  onInteraction,
}: {
  identity: Identity;
  /** Called once the key was revealed or copied, e.g. to gate Sign out. */
  onInteraction?: () => void;
}) {
  useLanguage();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    | ""
    | "identityMore.privateCopied"
    | "identityMore.privateCopyFailed"
    | "identityMore.privateRevealFailed"
  >("");
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      setSecret("");
      setBusy(false);
      setMessage("");
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", clear);
    return () => {
      generation.current++;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", clear);
    };
  }, []);
  function hide() {
    generation.current++;
    setSecret("");
    setBusy(false);
    setMessage("");
  }
  async function access(copy: boolean) {
    const current = ++generation.current;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const value = secret || (await identity.exportKey());
      if (current !== generation.current) return;
      if (copy) {
        await writeClipboardText(value);
        if (current === generation.current)
          setMessage("identityMore.privateCopied");
      } else setSecret(value);
      if (current === generation.current) onInteraction?.();
    } catch {
      if (current === generation.current) {
        setFailed(true);
        setMessage(
          copy
            ? "identityMore.privateCopyFailed"
            : "identityMore.privateRevealFailed",
        );
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <div className="mt-6">
      <label
        className="mb-2 block text-label-sm"
        htmlFor="identity-private-key"
      >
        {t("identityMore.privateKeyLabel")}
      </label>
      <p className="text-body-sm text-muted">
        {t("identityMore.privateWarning")}
      </p>
      <Input
        id="identity-private-key"
        readOnly
        value={secret || "••••••••••••••••"}
        onFocus={(event) => {
          if (secret) event.currentTarget.select();
        }}
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={busy && !secret}
          onClick={() => (secret ? hide() : void access(false))}
        >
          {secret
            ? t("identityMore.hidePrivateKey")
            : t("identityMore.revealPrivateKey")}
        </Button>
        <Button type="button" disabled={busy} onClick={() => void access(true)}>
          {t("identityMore.copyPrivateKey")}
        </Button>
        {busy && (
          <Button type="button" onClick={hide}>
            {t("identity.cancel")}
          </Button>
        )}
      </div>
      {message && <p role={failed ? "alert" : "status"}>{t(message)}</p>}
    </div>
  );
}
