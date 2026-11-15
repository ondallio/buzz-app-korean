import { t } from "../../shared/i18n";
import { formatPublicKey } from "../../shared/identity/public-key";
import { sortParticipantNames } from "../../features/identity-names/participant-order";

/** One label recipe for Activity rows and details; callers own profile reads. */
export function dmLabel(
  participants: readonly string[] | undefined,
  profiles: ReadonlyMap<string, { name?: string | undefined }>,
  resolve: (
    key: string,
    fallback: string,
    candidates?: readonly string[],
  ) => string,
  missing = t("inbox.notesSelf"),
) {
  if (!participants) return missing;
  if (!participants.length) return t("inbox.notesSelf");
  // Sort every name before bounding, so the shown three match other surfaces.
  const names = sortParticipantNames(
    participants.map((key) =>
      resolve(
        key,
        profiles.get(key)?.name ??
          formatPublicKey(key) ??
          t("v1shell.inbox.unknownPerson"),
        participants,
      ),
    ),
  );
  return (
    names.slice(0, 3).join(", ") +
    (names.length > 3 ? ` +${names.length - 3}` : "")
  );
}
