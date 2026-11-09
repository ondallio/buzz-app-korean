import { t, useLanguage } from "../../shared/i18n";
import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { useProfileGeneration } from "../../features/relay/react";
import { TeamMentionAvatars } from "./TeamMentionAvatars";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPopup,
} from "../../shared/design-system/ui/Popover";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import { SearchField } from "../../shared/design-system/ui/SearchField";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { AvatarStack } from "../../shared/design-system/ui/AvatarStack";
import {
  AtIcon,
  CaretDownIcon,
  CheckIcon,
  RobotIcon,
} from "../../shared/design-system/icons/index";
import { useEffect, useId, useRef, useState } from "react";
import { useTeamMentions } from "./use-team-mentions";
import { useMentionChoices } from "./use-mention-choices";
import type { ComposerSession } from "../../features/messages/composer-session";
import {
  managedByDetail,
  outsideMentionDetail,
  remoteMentionDetail,
} from "./mention-candidates";
import { matchPerson } from "../../features/search/person-match";
import { MatchedLabel } from "../../features/search/MatchedLabel";
import { useSearchHighlight } from "../../features/search/use-search-highlight";
import "../../shared/design-system/styles/scrollbars.css";
import styles from "./Mentions.module.css";

import type { ComposerToolProps } from "../../features/conversation/contracts";
import { avatarMedia } from "../../shared/avatar-source";

// Only canonical strings produced by the bundled mention helpers enter this map.
const mentionTextKeys = {
  "Channel membership changed. Reopen to review adding this recipient.":
    "mentionPicker.changedRecipient",
  Archived: "mentionPicker.archived",
  "No longer available. Change your search to refresh choices.":
    "mentionPicker.unavailableRecipient",
  "Team changed or unavailable. Reopen to refresh.":
    "mentionPicker.changedTeam",
  "Channel membership changed. Reopen to review adding this team.":
    "mentionPicker.changedTeamMembership",
  "This team has no agents.": "mentionPicker.emptyTeam",
  "Teams can mention at most 32 agents.": "mentionPicker.teamLimit",
  "A team member is unavailable. Edit the team or refresh choices.":
    "mentionPicker.unavailableTeamMember",
  "Loading legacy teams…": "mentionPicker.loadingLegacyTeams",
  "Could not load legacy teams. Retry to refresh.":
    "mentionPicker.legacyTeamsFailed",
  "Could not search community people. Retry to refresh.":
    "mentionPicker.communityPeopleFailed",
  Remote: "mentionPicker.remote",
  "Not in DM · Will not be notified": "mentionPicker.outsideDm",
  "Not in channel": "mentionPicker.outsideChannel",
} as const;
function knownMentionText(source: string | undefined): string | undefined {
  const key = Object.entries(mentionTextKeys).find(
    ([message]) => message === source,
  )?.[1];
  return key ? t(key) : source;
}
function teamCaption(
  team: ReturnType<typeof useTeamMentions>["choices"][number],
): string {
  if (team.disabled) return knownMentionText(team.detail) ?? team.detail;
  const display = team.presentation;
  if (!display) return team.detail;
  if (!display.outside)
    return t("mentionPicker.savedTeam", { count: display.count });
  return t(
    display.destination === "dm"
      ? "mentionPicker.teamOutsideDm"
      : display.destination === "channel"
        ? "mentionPicker.teamAddsChannel"
        : display.destination === "chat"
          ? "mentionPicker.teamAddsChat"
          : "mentionPicker.teamOutsideChannel",
    { count: display.count, outside: display.outside },
  );
}

