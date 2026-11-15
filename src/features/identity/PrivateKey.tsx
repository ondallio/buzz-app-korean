import { t, useLanguage } from "../../shared/i18n";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { Input } from "../../shared/design-system/ui/Input";
import { FieldButton } from "../../shared/design-system/ui/FieldButton";
import { InputGroup } from "../../shared/design-system/ui/InputGroup";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import {
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRoot,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import { CaretDownIcon } from "../../shared/design-system/icons";
import { ToastNotice } from "../../shared/design-system/ui/Toast";
import type { Identity } from "./service";
import { writeClipboardSecret } from "../../shared/clipboard";

// Mount only while Profile is active. Late native results must never repopulate a hidden key.
export function PrivateKey({
  identity,
  onInteraction,
  children,
  presentation = "default",
}: {
  identity: Identity;
  /** Called once the key was revealed or copied, e.g. to gate Sign out. */
  onInteraction?: () => void;
  presentation?: "default" | "magnetic";
  /** Place the existing field and controls without moving key access or state. */
  children?: (parts: {
    input: ReactNode;
    warning: ReactNode;
    actions: ReactNode;
    feedback: ReactNode;
  }) => ReactNode;
}) {
  useLanguage();
  const warningId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusReveal = useRef(false);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    | "v1id.privateKeyCopiedClipboard"
    | "identityMore.privateCopyFailed"
    | "identityMore.privateRevealFailed"
    | ""
  >("");
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  useLayoutEffect(() => {
    // A late reveal replaces the trigger after the menu already returned focus.
    if (
      secret &&
      focusReveal.current &&
      document.activeElement === document.body
    )
      fieldRef.current?.focus();
    focusReveal.current = false;
  }, [secret]);
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
    const blur = (event: FocusEvent) => {
      // Focus returning from a menu stays inside this document.
      if (
        event.relatedTarget instanceof Node &&
        document.contains(event.relatedTarget)
      )
        return;
      clear();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    return () => {
      generation.current++;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
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
        await writeClipboardSecret(value);
        if (current === generation.current)
          setMessage("v1id.privateKeyCopiedClipboard");
      } else {
        focusReveal.current =
          presentation === "magnetic" &&
          document.activeElement === triggerRef.current;
        setSecret(value);
      }
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
  const preventEdit = (event: SyntheticEvent) => event.preventDefault();
  const field = (
    <Input
      ref={fieldRef}
      id="identity-private-key"
      aria-label={t("identityMore.privateKeyLabel")}
      aria-describedby={warningId}
      readOnly={presentation !== "magnetic" || !secret}
      aria-readonly="true"
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      onBeforeInput={preventEdit}
      onPaste={preventEdit}
      onCut={preventEdit}
      onDrop={preventEdit}
      onValueChange={() => undefined}
      value={secret || "••••••••••••••••"}
      onFocus={(event) => {
        if (secret && presentation === "default") event.currentTarget.select();
      }}
    />
  );
  const input =
    presentation === "magnetic" ? (
      <MenuRoot>
        {!secret ? (
          <MenuTrigger
            render={
              <FieldButton
                ref={triggerRef}
                appearance="masked"
                prefix="nsec"
                aria-label={t("v1id.privateKeyActions")}
                aria-describedby={warningId}
              />
            }
          >
            <span aria-hidden="true">••••••••••••••••</span>
          </MenuTrigger>
        ) : (
          <InputGroup
            trailing={
              <MenuTrigger
                render={
                  <IconButton
                    ref={triggerRef}
                    type="button"
                    aria-label={t("v1id.privateKeyActions")}
                    icon={<CaretDownIcon aria-hidden="true" />}
                  />
                }
              />
            }
          >
            {field}
          </InputGroup>
        )}
        <MenuPopup
          align="end"
          size="compact"
          finalFocus={secret ? fieldRef : triggerRef}
        >
          <MenuGroup>
            <MenuGroupLabel>{t("v1id.privateKey")}</MenuGroupLabel>
            <MenuItem
              aria-label={t("identityMore.copyPrivateKey")}
              disabled={busy}
              onClick={() => void access(true)}
            >
              {t("settings.copy")}
            </MenuItem>
            <MenuItem
              aria-label={
                secret
                  ? t("identityMore.hidePrivateKey")
                  : t("identityMore.revealPrivateKey")
              }
              disabled={busy && !secret}
              onClick={() => (secret ? hide() : void access(false))}
            >
              {secret ? t("v1id.hide") : t("v1id.reveal")}
            </MenuItem>
            {busy && <MenuItem onClick={hide}>{t("settings.cancel")}</MenuItem>}
          </MenuGroup>
        </MenuPopup>
      </MenuRoot>
    ) : (
      field
    );
  const warning = (
    <p id={warningId} className="text-body-sm text-muted">
      {t("identityMore.privateWarning")}
    </p>
  );
  const actions =
    presentation === "magnetic" ? null : (
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          aria-label={
            secret
              ? t("identityMore.hidePrivateKey")
              : t("identityMore.revealPrivateKey")
          }
          disabled={busy && !secret}
          onClick={() => (secret ? hide() : void access(false))}
        >
          {secret
            ? t("identityMore.hidePrivateKey")
            : t("identityMore.revealPrivateKey")}
        </Button>
        <Button
          type="button"
          aria-label={t("identityMore.copyPrivateKey")}
          disabled={busy}
          onClick={() => void access(true)}
        >
          {t("identityMore.copyPrivateKey")}
        </Button>
        {busy && (
          <Button type="button" onClick={hide}>
            {t("settings.cancel")}
          </Button>
        )}
      </div>
    );
  const feedback = message ? (
    presentation === "magnetic" && !failed ? (
      <ToastNotice
        title={t("v1id.privateKeyCopied")}
        description={t("v1id.privateKeyCopiedHint")}
        tone="success"
        timeout={5000}
        onDismiss={() => setMessage("")}
      />
    ) : (
      <p role={failed ? "alert" : "status"}>{t(message)}</p>
    )
  ) : null;
  if (children) return children({ input, warning, actions, feedback });
  return (
    <div>
      <label
        className="mb-2 block text-label-sm"
        htmlFor="identity-private-key"
      >
        {t("identityMore.privateKeyLabel")}
      </label>
      {warning}
      {input}
      {actions}
      {feedback}
    </div>
  );
}
