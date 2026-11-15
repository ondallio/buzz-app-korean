import { useRef, useState } from "react";
import { ArrowsOutIcon } from "../../shared/design-system/icons";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Chart } from "./Chart";
import { t, useLanguage } from "../../shared/i18n";

/** Opens a chart at full size. The host's copy button copies its fenced JSON. */
export function ChartExpand({ code }: { code: string }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const expand = useRef<HTMLButtonElement>(null);
  return (
    <>
      <IconButton
        hint="familiar"
        ref={expand}
        aria-label={t("v1wf.chart.expand")}
        title={t("v1wf.chart.expand")}
        icon={<ArrowsOutIcon />}
        onClick={() => setOpen(true)}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("v1wf.chart.title")}
        size="expanded"
        closeLabel={t("v1wf.chart.close")}
        finalFocus={expand}
      >
        <Chart code={code} expanded />
      </Dialog>
    </>
  );
}
