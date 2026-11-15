import { t, useLanguage } from "../../shared/i18n";
import { decode } from "nostr-tools/nip19";
import { Button } from "../../shared/design-system/ui/Button";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { CaretRightIcon } from "../../shared/design-system/icons";
import { abbreviatedPublicKey } from "../../shared/identity/public-key";

/** Select the linked identity before entering its existing recovery flow. */
export function WelcomeBack({
  npub,
  email,
  profile,
  onDevice,
  onRestore,
  onImport,
  onSwitchAccount,
}: {
  npub: string;
  email?: string | undefined;
  /** The linked key is the one saved on this device. */
  onDevice: boolean;
  profile?: { name: string; picture: string } | undefined;
  onRestore?: (() => void) | undefined;
  onImport: () => void;
  onSwitchAccount: () => void;
}) {
  useLanguage();
  const name = profile?.name.trim();
  const title = name || t("identityMore.savedKey");
  const decoded = decode(npub);
  const label =
    decoded.type === "npub" ? abbreviatedPublicKey(decoded.data) : npub;
  return (
    <>
      <div>
        <h1
          id="welcome-title"
          tabIndex={-1}
          className="text-heading text-standard"
        >
          {name ? t("identityMore.welcomeBack") : t("identityMore.continueKey")}
        </h1>
        <p className="mt-2 text-body text-subtle">
          {onDevice
            ? name
              ? t("identityMore.continueProfileHelp")
              : t("identityMore.foundKey")
            : onRestore
              ? t("v1id.keyNotOnDeviceRestore")
              : t("v1id.keyNotOnDeviceImport")}
        </p>
        {email && (
          <p className="mt-2 break-words text-body-sm text-subtle">
            {t("identityMore.signedInAs", { email })}
          </p>
        )}
      </div>
      <div className="grid auto-rows-fr gap-2">
        <Button
          shape="control"
          size="row"
          aria-label={
            name
              ? t("identityMore.continueProfile", { name, key: String(label) })
              : t("identityMore.continueSaved", { key: String(label) })
          }
          data-return-focus={onRestore ? "restore" : "import"}
          onClick={onRestore ?? onImport}
        >
          <span className="flex w-full items-center gap-3 text-left">
            {(name || profile?.picture) && (
              <Avatar
                alt=""
                src={profile?.picture}
                fallback={name || ""}
                fallbackSurface="panel"
                size="large"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-label">{title}</span>
              <span
                className="block whitespace-nowrap text-body-sm text-subtle"
                title={npub}
              >
                {label}
              </span>
            </span>
            <CaretRightIcon size={20} aria-hidden="true" />
          </span>
        </Button>
        {onRestore && !onDevice && (
          // A backup may not hold the key: entering it needn't wait on a restore.
          <Button
            shape="control"
            size="row"
            data-return-focus="import"
            onClick={onImport}
          >
            <span className="flex w-full items-center gap-3 text-left">
              <span className="min-w-0 flex-1 text-label">
                Enter your private key
              </span>
              <CaretRightIcon size={20} aria-hidden="true" />
            </span>
          </Button>
        )}
        <Button shape="control" size="row" onClick={onSwitchAccount}>
          <span className="flex w-full items-center gap-3 text-left">
            <span className="min-w-0 flex-1 text-label">
              {t("identity.failure.otherAccount")}
            </span>
            <CaretRightIcon size={20} aria-hidden="true" />
          </span>
        </Button>
      </div>
    </>
  );
}
