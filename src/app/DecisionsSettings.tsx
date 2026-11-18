import { t, useLanguage } from "../shared/i18n";
import { rich } from "../shared/i18n/rich";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_DECISION_PROVIDER,
  DEFAULT_DECISION_PROVIDERS,
  statusOf,
  type DecisionsService,
} from "../features/decisions/service";
import { SettingsSectionLink } from "../features/navigation/SettingsSectionLink";
import { OwnedContribution } from "../plugins/OwnedContribution";
import typesafeMark from "../shared/assets/typesafe-mark.png";
import {
  BuilderlabLogoIcon,
  WarningCircleIcon,
} from "../shared/design-system/icons";
import { Dialog } from "../shared/design-system/ui/Dialog";
import { Button } from "../shared/design-system/ui/Button";
import { Field } from "../shared/design-system/ui/Field";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";
import { Radio, RadioGroup } from "../shared/design-system/ui/RadioGroup";

import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Select } from "../shared/design-system/ui/Select";

/** Chooses the provider that answers decisions on this device and shows the
 * selected provider's own settings. Providers are plugins. One picked before
 * it is ready shows its settings, but the choice is saved only once it is
 * ready, so a working provider keeps answering until then. The choice is
 * hidden only when one provider is registered and already answering when
 * Settings opens. */