/** Select identities from the shared relay roster, never from display-name matching. */
export function MentionPicker({
  session,
  channelId,
  disabled,
  inviteAgents,
  audience,
  select,
  selectTeam,
  focusDraft,
}: {
  session: ComposerSession;
  scope: string;
  channelId: string;
  disabled: boolean;
  inviteAgents?: boolean | undefined;
  audience?: ComposerToolProps["audience"];
  select: ComposerToolProps["insertMention"];
  selectTeam?: ComposerToolProps["insertMentions"];
  /** Return typing to the draft when the agent menu closes. */
  focusDraft?: ComposerToolProps["focus"];
}) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<DisplayMessage>();
  const trigger = useRef<HTMLButtonElement>(null);
  const controls = useRef<HTMLFieldSetElement>(null);
  const accepted = useRef(false);
  // How the agent menu last closed: undefined while open.
  const closedBy = useRef<"outside" | "inside">(undefined);
  const searchInput = useRef<HTMLElement>(null);
  // The picker stays mounted while closed; each opening is its own lifetime.
  const [opening, setOpening] = useState(0);
  const lifetime = `picker:${useId()}:${opening}`;
  const model = useMentionChoices(
    session,
    channelId,
    inviteAgents,
    search,
    lifetime,
    open && !disabled,
  );
  const {
    profiles,
    agents,
    list,
    channel,
    roster: draftRoster,
    choices: candidates,
  } = model;
  const teams = useTeamMentions(
    session,
    channelId,
    inviteAgents,
    search,
    model,
    open && !disabled && !!selectTeam,
  );
  const parentAdmission = !!channel && channel.channelType !== "solo";
  const members =
    draftRoster?.map((person) => person.pubkey) ?? channel?.members;
  // Only an open chooser demands names; typing must not join every member.
  const memberKey = open && !draftRoster ? (members?.join(":") ?? "") : "";
  const profileGeneration = useProfileGeneration(session.profiles);
  useEffect(() => {
    void profileGeneration;
    if (draftRoster || !open || !memberKey) return;
    let current = true;
    void session.profiles
      .ensure(memberKey.split(":"), "background")
      .catch(() => {
        if (current) setError(localMessage("mentionPicker.namesUnavailable"));
      });
    return () => {
      current = false;
    };
  }, [session, open, memberKey, draftRoster, profileGeneration]);
  const chooseRecipient = (
    recipient: (typeof candidates)[number]["recipient"],
  ) => {
    if (!model.canSelect(recipient.pubkey)) return;
    // Alone with agents: a pick adds or removes that agent, never the last,
    // and the menu stays open for more.
    if (audience) {
      audience.toggle(recipient);
      return;
    }
    if (select(recipient)) {
      accepted.current = true;
      setOpen(false);
    }
  };
  const chooseTeam = (team: (typeof teams.choices)[number]) => {
    if (audience) {
      if (!team.canSelect() || !team.recipients.length) return;
      audience.only(team.recipients);
      accepted.current = true;
      setOpen(false);
      return;
    }
    if (team.canSelect() && selectTeam?.(team.recipients)) {
      accepted.current = true;
      setOpen(false);
    }
  };
  const personKey = (pubkey: string) => `person:${pubkey}`;
  const teamKey = (id: string) => `team:${id}`;
  // Order stays rankMentions', shared with inline @ completion and mobile.
  // The highlight skips rows that cannot be chosen, as the arrow keys did.
  const highlight = useSearchHighlight({
    query: search,
    keys: disabled
      ? []
      : [
          ...candidates
            .filter((choice) => !choice.disabled)
            .map((choice) => personKey(choice.recipient.pubkey)),
          ...teams.choices
            .filter((team) => !team.disabled)
            .map((team) => teamKey(team.id)),
        ],
    onChoose: (key) => {
      const person = candidates.find(
        (choice) => personKey(choice.recipient.pubkey) === key,
      );
      if (person) return chooseRecipient(person.recipient);
      const team = teams.choices.find((choice) => teamKey(choice.id) === key);
      if (team) chooseTeam(team);
    },
    open: open && !disabled,
    // Enter chose the first row before anything was typed; keep that, and
    // show which row it is. The agent menu marks who is addressed instead,
    // so nothing looks hovered until the pointer or keyboard says so.
    highlightEmpty: !audience,
    wrap: true,
  });
  const highlightedLabel =
    candidates.find(
      (choice) => personKey(choice.recipient.pubkey) === highlight.active,
    )?.label ??
    teams.choices.find((team) => teamKey(team.id) === highlight.active)?.name;
  // Underline with the same rule that ranks mentions.
  const matched = (label: string) =>
    search.trim() ? matchPerson(label, search)?.positions : undefined;
  return (
    <PopoverRoot
      open={open && !disabled}
      onOpenChange={(next, details) => {
        setOpen(next);
        // Focus that left by a click or Tab keeps its new destination.
        closedBy.current = next
          ? undefined
          : details.reason === "outside-press" || details.reason === "focus-out"
            ? "outside"
            : "inside";
        if (next) {
          setOpening((value) => value + 1);
          accepted.current = false;
          if (!draftRoster) session.channels.ensureList();
        }
      }}
    >
      <fieldset
        ref={controls}
        disabled={disabled}
        className={styles.pickerControls}
        aria-label={t("mentionPicker.controls")}
      >
        <PopoverTrigger
          disabled={disabled}
          render={
            audience && audience.recipients.length > 1 ? (
              // Several agents: the composer shows them as removable
              // avatars, and this opens the menu.
              <IconButton
                disabled={disabled}
                size="toolbar"
                ref={trigger}
                type="button"
                aria-label={t("mentionPicker.sendingAgents", {
                  names: audience.recipients
                    .map((person) => person.name)
                    .join(", "),
                })}
                title={t("mentionPicker.changeAgents")}
                icon={<CaretDownIcon size={16} aria-hidden="true" />}
              />
            ) : audience ? (
              <Button
                variant="subtle"
                size="sm"
                disabled={disabled}
                ref={trigger}
                type="button"
                aria-label={
                  audience.recipients.length
                    ? t("mentionPicker.sendingAgents", {
                        names: audience.recipients
                          .map((person) => person.name)
                          .join(", "),
                      })
                    : t("mentionPicker.chooseAgent")
                }
              >
                <AvatarStack
                  size="small"
                  items={audience.recipients.map((person) => ({
                    id: person.pubkey,
                    name: person.name,
                    src: avatarMedia(
                      profiles.get(person.pubkey)?.picture,
                      session.media,
                    ),
                    shape: "squircle",
                  }))}
                />
                {audience.recipients[0]?.name ?? t("mentionPicker.chooseAgent")}
                <CaretDownIcon size={12} aria-hidden="true" />
              </Button>
            ) : (
              <IconButton
                hint="familiar"
                disabled={disabled}
                size="toolbar"
                ref={trigger}
                type="button"
                aria-label={t("mentionPicker.mentionMember")}
                title={t("mentionPicker.mentionMember")}
                icon={<AtIcon size={20} aria-hidden="true" />}
              />
            )
          }
        />
        <PopoverPopup
          side="top"
          sideOffset={4}
          anchor={() => controls.current?.closest("form") ?? trigger.current}
          padding="none"
          initialFocus={searchInput}
          style={{
            width: 380,
            height: "min(360px, var(--available-height))",
            overflow: "hidden",
            display: "flex",
          }}
          aria-label={t("mentionPicker.popup")}
          finalFocus={
            // The agent menu stays open across picks; closing it resumes
            // typing in the draft, unless focus went somewhere else. The
            // popup also asks while open, when the trigger changes shape.
            audience && focusDraft
              ? () => {
                  if (closedBy.current === "inside") focusDraft();
                  return false;
                }
              : !accepted.current
          }
        >
          <div className={styles.mentionContent}>
            <SearchField
              variant="capsule"
              inputRef={searchInput}
              label={
                draftRoster
                  ? t("mentionPicker.searchRecipients")
                  : inviteAgents
                    ? t("mentionPicker.searchMembers")
                    : t("mentionPicker.searchCommunity")
              }
              placeholder={t("mentionPicker.searchPlaceholder")}
              clearLabel={t(
                draftRoster
                  ? "mentionPicker.clearRecipients"
                  : inviteAgents
                    ? "mentionPicker.clearMembers"
                    : "mentionPicker.clearCommunity",
              )}
              value={search}
              onValueChange={setSearch}
              disabled={disabled}
              aria-controls={highlight.listId}
              {...highlight.fieldProps}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
                // Shift+Enter and Shift+arrows stay text keys, as before.
                const handled = !event.shiftKey && highlight.keyDown(event);
                // Keep these keys from the composer behind the popup.
                if (handled || event.key === "Enter") event.stopPropagation();
              }}
            />
            {!draftRoster && inviteAgents && (
              <p>
                {parentAdmission
                  ? t("mentionPicker.inviteChannel")
                  : t("mentionPicker.inviteChat")}
              </p>
            )}
            {model.directory.loading && (
              <p role="status">{t("mentionPicker.searchingCommunity")}</p>
            )}
            {model.directory.error && (
              <>
                <p role="status">{knownMentionText(model.directory.error)}</p>
                <Button type="button" onClick={model.directory.retry}>
                  {t("mentionPicker.retryCommunity")}
                </Button>
              </>
            )}
            {agents.status === "loading" && !candidates.length && (
              <p role="status">{t("mentionPicker.loadingAgents")}</p>
            )}
            {(agents.status === "error" || !!agents.error) && (
              <Button
                type="button"
                onClick={() =>
                  void session.agentChoices.refresh(
                    !!inviteAgents || teams.includeLegacy,
                  )
                }
              >
                {t("mentionPicker.retryAgents")}
              </Button>
            )}
            {model.archives.status === "error" && (
              <Button
                type="button"
                onClick={() => void session.archives?.refresh()}
              >
                {t("mentionPicker.retryArchives")}
              </Button>
            )}
            {teams.status && (
              <p role="status">
                {knownMentionText(teams.status)}{" "}
                {teams.canRetry && (
                  <Button onClick={teams.retry}>
                    {t("mentionPicker.retryLegacyTeams")}
                  </Button>
                )}
              </p>
            )}
            {error && <p role="status">{resolveMessage(error)}</p>}
            {!draftRoster && list.error && (
              <>
                <p role="alert">{t("mentionPicker.membershipFailed")}</p>
                <Button
                  disabled={disabled}
                  type="button"
                  onClick={() => session.channels.refreshList?.()}
                >
                  {t("mentionPicker.retryMembership")}
                </Button>
              </>
            )}
            {!draftRoster && (!inviteAgents || !!channel) && !members && (
              <p role="status">{t("mentionPicker.membershipUnavailable")}</p>
            )}
            <div
              className={`${styles.mentionChoices} buzz-thin-scrollbar`}
              id={highlight.listId}
              {...highlight.listProps}
            >
              {candidates.map(
                ({
                  recipient,
                  label,
                  agent,
                  elsewhere,
                  disabled: reason,
                  otherName,
                  execution,
                }) => {
                  const managedBy = model.managedBy.get(recipient.pubkey);
                  const remoteDetail = knownMentionText(
                    remoteMentionDetail(execution),
                  );
                  const manager = session.profiles.owner?.(recipient.pubkey);
                  const managerName = manager
                    ? profiles.get(manager)?.name?.trim()
                    : undefined;
                  const managerCaption =
                    managedBy &&
                    managerName &&
                    managedBy ===
                      managedByDetail(manager, session.viewer, profiles)
                      ? t("mentionPicker.managedBy", { name: managerName })
                      : managedBy;
                  // Each addressed agent's row shows a check; fill is only
                  // the keyboard and pointer highlight.
                  const addressed = !!audience?.recipients.some(
                    (person) => person.pubkey === recipient.pubkey,
                  );
                  const focused =
                    highlight.active === personKey(recipient.pubkey);
                  return (
                    <NavigationItem
                      variant="option"
                      // The exact key the row picks; its label may not show it.
                      data-mention-choice={recipient.pubkey}
                      type="button"
                      key={recipient.pubkey}
                      {...highlight.rowProps(personKey(recipient.pubkey))}
                      selected={audience ? false : focused}
                      highlighted={audience ? focused : false}
                      aria-current={false}
                      aria-pressed={audience ? addressed : undefined}
                      disabled={disabled || !!reason}
                      onClick={() => chooseRecipient(recipient)}
                      label={
                        <span className="flex flex-col whitespace-normal">
                          {/* One element, so the flex column keeps the
                            underlined name on one line. */}
                          <span>
                            <MatchedLabel
                              label={label}
                              positions={matched(label)}
                            />
                            {agent && (
                              <span
                                aria-hidden="true"
                                className={styles.agentMark}
                              >
                                <RobotIcon />
                              </span>
                            )}
                            {agent && (
                              <span className="sr-only">
                                {" "}
                                {t("mentionPicker.agent")}
                              </span>
                            )}
                          </span>
                          {reason && <small>{knownMentionText(reason)}</small>}
                          {(remoteDetail ||
                            otherName ||
                            managedBy ||
                            !members?.includes(recipient.pubkey)) && (
                            <small className="text-caption text-subtle">
                              {/* The other verified name sits beside the detail. */}
                              {[
                                otherName,
                                remoteDetail,
                                managerCaption,
                                members?.includes(recipient.pubkey)
                                  ? undefined
                                  : inviteAgents
                                    ? parentAdmission
                                      ? t("mentionPicker.addsChannel")
                                      : t("mentionPicker.addsChat")
                                    : elsewhere
                                      ? t("mentionPicker.inHost", {
                                          host: elsewhere,
                                        })
                                      : knownMentionText(
                                          outsideMentionDetail(
                                            channel,
                                            elsewhere,
                                          ),
                                        ),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          )}
                        </span>
                      }
                      trailing={
                        addressed && <CheckIcon size={16} aria-hidden="true" />
                      }
                      icon={
                        <Avatar
                          alt=""
                          fallback={label}
                          src={avatarMedia(
                            profiles.get(recipient.pubkey)?.picture ??
                              model.directory.people.find(
                                (person) => person.pubkey === recipient.pubkey,
                              )?.picture,
                            session.media,
                          )}
                          size="large"
                          shape={
                            agent || !members?.includes(recipient.pubkey)
                              ? "squircle"
                              : "circle"
                          }
                        />
                      }
                    />
                  );
                },
              )}
              {teams.choices.map((team) => (
                <NavigationItem
                  key={team.id}
                  variant="option"
                  data-mention-choice=""
                  type="button"
                  {...highlight.rowProps(teamKey(team.id))}
                  selected={highlight.active === teamKey(team.id)}
                  aria-current={false}
                  disabled={disabled || !!team.disabled}
                  label={
                    <MatchedLabel
                      label={team.name}
                      positions={matched(team.name)}
                    />
                  }
                  icon={
                    <TeamMentionAvatars
                      session={session}
                      recipients={team.recipients}
                    />
                  }
                  trailing={
                    <span className="text-caption text-subtle">
                      {teamCaption(team)}
                    </span>
                  }
                  aria-label={t("mentionPicker.teamNameDetail", {
                    name: team.name,
                    detail: teamCaption(team),
                  })}
                  onClick={() => chooseTeam(team)}
                />
              ))}
              {members && !candidates.length && !teams.choices.length && (
                <p>{t("mentionPicker.noMembers")}</p>
              )}
              {audience?.named && (
                <p className="text-caption text-subtle">
                  {t("mentionPicker.namedTags", {
                    names: audience.recipients
                      .map((person) => person.name)
                      .join(", "),
                  })}
                </p>
              )}
              <p role="status" className="sr-only">
                {highlightedLabel
                  ? t(
                      audience
                        ? "mentionPicker.announceToggle"
                        : "mentionPicker.announceMention",
                      { name: highlightedLabel },
                    )
                  : ""}
              </p>
            </div>
          </div>
        </PopoverPopup>
      </fieldset>
    </PopoverRoot>
  );
}
