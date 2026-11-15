import { t, useLanguage } from "../../shared/i18n";
import { useState } from "react";
import {
  CommunityAddressField,
  useCommunityAddress,
} from "../../bundled/builderlab/communities/CommunityAddress";
import { Button } from "../../shared/design-system/ui/Button";
import type { FirstRunAccount } from "./builderlab-account";
import { OnboardingBack } from "./OnboardingBack";
import { WireframePanel } from "./Wireframe";

/**
 * First run's Create a community, offered from Join a community: the address
 * field and availability check of the Builderlab communities section, then
 * its create. `onCreated` receives the new community's origin, which joins as
 * an entered address does; `quotaLimit` words a limit refusal.
 */
export function CreateCommunityStep({
  account,
  quotaLimit,
  onCreated,
  onBack,
}: {
  account: Pick<FirstRunAccount, "communityAvailable" | "createCommunity">;
  quotaLimit?: number | undefined;
  onCreated: (origin: string) => void;
  onBack: () => void;
}) {
  useLanguage();
  const address = useCommunityAddress(account.communityAvailable, true);
  const [busy, setBusy] = useState(false);
  // A refusal belongs to the name it refused, so editing the name clears it;
  // until then it replaces "available" and Create waits for a new name.
  const [error, setError] = useState<{ name: string; message: string }>();
  const refusal = error?.name === address.name ? error.message : "";
  return (
    <form
      className="flex flex-1 flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!address.ready || refusal || busy) return;
        const { name } = address;
        setBusy(true);
        setError(undefined);
        account.createCommunity(name, quotaLimit).then(onCreated, (reason) => {
          setError({
            name,
            message: reason instanceof Error ? reason.message : String(reason),
          });
          setBusy(false);
        });
      }}
    >
      <div>
        <h1
          id="welcome-title"
          tabIndex={-1}
          className="text-heading text-standard"
        >
          {t("identityMore.createTitle")}
        </h1>
        <p className="mt-2 text-body text-subtle">
          {t("identityMore.createHelp")}
        </p>
      </div>
      <WireframePanel>
        <CommunityAddressField
          address={address}
          busy={busy}
          refusal={refusal}
        />
      </WireframePanel>
      {/* Footer order: secondary first, primary last. */}
      <div data-onboarding-actions="">
        <OnboardingBack onClick={onBack} disabled={busy} />
        <Button
          type="submit"
          size="lg"
          variant="prominent"
          loading={busy}
          disabled={!address.ready || Boolean(refusal)}
        >
          {t("identityMore.createAction")}
        </Button>
      </div>
    </form>
  );
}