export function DecisionsSettings({
  decisions,
  active,
  onSection,
}: {
  decisions: Pick<
    DecisionsService,
    "backend" | "subscribe" | "setBackend" | "providers"
  >;
  active(): boolean;
  onSection?: ((section: string) => void) | undefined;
}) {
  useLanguage();
  const backend = useSyncExternalStore(
    decisions.subscribe,
    decisions.backend,
    decisions.backend,
  );
  const providers = useSyncExternalStore(
    decisions.subscribe,
    decisions.providers,
    decisions.providers,
  );
  const [picked, setPicked] = useState<string>();
  const pending = providers.find((provider) => provider.key === picked);
  // Re-read on every change: a provider's status is its own.
  const pendingReady = useSyncExternalStore(
    decisions.subscribe,
    () => pending !== undefined && statusOf(pending) === "ready",
    () => false,
  );
  useEffect(() => {
    if (!pending || !pendingReady) return;
    setPicked(undefined);
    decisions.setBackend(pending.key);
  }, [pending, pendingReady, decisions]);
  const selected = pending && pending.key !== backend ? pending : undefined;
  const current = providers.find((provider) => provider.key === backend);
  const builderlab = providers.find(
    (p) => p.key === DEFAULT_DECISION_PROVIDERS[0],
  );
  const ownKey = providers.find((p) => p.key === DEFAULT_DECISION_PROVIDER);
  const combined = !!builderlab && !!ownKey && providers.length === 2;
  const builderlabStatus = useSyncExternalStore(
    decisions.subscribe,
    () =>
      combined && current?.key === builderlab.key
        ? statusOf(builderlab)
        : undefined,
    () => undefined,
  );
  const shown = combined ? current : (selected ?? current);
  const choose = (value: string) => {
    if (!active()) return;
    const next = providers.find((provider) => provider.key === value);
    if (!next) return;
    if (statusOf(next) === "ready" || next.key === backend) {
      setPicked(undefined);
      decisions.setBackend(next.key);
    } else setPicked(next.key);
  };
  // With no provider answering, even a lone one must be choosable: decisions
  // never move to a provider the user did not choose. Once offered, the choice
  // stays for this visit, so choosing does not remove the focused control.
  const [offered, setOffered] = useState(false);
  const needsChoice = providers.length > 1 || backend === undefined;
  if (needsChoice && !offered) setOffered(true);
  const choosable = needsChoice || (offered && providers.length > 0);
  // A provider can go away while its controls have focus, for example when
  // a sign-out removes Builderlab. The service notifies before React
  // re-renders, so the old controls are still in the page: note whether
  // focus is in this section, then hand it to the selected provider's radio,
  // or the section itself, if the update dropped it.
  const section = useRef<HTMLElement>(null);
  const setupForm = useRef<HTMLDivElement>(null);
  const hadFocus = useRef(false);
  useEffect(
    () =>
      decisions.subscribe(() => {
        hadFocus.current ||= !!section.current?.contains(
          document.activeElement,
        );
      }),
    [decisions],
  );
  useLayoutEffect(() => {
    if (!hadFocus.current) return;
    hadFocus.current = false;
    const element = section.current;
    const focused = document.activeElement;
    if (
      !element ||
      (focused && focused !== document.body && focused.isConnected)
    )
      return;
    const radio = element.querySelector<HTMLElement>(
      '[role="radio"][aria-checked="true"]',
    );
    (radio ?? element).focus({ preventScroll: true });
  });
  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-labelledby="decisions-settings-title"
    >
      <Header
        id="decisions-settings-title"
        title={t("settingsHost.decisionsTitle")}
        subtitle={rich("v1id.decisionsSubtitle", {
          agents: <strong>{t("v1id.decisionsAgents")}</strong>,
          plugins: <strong>{t("v1id.decisionsPlugins")}</strong>,
          attention: <strong>{t("v1id.decisionsAttention")}</strong>,
        })}
      />
      {providers.length === 0 ? (
        <p role="status" className="mt-4 text-body-sm text-secondary">
          {rich("settingsHost.noDecisionsProvider", {
            plugins: (
              <SettingsSectionLink section="plugins" open={onSection}>
                {t("settingsHost.managePlugins")}
              </SettingsSectionLink>
            ),
          })}
        </p>
      ) : (
        <div
          data-buzz-ui=""
          className="mt-section-gap flex flex-col items-start gap-section-gap"
        >
          {choosable && !combined && (
            <div className="w-full max-w-md">
              <InlineHeader title={t("settingsHost.decisionsProvider")} />
              <Field
                label={t("settingsHost.decisionsProvider")}
                labelVisibility="hidden"
                nativeLabel={false}
              >
                <RadioGroup
                  aria-label={t("settingsHost.decisionsProvider")}
                  value={shown?.key ?? ""}
                  onValueChange={choose}
                >
                  {providers.map((provider) => (
                    <Radio
                      key={provider.key}
                      value={provider.key}
                      variant="card"
                      label={provider.label}
                      description={provider.description}
                    />
                  ))}
                </RadioGroup>
              </Field>
            </div>
          )}
          {combined && (
            <div className="w-full">
              <SettingsGroup>
                <Select
                  label={t("v1id.decisionProvider")}
                  leading={
                    shown?.key === builderlab.key ? (
                      <BuilderlabLogoIcon size={20} aria-hidden="true" />
                    ) : (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 20,
                          height: 20,
                          display: "inline-block",
                          backgroundColor: "currentColor",
                          maskImage: `url(${typesafeMark})`,
                          maskSize: "contain",
                          maskPosition: "center",
                          maskRepeat: "no-repeat",
                        }}
                      />
                    )
                  }
                  valueSuffix={
                    shown?.key === builderlab.key &&
                    builderlabStatus === "needs-setup" ? (
                      <WarningCircleIcon
                        size={16}
                        className="ml-2 text-danger"
                        aria-label={t("v1id.unavailableForAccount")}
                      />
                    ) : undefined
                  }
                  variant="preference"
                  value={shown?.key ?? ""}
                  disabled={!active()}
                  onValueChange={choose}
                  groups={[
                    {
                      label: "Providers",
                      options: [
                        {
                          value: builderlab.key,
                          label: "Builderlab",
                          description:
                            builderlabStatus === "needs-setup"
                              ? t("v1id.unavailableForAccount")
                              : undefined,
                          leading:
                            builderlabStatus === "needs-setup" ? (
                              <WarningCircleIcon
                                size={20}
                                className="text-danger"
                                aria-hidden="true"
                              />
                            ) : (
                              <BuilderlabLogoIcon
                                size={20}
                                aria-hidden="true"
                              />
                            ),
                        },
                        {
                          value: ownKey.key,
                          label: "TypeSafe",
                          leading: (
                            <span
                              aria-hidden="true"
                              style={{
                                width: 20,
                                height: 20,
                                display: "inline-block",
                                backgroundColor: "currentColor",
                                maskImage: `url(${typesafeMark})`,
                                maskSize: "contain",
                                maskPosition: "center",
                                maskRepeat: "no-repeat",
                              }}
                            />
                          ),
                        },
                      ],
                    },
                  ]}
                />
                {shown?.key === builderlab.key &&
                  builderlabStatus === "needs-setup" && (
                    <p
                      role="status"
                      className="m-0 py-4 text-body-sm text-secondary"
                    >
                      Decisions API isn’t available for this Builderlab account.
                      Use your own TypeSafe key or contact your account
                      administrator.
                    </p>
                  )}
                {shown?.key === ownKey.key && shown.Settings && (
                  <div className="grid gap-4 py-4">
                    <OwnedContribution
                      entry={shown}
                      registry={{ snapshot: decisions.providers }}
                      fallback={
                        <p role="alert">{t("v1id.typesafeUnavailable")}</p>
                      }
                    >
                      {(entry, owned) => {
                        const Settings = entry.Settings;
                        return (
                          Settings && (
                            <Settings
                              active={() => active() && owned()}
                              grouped={false}
                            />
                          )
                        );
                      }}
                    </OwnedContribution>
                  </div>
                )}
              </SettingsGroup>
            </div>
          )}
          {shown && !combined && (
            <div className="w-full">
              {shown.showSettingsHeading !== false && (
                <InlineHeader title={shown.label} />
              )}
              {shown.Settings && (
                // A provider's settings are plugin code: if they fail, only
                // this part does, and Manage plugins can turn it off.
                <OwnedContribution
                  entry={shown}
                  registry={{ snapshot: decisions.providers }}
                  fallback={
                    <p role="alert" className="text-body-sm text-secondary">
                      {rich("settingsHost.providerSettingsUnavailable", {
                        provider: shown.label,
                        plugins: (
                          <SettingsSectionLink
                            section="plugins"
                            open={onSection}
                          >
                            {t("settingsHost.managePlugins")}
                          </SettingsSectionLink>
                        ),
                      })}
                    </p>
                  }
                >
                  {(entry, owned) => {
                    const Settings = entry.Settings;
                    return (
                      Settings && (
                        <Settings active={() => active() && owned()} />
                      )
                    );
                  }}
                </OwnedContribution>
              )}
            </div>
          )}
        </div>
      )}
      {combined && selected?.Settings && (
        <Dialog
          open
          visit
          title={
            selected.key === ownKey.key
              ? t("v1id.connectTypesafe")
              : t("v1id.setUpBuilderlab")
          }
          description={
            selected.key === ownKey.key ? (
              <>
                Create an API key at{" "}
                <Button
                  variant="link"
                  size="text"
                  nativeButton={false}
                  role="link"
                  render={
                    <a
                      href="https://console.typesafe.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  console.typesafe.ai
                </Button>{" "}
                and paste it below.
              </>
            ) : (
              t("v1id.completeBuilderlabSetup")
            )
          }
          dismissOnOutsideClick
          onOpenChange={(open) => !open && setPicked(undefined)}
          initialFocus={
            selected.key === ownKey.key
              ? () =>
                  setupForm.current?.querySelector<HTMLInputElement>(
                    "input:not([readonly])",
                  ) ?? null
              : undefined
          }
          finalFocus={() =>
            section.current?.querySelector<HTMLElement>('[role="combobox"]') ??
            section.current
          }
        >
          <div ref={setupForm}>
            <OwnedContribution
              entry={selected}
              registry={{ snapshot: decisions.providers }}
              fallback={<p role="alert">{t("v1id.typesafeUnavailable")}</p>}
            >
              {(entry, owned) => {
                const Settings = entry.Settings;
                return (
                  Settings && (
                    <Settings
                      active={() => active() && owned()}
                      grouped={false}
                    />
                  )
                );
              }}
            </OwnedContribution>
          </div>
        </Dialog>
      )}
    </section>
  );
}
