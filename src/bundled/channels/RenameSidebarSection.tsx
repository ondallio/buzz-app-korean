import { useId, useState, type RefObject } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Input } from "../../shared/design-system/ui/Input";
import { t, useLanguage } from "../../shared/i18n";

/** Mounted after the launching menu closes, so focus has one modal owner. */
export function RenameSidebarSection({
  title,
  rename,
  close,
  finalFocus,
}: {
  title: string;
  rename: (name: string) => unknown;
  close: () => void;
  finalFocus: RefObject<HTMLButtonElement | null>;
}) {
  useLanguage();
  const formId = useId();
  const [name, setName] = useState(title);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const next = name.trim();
  const submit = async () => {
    if (pending || !next) return;
    if (next === title) return close();
    setPending(true);
    setError("");
    try {
      await rename(next);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      size="compact"
      dismissOnOutsideClick
      open
      onOpenChange={(open) => !open && close()}
      preventClose={pending}
      title={t("sidebarSectionDialogs.renameTitle")}
      headerGap="compact"
      finalFocus={finalFocus}
      actions={
        <>
          <Button disabled={pending} onClick={close}>
            {t("channelForms.cancel")}
          </Button>
          <Button
            form={formId}
            type="submit"
            variant="prominent"
            loading={pending}
            disabled={!next}
          >
            {t("channelsMenus.solo.rename")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          autoFocus
          aria-label={t("sidebarSectionDialogs.name")}
          placeholder={t("sidebarSectionDialogs.name")}
          required
          maxLength={256}
          disabled={pending}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
        />
      </form>
      {error && <p role="alert">{error}</p>}
      {pending && (
        <p role="status" className="sr-only">
          {t("sidebarSectionDialogs.renaming")}
        </p>
      )}
    </Dialog>
  );
}
