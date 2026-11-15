import { useRef, useState } from "react";
import { ArrowsOutIcon, CopyIcon } from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import { MermaidDiagram } from "./MermaidDiagram";
import { writeClipboardText } from "../../shared/clipboard";
import { t, useLanguage } from "../../shared/i18n";

/** Opens a complex diagram at full size, with its source a click away. */
export function MermaidExpand({ code }: { code: string }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const notify = useToastNotification();
  const expand = useRef<HTMLButtonElement>(null);
  return (
    <>
      <IconButton
        hint="familiar"
        ref={expand}
        aria-label={t("v1wf.mermaid.expand")}
        title={t("v1wf.mermaid.expand")}
        icon={<ArrowsOutIcon />}
        onClick={() => setOpen(true)}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("v1wf.mermaid.title")}
        size="expanded"
        closeLabel={t("v1wf.mermaid.close")}
        finalFocus={expand}
        leadingActions={
          <Button
            disabled={copying}
            onClick={() => {
              setCopying(true);
              void Promise.resolve()
                .then(() => writeClipboardText(code))
                .then(
                  () => notify(t("v1wf.mermaid.copied"), "success"),
                  () => notify(t("v1wf.mermaid.copyFailed"), "error"),
                )
                .finally(() => setCopying(false));
            }}
          >
            <CopyIcon size={16} aria-hidden="true" />
            {t("v1wf.mermaid.copy")}
          </Button>
        }
      >
        <MermaidDiagram code={code} expanded />
      </Dialog>
    </>
  );
}
