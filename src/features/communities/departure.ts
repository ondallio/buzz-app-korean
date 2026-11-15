import { t } from "../../shared/i18n";
import { requestLeave, type LeaveOutcome } from "./api";
import type { PurgeFailure } from "./device-state";
import type { Communities, Membership } from "./service";

export class CommunityDepartureError extends Error {
  constructor(
    readonly phase: "relay" | "device",
    readonly reason: unknown,
    readonly outcome?: LeaveOutcome,
  ) {
    super(reason instanceof Error ? reason.message : String(reason), {
      cause: reason,
    });
  }
}

export type DeviceRemovalResult = Readonly<{
  membership: Membership;
  wasSelected: boolean;
  residue: readonly PurgeFailure[];
}>;
export type CommunityLeaveResult = DeviceRemovalResult &
  Readonly<{ outcome: LeaveOutcome }>;

async function forgetCommunityOnDevice(
  communities: Communities,
  membership: Membership,
  purge: boolean,
): Promise<DeviceRemovalResult> {
  const wasSelected = communities.snapshot().selected === membership.id;
  const residue = await communities.leave(membership.id, { purge });
  return { membership, wasSelected, residue };
}

export async function removeCommunityFromDevice(
  communities: Communities,
  membership: Membership,
): Promise<DeviceRemovalResult> {
  try {
    return await forgetCommunityOnDevice(communities, membership, true);
  } catch (error) {
    throw new CommunityDepartureError("device", error);
  }
}

/** Publishes first. Local cleanup starts only after the relay has settled the
 * membership, reported it absent, or denied the viewer as banned. */
export async function leaveCommunity(
  communities: Communities,
  membership: Membership,
): Promise<CommunityLeaveResult> {
  const viewer = communities.snapshot().viewer;
  let outcome: LeaveOutcome;
  try {
    outcome = await requestLeave(membership.id);
  } catch (error) {
    throw new CommunityDepartureError("relay", error);
  }
  try {
    if (communities.snapshot().viewer !== viewer)
      throw new Error("Account changed before device cleanup");
    return {
      ...(await forgetCommunityOnDevice(
        communities,
        membership,
        // A banned viewer remains a relay member and may regain access later.
        outcome !== "access-revoked",
      )),
      outcome,
    };
  } catch (error) {
    throw new CommunityDepartureError("device", error, outcome);
  }
}

export type DepartureIntent = "leave" | "remove";
export type Departure =
  | (DeviceRemovalResult & Readonly<{ intent: "remove" }>)
  | (CommunityLeaveResult & Readonly<{ intent: "leave" }>);

/** Runs the chosen departure. Removal never contacts the relay, so it stays
 * available for a community whose relay can no longer be reached. */
export async function departCommunity(
  communities: Communities,
  membership: Membership,
  intent: DepartureIntent,
): Promise<Departure> {
  return intent === "remove"
    ? { intent, ...(await removeCommunityFromDevice(communities, membership)) }
    : { intent, ...(await leaveCommunity(communities, membership)) };
}

/** The notice for a finished departure and its toast tone. Removal only
 * follows a leave its relay never settled, which may still have applied, so
 * the notice cannot claim the membership is unchanged. */
export function departedText(
  name: string,
  departure: Departure,
): [string, "success" | "info"] {
  const residue = departure.residue.length > 0;
  if (departure.intent === "remove") {
    return [
      residue
        ? t("v1id.departure.removedUnconfirmedResidue", { name })
        : t("v1id.departure.removedUnconfirmed", { name }),
      "success",
    ];
  }
  return [
    leftCommunityText(name, departure.outcome, residue),
    departure.outcome === "left" ? "success" : "info",
  ];
}

/** Once the relay accepts a leave, a device persistence failure has different
 * recovery copy from a request it never settled. */
export function departureFailureText(
  name: string,
  intent: DepartureIntent,
  error: unknown,
) {
  const departure =
    error instanceof CommunityDepartureError ? error : undefined;
  if (intent === "remove")
    return deviceRemovalFailureText(name, departure?.reason ?? error);
  return departure?.phase === "device"
    ? leaveCleanupFailureText(name, departure.reason, departure.outcome)
    : leaveCommunityFailureText(name, departure?.reason ?? error);
}

export function removedFromDeviceText(name: string, residue: boolean) {
  return residue
    ? t("v1id.departure.removedResidue", { name })
    : t("v1id.departure.removed", { name });
}

/** What the relay settled, plus whether any saved data outlived the purge. */
export function leftCommunityText(
  name: string,
  outcome: LeaveOutcome,
  residue: boolean,
) {
  if (outcome === "already-absent")
    return residue
      ? t("v1id.departure.absentResidue", { name })
      : t("v1id.departure.absent", { name });
  if (outcome === "access-revoked")
    return residue
      ? t("v1id.departure.bannedResidue", { name })
      : t("v1id.departure.banned", { name });
  return residue
    ? t("v1id.departure.leftResidue", { name })
    : t("v1id.departure.left", { name });
}

export function deviceRemovalFailureText(name: string, error: unknown) {
  const reason =
    wordsOf(error instanceof Error ? error.cause : undefined) || wordsOf(error);
  return reason
    ? t("v1id.departure.removeFailedReason", {
        name,
        reason: reason.replace(/\.$/, ""),
      })
    : t("v1id.departure.removeFailed", { name });
}

/** The relay has answered; only the device record failed before it changed. */
export function leaveCleanupFailureText(
  name: string,
  error: unknown,
  outcome: LeaveOutcome = "left",
) {
  const reason = (
    wordsOf(error instanceof Error ? error.cause : undefined) || wordsOf(error)
  ).replace(/\.$/, "");
  if (outcome === "already-absent")
    return reason
      ? t("v1id.departure.absentCleanupFailedReason", { name, reason })
      : t("v1id.departure.absentCleanupFailed", { name });
  if (outcome === "access-revoked")
    return reason
      ? t("v1id.departure.bannedCleanupFailedReason", { name, reason })
      : t("v1id.departure.bannedCleanupFailed", { name });
  return reason
    ? t("v1id.departure.leftCleanupFailedReason", { name, reason })
    : t("v1id.departure.leftCleanupFailed", { name });
}

const OWNER_REFUSAL = "invalid: relay owner cannot leave";

/** A leave the relay never settled, other than refusing its owner: the
 * membership may stand, but the device can still forget the community. */
export function leaveUnsettled(error: unknown) {
  return (
    error instanceof CommunityDepartureError &&
    error.phase === "relay" &&
    error.message !== OWNER_REFUSAL
  );
}

export function leaveCommunityFailureText(name: string, error: unknown) {
  const reason = error instanceof Error ? error.message : "";
  if (reason === OWNER_REFUSAL)
    return t("v1id.departure.ownerCantLeave", { name });
  return t("v1id.departure.leaveFailed", { name });
}

const wordsOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";
