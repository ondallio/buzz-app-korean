import { useRef, useState } from "react";
import { ArrowsOutIcon } from "../../shared/design-system/icons";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { t, useLanguage } from "../../shared/i18n";
import { Chart } from "./Chart";

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
        aria-label={t("u275f01.chart.expand")}
        title={t("u275f01.chart.expand")}
        icon={<ArrowsOutIcon />}
        onClick={() => setOpen(true)}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("u275f01.chart.title")}
        size="expanded"
        closeLabel={t("u275f01.chart.close")}
        finalFocus={expand}
      >
        <Chart code={code} expanded />
      </Dialog>
    </>
  );
}
