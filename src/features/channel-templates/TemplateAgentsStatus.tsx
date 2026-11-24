import { t, useLanguage } from "../../shared/i18n";
import { useState } from "react";
import { Button } from "../../shared/design-system/ui/Button";
import type { useTemplateAgents } from "./useTemplateAgents";

/** Why a template's save waits on its agents, with a retry once a read fails. */
export function TemplateAgentsStatus({
  setup,
}: {
  setup: ReturnType<typeof useTemplateAgents>;
}) {
  useLanguage();
  const [retrying, setRetrying] = useState(false);
  if (!setup.pending) return null;
  if (setup.checking && !retrying)
    return (
      <p role="status" className="text-secondary">
        {t("v106ch.template.checkingAgents")}
      </p>
    );
  return (
    <div role="alert" className="flex items-center gap-2 text-secondary">
      <span>{t("v106ch.template.agentsCheckFailed")}</span>
      <Button
        variant="ghost"
        loading={retrying}
        onClick={() => {
          setRetrying(true);
          void setup.retry().finally(() => setRetrying(false));
        }}
      >
        {t("channelForms.retry")}
      </Button>
    </div>
  );
}
