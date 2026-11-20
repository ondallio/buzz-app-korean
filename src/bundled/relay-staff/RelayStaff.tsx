import { useEffect, useMemo, useSyncExternalStore } from "react";
import { t, useLanguage, type TranslationKey } from "../../shared/i18n";
import { Button } from "../../shared/design-system/ui/Button";
import { Header } from "../../shared/design-system/ui/Header";
import {
  CheckCircleIcon,
  CircleNotchIcon,
  WarningCircleIcon,
} from "../../shared/design-system/icons";
import { Console, type Screen } from "./Console";
import { createSession, SessionProvider } from "./session";
import type { Access, Staff } from "./staff";

const HEADINGS = {
  reports: ["navigation.reports", "furs.subtitle.reports"],
  feedback: ["navigation.feedback", "furs.subtitle.feedback"],
  communities: ["navigation.communities", "furs.subtitle.communities"],
  staff: ["navigation.staff", "furs.subtitle.staff"],
} as const satisfies Record<Screen, readonly [TranslationKey, TranslationKey]>;

export function RelayStaff({
  staff,
  screen,
  active,
}: {
  staff: Staff;
  screen: Screen;
  active(): boolean;
}) {
  useLanguage();
  useSyncExternalStore(staff.subscribe, () => staff.visible());
  const contextKey = useSyncExternalStore(staff.subscribe, staff.contextKey);
  const context = staff.context();
  const access = useSyncExternalStore(staff.subscribe, () =>
    context ? staff.access(context) : null,
  );
  // Settings has usually probed already; this covers an entry opened without it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by identity, host and relay
  useEffect(() => {
    if (context && active()) void staff.probe(context);
  }, [staff, contextKey]);

  if (!context) return null;
  return (
    <div className="flex flex-col gap-4">
      <Header
        title={t(HEADINGS[screen][0])}
        subtitle={t(HEADINGS[screen][1], {
          host: new URL(context.origin).host,
        })}
        actions={
          <Button
            size="sm"
            loading={access?.state === "probing"}
            onClick={() => void staff.probe(context, true)}
          >
            {t("furs.checkAgain")}
          </Button>
        }
      />
      <AccessStatus access={access} />
      {access?.state === "authorized" && (
        <Authorized
          key={contextKey}
          staff={staff}
          screen={screen}
          access={access}
        />
      )}
    </div>
  );
}

function Authorized({
  staff,
  screen,
  access,
}: {
  staff: Staff;
  screen: Screen;
  access: Extract<Access, { state: "authorized" }>;
}) {
  const context = staff.context();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the panel is keyed by identity, host and relay; only the role changes here
  const session = useMemo(
    () => context && createSession(staff, context, access.probe),
    [staff, access.probe],
  );
  if (!session) return null;
  return (
    <SessionProvider value={session}>
      <Console screen={screen} />
    </SessionProvider>
  );
}

function AccessStatus({ access }: { access: Access | null }) {
  useLanguage();
  if (access?.state !== "authorized")
    return (
      <p className="flex items-center gap-2 text-body-sm text-secondary">
        <CircleNotchIcon className="animate-spin" /> {t("furs.checkingAccess")}
      </p>
    );
  const { role, authMode } = access.probe;
  if (authMode === "disabled")
    return (
      <p
        className="flex items-center gap-2 text-body-sm text-warning"
        role="status"
      >
        <WarningCircleIcon /> {t("furs.authDisabled")}
      </p>
    );
  return (
    <p
      className="flex items-center gap-2 text-body-sm text-success"
      role="status"
    >
      <CheckCircleIcon />{" "}
      {t("furs.connectedAs", {
        role:
          role === "operator"
            ? t("adminStaff.role.operator")
            : role === "moderator"
              ? t("adminStaff.role.moderator")
              : (role ?? t("furs.staffRole")),
      })}
    </p>
  );
}
