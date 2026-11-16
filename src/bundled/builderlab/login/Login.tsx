import { t, useLanguage } from "../../../shared/i18n";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ManagementFacts } from "../ManagementSection";
import { Header } from "../../../shared/design-system/ui/Header";
import { Button } from "../../../shared/design-system/ui/Button";
import { InfoIcon } from "../../../shared/design-system/icons";
import { brokerBuilderlab } from "../dev-session";
import { nativeBuilderlab, type BuilderlabSession } from "../session";

export function Login({
  session,
  available,
  active,
  showHeading = true,
  cancelOnUnmount = true,
  unavailableReason = t("builderlabLogin.desktopRequired"),
  openIdentity,
  notice = false,
}: {
  session: BuilderlabSession;
  available: boolean;
  active(): boolean;
  showHeading?: boolean;
  /** Settings owns its pending login; shared app panels only observe it. */
  cancelOnUnmount?: boolean;
  unavailableReason?: string;
  /** Opens Identity, where the shared provider account is managed. */
  openIdentity?: (() => void) | undefined;
  /** A small Settings hint without account fields; actions keep their owner. */
  notice?: boolean;
}) {
  useLanguage();
  const state = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
    session.snapshot,
  );
  useEffect(
    () => () => {
      if (cancelOnUnmount && session.snapshot().status === "pending")
        session.abandon();
    },
    [cancelOnUnmount, session],
  );
  // A successful FI retry replaces the focused sign-in button with the
  // Identity link; focus follows only if the button still had it.
  const action = useRef(false);
  const identityLink = useRef<HTMLButtonElement>(null);
  const showsIdentity = nativeBuilderlab() && state.status === "signed-in";
  const provider = session.providerName ?? "Builderlab";
  const actionBesideEmail =
    !showHeading && state.status === "signed-in" && !showsIdentity;
  useEffect(() => {
    if (!showsIdentity || !action.current) return;
    action.current = false;
    identityLink.current?.focus();
  }, [showsIdentity]);
  const intro =
    state.status === "signed-in"
      ? t(
          brokerBuilderlab()
            ? "builderlabLogin.brokerSignedIn"
            : "builderlabLogin.nativeSignedIn",
        )
      : t(
          brokerBuilderlab()
            ? "builderlabLogin.brokerSignedOut"
            : "builderlabLogin.nativeSignedOut",
        );
  const accountAction = showsIdentity ? (
    // The native session is shared with community sign-in, so it
    // ends only where that sign-in is managed.
    <p className="m-0 flex flex-wrap items-baseline gap-2 text-body-sm text-secondary">
      <span>{t("u275D.login.usesSignIn", { provider })}</span>
      {openIdentity ? (
        <Button
          ref={identityLink}
          variant="link"
          size="text"
          onClick={() => {
            if (active()) openIdentity();
          }}
        >
          {t("u275D.login.manageAccount")}
        </Button>
      ) : (
        t("u275D.login.manageInIdentity")
      )}
    </p>
  ) : (
    <Button
      variant={
        notice
          ? "link"
          : state.status === "signed-out"
            ? "prominent"
            : "outline"
      }
      size={notice ? "text" : "md"}
      loading={state.checking === true}
      ref={(node) => {
        if (!node) return;
        // React detaches the ref before removing the node.
        return () => {
          action.current = document.activeElement === node;
        };
      }}
      onClick={() => {
        if (!active()) return;
        if (state.status === "pending") session.cancel();
        else if (state.status === "signed-in") session.signOut();
        else void session.signIn();
      }}
    >
      {state.checking
        ? t("builderlabLogin.checkingAction")
        : state.status === "pending"
          ? t("accessDialogs.cancelSignIn")
          : state.status === "signed-in"
            ? t("accessDialogs.signOut")
            : t("u275D.login.signInWith", { provider })}
    </Button>
  );
  if (notice)
    return (
      <div className="flex flex-col items-start gap-2">
        <div
          role="note"
          className="flex items-center gap-2 text-body-sm text-secondary"
        >
          <InfoIcon size={16} className="shrink-0" aria-hidden="true" />
          {!available ? (
            <span role="status">{unavailableReason}</span>
          ) : showsIdentity ? (
            accountAction
          ) : (
            <span>
              {state.status === "signed-in" &&
                `${t("builderlabLogin.signedIn")} `}
              {accountAction}
            </span>
          )}
        </div>
        {available && state.status === "pending" && !state.checking && (
          <p role="status" className="m-0 text-body-sm text-secondary">
            {t("builderlabLogin.finishBrowser")}
          </p>
        )}
        {available && state.error && (
          <p role="alert" className="m-0 text-body-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
    );
  return (
    <div data-buzz-ui="" className="flex flex-col items-start gap-4">
      {showHeading ? (
        <Header title="Builderlab" subtitle={intro} />
      ) : state.status === "signed-in" ? (
        <ManagementFacts
          items={[
            {
              label: t("u275D.login.email"),
              value: state.account?.email || "—",
              action:
                available && actionBesideEmail ? accountAction : undefined,
            },
          ]}
        />
      ) : null}
      {!available ? (
        <p role="status" className="text-body-sm text-secondary">
          {unavailableReason}
        </p>
      ) : (
        <>
          {(showHeading || state.status !== "signed-in") && (
            <p role="status" className="text-body-sm text-secondary">
              {state.checking
                ? t("builderlabCreate.checking")
                : state.status === "pending"
                  ? t("builderlabLogin.finishBrowser")
                  : state.account
                    ? state.account.email
                      ? t("builderlabLogin.signedInEmail", {
                          email: state.account.email,
                        })
                      : t("builderlabLogin.signedIn")
                    : t("builderlabLogin.secureBrowser")}
            </p>
          )}
          {state.error && (
            <p role="alert" className="text-body-sm text-danger">
              {state.error}
            </p>
          )}
          {!actionBesideEmail && accountAction}
        </>
      )}
    </div>
  );
}
