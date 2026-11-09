import { t, useLanguage } from "../../shared/i18n";
import { WarningCircleIcon } from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import type { OwnedCommunity } from "./builderlab-account";
import { WireframePanel } from "./Wireframe";

/** Recovery guidance and consequences before replacing a linked key.
 * The replacement is automatically backed up after linking. */
export function KeyLost({
  owned,
  onBack,
  onStartOver,
}: {
  /** The communities the old key owns; `undefined` when the list could not be loaded. */
  owned: readonly OwnedCommunity[] | undefined;
  onBack: () => void;
  onStartOver: () => void;
}) {
  useLanguage();
  return (
    <>
      <div>
        <h1
          id="welcome-title"
          tabIndex={-1}
          className="text-heading text-standard"
        >
          {t("identityMore.lostKeyTitle")}
        </h1>
        <p className="mt-2 text-body text-subtle">
          {t("identityMore.lostKeyHelp")}
        </p>
        <p className="mt-2 text-body text-subtle">
          {t("identityMore.startOverHelp")}
        </p>
      </div>
      {(owned === undefined || owned.length > 0) && (
        <WireframePanel>
          <h2 className="m-0 text-body text-subtle">
            {t("identityMore.ownedCommunities")}
          </h2>
          {owned === undefined ? (
            <p className="m-0 text-body text-standard">
              {t("identityMore.ownedLoadFailed")}
            </p>
          ) : (
            <ul
              aria-label={t("identityMore.ownedCommunities")}
              className="m-0 flex list-none flex-col gap-1 p-0"
            >
              {owned.map(({ host, url }) => (
                <li key={url} className="truncate text-label text-standard">
                  {host}
                </li>
              ))}
            </ul>
          )}
          <p className="m-0 text-body-sm text-subtle">
            {t("identityMore.joinedNotListed")}
          </p>
        </WireframePanel>
      )}
      {/* kgoose revokes an unlinked key: binding it again answers 409. */}
      <InlineHeader
        icon={<WarningCircleIcon size={16} aria-hidden="true" />}
        title={t("identityMore.oldKeyUnlinkable")}
        subtitle={t("identityMore.oldKeyUnlinkHelp")}
      />
      {/* Footer order: secondary first, primary last. */}
      <div data-onboarding-actions="">
        <Button size="lg" onClick={onBack}>
          {t("identityMore.goBack")}
        </Button>
        <Button size="lg" variant="destructive" onClick={onStartOver}>
          {t("identityMore.startOver")}
        </Button>
      </div>
    </>
  );
}
