import { useState } from "react";
import { t, useLanguage } from "../../shared/i18n";
import { writeClipboardText } from "../../shared/clipboard";
import { CopyIcon } from "../../shared/design-system/icons/index";
import { Button } from "../../shared/design-system/ui/Button";
import { WireframePanel } from "./Wireframe";

/**
 * A full npub — never hex or an abbreviation — with Copy and inline copy
 * feedback, for first-run pages that render outside ToastProvider. The
 * Profile panel's public-key recipe.
 */
export function PublicKeyPanel({
  publicKey,
  heading,
}: {
  publicKey: string;
  heading?: string;
}) {
  useLanguage();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  return (
    <WireframePanel>
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-body text-subtle">
          {heading === undefined ? t("identity.publicKey.heading") : heading}
        </h2>
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("identity.publicKey.copyLabel")}
          onClick={() => {
            setCopyStatus("idle");
            writeClipboardText(publicKey).then(
              () => setCopyStatus("copied"),
              () => setCopyStatus("failed"),
            );
          }}
        >
          <CopyIcon size={16} aria-hidden="true" />
          {t("identity.publicKey.copy")}
        </Button>
      </div>
      <code className="block select-text break-all font-mono text-mono">
        {publicKey}
      </code>
      <p className="m-0 text-body-sm text-subtle">
        {t("identity.publicKey.description")}
      </p>
      <span role="status" className="text-body-sm text-subtle">
        {copyStatus === "copied"
          ? t("identity.publicKey.copied")
          : copyStatus === "failed"
            ? t("identity.publicKey.copyFailed")
            : ""}
      </span>
    </WireframePanel>
  );
}
