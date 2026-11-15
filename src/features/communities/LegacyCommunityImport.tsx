import { t, useLanguage } from "../../shared/i18n";
import { useEffect, useRef, useState } from "react";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import { importLegacyCommunities } from "./legacy-communities";
import type { Communities } from "./service";

/** Old storage cannot distinguish a removed community from a new one. */
export function LegacyCommunityImport({
  communities,
}: {
  communities: Communities;
}) {
  useLanguage();
  const [request, setRequest] = useState<{
    origins: string[];
    resolve(approved: boolean): void;
  }>();
  const proceed = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let answer: ((approved: boolean) => void) | undefined;
    const dispose = importLegacyCommunities(
      communities,
      (origins) =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
          setRequest({ origins, resolve });
        }),
    );
    return () => {
      dispose();
      answer?.(false);
    };
  }, [communities]);
  if (!request) return null;
  const respond = (approved: boolean) => {
    setRequest(undefined);
    request.resolve(approved);
  };
  return (
    <AlertDialog
      title={t("v1id.legacyImportTitle")}
      description={t("v1id.legacyImportDescription")}
      initialFocus={proceed}
      onClose={() => respond(false)}
      actions={
        <>
          <Button type="button" onClick={() => respond(false)}>
            {t("v1id.skipImport")}
          </Button>
          <Button
            ref={proceed}
            type="button"
            variant="prominent"
            onClick={() => respond(true)}
          >
            {t("v1id.importCommunities")}
          </Button>
        </>
      }
    >
      <ul
        aria-label={t("v1id.communitiesToImport")}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The bounded list must support keyboard scrolling.
        tabIndex={0}
        className="max-h-48 overflow-y-auto break-words text-body-sm"
      >
        {request.origins.map((origin) => (
          <li key={origin}>{origin}</li>
        ))}
      </ul>
    </AlertDialog>
  );
}
