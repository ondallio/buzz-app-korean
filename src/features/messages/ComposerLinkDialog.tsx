import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { t, useLanguage } from "../../shared/i18n";
import { useId, useRef, useState, type RefObject } from "react";
import { Dialog, type DialogProps } from "../../shared/design-system/ui/Dialog";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import type { ComposerInputElement, ComposerLinkEdit } from "./composer-dom";
import { Combobox } from "../../shared/design-system/ui/Combobox";
import { composerLinkUrl } from "./composer-link";

export function ComposerLinkDialog({
  edit,
  input,
  finalFocus = input,
  disabled,
  close,
  destinations,
  limitLabel = "message",
}: {
  destinations?: readonly { label: string; href: string }[] | undefined;
  limitLabel?: string;
  edit: ComposerLinkEdit;
  input: RefObject<ComposerInputElement | null>;
  finalFocus?: DialogProps["finalFocus"];
  disabled: boolean;
  close(): void;
}) {
  useLanguage();
  const formId = useId();
  const textInput = useRef<HTMLInputElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(edit.text);
  const [url, setUrl] = useState(edit.href);
  const [error, setError] = useState<DisplayMessage>("");
  const save = () => {
    if (disabled) return;
    const href = composerLinkUrl(url);
    if (!href) {
      setError(localMessage("messages.link.invalidUrl"));
      return;
    }
    if (/[\r\n]/.test(text)) {
      setError(localMessage("messages.link.oneLine"));
      return;
    }
    if (!edit.save(text, href)) {
      setError(
        limitLabel === "document"
          ? localMessage("v106msg.composerLink.documentDraftChanged")
          : localMessage("messages.link.draftChanged"),
      );
      return;
    }
    close();
  };
  return (
    <Dialog
      size="compact"
      open
      dismissOnOutsideClick={false}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={edit.existing ? t("messages.link.edit") : t("messages.link.add")}
      initialFocus={edit.text ? urlInput : textInput}
      finalFocus={finalFocus}
      actions={
        <>
          {edit.existing && (
            <Button
              disabled={disabled}
              onClick={() => {
                if (edit.remove()) close();
                else setError(localMessage("messages.link.removeChanged"));
              }}
            >
              {t("messages.link.remove")}
            </Button>
          )}
          <Button onClick={close}>{t("messages.cancel")}</Button>
          <Button
            variant="prominent"
            type="submit"
            form={formId}
            disabled={disabled || !url.trim()}
          >
            {t("messages.save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          save();
        }}
      >
        {destinations && (
          <Combobox.Root<{ label: string; href: string }>
            items={[...destinations]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.href}
            onValueChange={(item) => {
              if (!item) return;
              setUrl(item.href);
              if (!text.trim()) setText(item.label);
              setError("");
            }}
          >
            <Combobox.Control
              label={t("v106msg.composerLink.destination")}
              triggerLabel={t("v106msg.composerLink.browse")}
              placeholder={t("v106msg.composerLink.search")}
            />
            <Combobox.Popup empty={t("v106msg.composerLink.noMatch")}>
              <Combobox.List>
                {(item) => (
                  <Combobox.Item key={item.href} value={item}>
                    {item.label}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Root>
        )}
        <Field label={t("messages.link.text")}>
          <Input
            ref={textInput}
            value={text}
            onValueChange={setText}
            disabled={disabled}
            autoComplete="off"
          />
        </Field>
        <Field
          label={t("messages.link.url")}
          error={resolveMessage(error) || undefined}
        >
          <Input
            ref={urlInput}
            value={url}
            onValueChange={(value) => {
              setUrl(value);
              setError("");
            }}
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </Field>
      </form>
    </Dialog>
  );
}
