import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { administerMember } from "../../features/channel-members/administration";
import { canAddMembers } from "../../features/channel-members/members";
import type { ChannelSummary } from "../../features/relay/contracts";
import { useChannelList } from "../../features/relay/react";
import type { RelaySession } from "../../features/relay/session";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import {
  MenuItem,
  MenuPopup,
  MenuRoot,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { t, useLanguage } from "../../shared/i18n";
import { compareRecent } from "../channels/sidebar-sections";

/** The private channels `viewer` is in, most recent first: those `bestie` is
 * in too, and the rest. DMs, Solo chats, huddle rooms and system channels
 * are not ones to add an agent to. */
export function privateChannels(
  channels: readonly ChannelSummary[],
  viewer: string,
  bestie: string,
) {
  const yours = channels
    .filter(
      (channel) =>
        !channel.archived &&
        !channel.huddle &&
        (channel.channelType === "stream" || channel.channelType === "forum") &&
        channel.private &&
        channel.members?.includes(viewer),
    )
    .sort(compareRecent);
  return {
    joined: yours.filter((channel) => channel.members?.includes(bestie)),
    others: yours.filter((channel) => !channel.members?.includes(bestie)),
  };
}

/** Removes `pubkey` from one channel as the Members dialog does, resolving
 * only once a fresh roster read confirms it. */
async function removeMember(
  session: RelaySession,
  channelId: string,
  pubkey: string,
) {
  const result = await administerMember(
    session.memberAdministration,
    channelId,
    pubkey,
    // Already gone: nothing to send.
    (role) => (role ? { expectedRole: role, role: "remove" } : undefined),
    t("fubestie.privates.rolesUnavailable"),
  );
  if (result.status !== "confirmed")
    throw new Error(result.error ?? t("fubestie.privates.removalUnconfirmed"));
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** The buttons someone can focus in `node`, in page order. */
function controls(node: HTMLElement | null) {
  return [
    ...(node?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []),
  ];
}

/** The private channels Bestie reads because it is a member. For a former
 * Bestie, `former` names it, and the list is for taking it out. */
export function PrivateChannels({
  session,
  bestie,
  former,
}: {
  session: RelaySession;
  bestie: string;
  former?: string;
}) {
  useLanguage();
  const list = useChannelList(session.channels);
  const { joined, others } = privateChannels(
    list.channels,
    session.viewer ?? "",
    bestie,
  );
  // A cached row may be stale offline, so it is offered for no change, as
  // Remove isn't.
  const addable = others.filter(
    (channel) => !channel.cached && canAddMembers(session, channel),
  );
  // Only a complete, current roster shows which channels Bestie is not in.
  const complete = list.status === "ready" && list.coverage !== "partial";
  const retry = () =>
    session.channels.refreshList
      ? session.channels.refreshList()
      : session.channels.ensureList();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  /** Why each channel's last change failed, and whether it was to join. */
  const [failed, setFailed] = useState<
    Readonly<
      Record<string, Readonly<{ name: string; error: string; join: boolean }>>
    >
  >({});
  /** The channels Add to all, or Remove from all, asked about. */
  const [confirming, setConfirming] = useState<readonly ChannelSummary[]>();
  /** The channel Remove asked about, as the Members dialog asks first. */
  const [removing, setRemoving] = useState<ChannelSummary>();
  const cancelRemove = useRef<HTMLButtonElement>(null);
  const proceed = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const section = useRef<HTMLDivElement>(null);
  /** The control here that has focus, and its place among them. */
  const focused = useRef<{ element: HTMLElement; index: number } | null>(null);
  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const enter = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const index = controls(node).indexOf(target);
      focused.current = index < 0 ? null : { element: target, index };
    };
    // Focus that leaves for elsewhere, a dialog or menu included, is the
    // person's to place. It comes back with the control it returns to.
    const leave = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && !node.contains(next)) focused.current = null;
    };
    node.addEventListener("focusin", enter);
    node.addEventListener("focusout", leave);
    return () => {
      node.removeEventListener("focusin", enter);
      node.removeEventListener("focusout", leave);
    };
  }, []);
  // A removed row, or Add controls with nothing left to add, take their
  // focused button with them, and DOM removal sends no blur. Hand focus to the
  // control now in its place, else the section heading, unless the person has
  // already moved it somewhere else.
  useLayoutEffect(() => {
    const last = focused.current;
    if (!last || last.element.isConnected) return;
    focused.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const left = controls(section.current);
    const heading = document.getElementById(headingId);
    const target = left[Math.min(last.index, left.length - 1)] ?? heading;
    if (target === heading) heading?.setAttribute("tabindex", "-1");
    target?.focus();
  });
  /** The agent this section is for now, or none once it is gone, as after
   * Change: changes still to run for an earlier one aren't sent. */
  const current = useRef<string | undefined>(bestie);
  current.current = bestie;
  useEffect(() => {
    // Set again here, as StrictMode and hidden panes run the cleanup and then
    // this without a render in between.
    current.current = bestie;
    return () => {
      current.current = undefined;
    };
  }, [bestie]);

  /** Runs `change` on each channel in turn, as adding several agents does,
   * and keeps why each one failed. */
  const run = async (
    channels: readonly ChannelSummary[],
    join: boolean,
    change: (id: string) => Promise<void>,
  ) => {
    const ids = new Set(channels.map((channel) => channel.id));
    setBusy((current) => new Set([...current, ...ids]));
    setFailed((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => !ids.has(id)),
      ),
    );
    for (const [index, { id, name }] of channels.entries()) {
      if (current.current !== bestie) {
        const left = new Set(channels.slice(index).map((each) => each.id));
        setBusy((now) => new Set([...now].filter((key) => !left.has(key))));
        return;
      }
      let error: string | undefined;
      try {
        await change(id);
      } catch (cause) {
        error = message(cause);
      }
      setBusy((current) => new Set([...current].filter((key) => key !== id)));
      if (error !== undefined)
        setFailed((current) => ({ ...current, [id]: { name, error, join } }));
    }
  };
  const add = (channels: readonly ChannelSummary[]) =>
    // Bestie reads these as a guest: it reports in your DM and can't post here.
    run(channels, true, (id) =>
      session.memberAdditions.add(id, bestie, { role: "guest" }),
    );
  const remove = (channels: readonly ChannelSummary[]) =>
    run(channels, false, (id) => removeMember(session, id, bestie));
  const name = former ?? t("fubestie.bestie");
  const removable = joined.filter((channel) => !channel.cached);
  const adding = addable.some((channel) => busy.has(channel.id));
  // A failure stops showing once the channel is as the change wanted anyway.
  const inBestie = new Set(joined.map((channel) => channel.id));
  const problems = Object.entries(failed).filter(
    ([id, { join }]) => inBestie.has(id) !== join,
  );

  return (
    <div ref={section} className="contents">
      <InlineHeader
        id={headingId}
        title={t("fubestie.privates.title", { name })}
        subtitle={
          former
            ? t("fubestie.privates.formerSubtitle")
            : t("fubestie.privates.subtitle")
        }
      />
      <SettingsGroup>
        {joined.map((channel) => (
          <PreferenceRow
            key={channel.id}
            title={`#${channel.name}`}
            trailing={
              <Button
                variant="outline"
                loading={busy.has(channel.id)}
                disabled={channel.cached}
                aria-label={t("fubestie.privates.removeFrom", {
                  name,
                  channel: channel.name,
                })}
                onClick={() => setRemoving(channel)}
              >
                {t("fubestie.privates.remove")}
              </Button>
            }
          />
        ))}
        {list.status === "error" ? (
          <PreferenceRow
            title={t("fubestie.privates.loadFailed")}
            subtitle={
              list.error ?? t("fubestie.privates.mayBeElsewhereRetry", { name })
            }
            trailing={(label) => (
              <Button
                variant="outline"
                aria-describedby={label["aria-labelledby"]}
                onClick={retry}
              >
                {t("fubestie.privates.retry")}
              </Button>
            )}
          />
        ) : list.coverage === "partial" ? (
          <PreferenceRow
            title={t("fubestie.privates.partial")}
            subtitle={t("fubestie.privates.mayBeElsewhere", { name })}
          />
        ) : list.status !== "ready" ? (
          !joined.length && (
            <PreferenceRow title={t("fubestie.privates.loading")} />
          )
        ) : (
          !joined.length &&
          (former ? (
            <PreferenceRow title={t("fubestie.privates.none")} />
          ) : (
            <PreferenceRow
              title={t("fubestie.privates.noneYet")}
              subtitle={t("fubestie.privates.noneYetHint")}
            />
          ))
        )}
        {/* Each action has a row of its own, so its button can wrap under
            its title in a narrow panel instead of widening the tab. */}
        {former
          ? removable.length > 0 && (
              <PreferenceRow
                title={t("fubestie.privates.removeFromAllTitle", { name })}
                trailing={(label) => (
                  <Button
                    variant="outline"
                    aria-describedby={label["aria-labelledby"]}
                    loading={removable.some((channel) => busy.has(channel.id))}
                    onClick={() => setConfirming(removable)}
                  >
                    {t("fubestie.privates.removeFromAll")}
                  </Button>
                )}
              />
            )
          : addable.length > 0 && (
              <>
                <PreferenceRow
                  title={t("fubestie.privates.addOne")}
                  subtitle={t("fubestie.privates.addOneHint")}
                  trailing={(label) => (
                    <MenuRoot>
                      <MenuTrigger
                        render={
                          <Button
                            variant="outline"
                            aria-describedby={label["aria-labelledby"]}
                          >
                            {t("fubestie.privates.choose")}
                          </Button>
                        }
                      />
                      <MenuPopup align="end">
                        {addable.map((channel) => (
                          <MenuItem
                            key={channel.id}
                            disabled={busy.has(channel.id)}
                            onClick={() => void add([channel])}
                          >
                            #{channel.name}
                          </MenuItem>
                        ))}
                      </MenuPopup>
                    </MenuRoot>
                  )}
                />
                <PreferenceRow
                  title={t("fubestie.privates.addAllTitle")}
                  subtitle={
                    complete
                      ? addable.length === 1
                        ? t("fubestie.privates.withoutBestieOne")
                        : t("fubestie.privates.withoutBestieMany", {
                            count: addable.length,
                          })
                      : t("fubestie.privates.addAllPending")
                  }
                  trailing={(label) => (
                    <Button
                      variant="outline"
                      aria-describedby={label["aria-labelledby"]}
                      loading={adding}
                      disabled={!complete}
                      onClick={() => setConfirming(addable)}
                    >
                      {t("fubestie.privates.addToAll")}
                    </Button>
                  )}
                />
              </>
            )}
      </SettingsGroup>
      {problems.length > 0 && (
        <div role="alert" className="buzz-field-error">
          {problems.map(([id, { name, error }]) => (
            <p key={id}>
              #{name}: {error}
            </p>
          ))}
        </div>
      )}
      {removing && (
        <AlertDialog
          title={t("fubestie.privates.removeConfirmTitle", {
            name,
            channel: removing.name,
          })}
          description={t("fubestie.privates.removeConfirmDescription", {
            name,
          })}
          initialFocus={cancelRemove}
          onClose={() => setRemoving(undefined)}
          actions={
            <>
              <Button
                variant="subtle"
                ref={cancelRemove}
                onClick={() => setRemoving(undefined)}
              >
                {t("fubestie.privates.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setRemoving(undefined);
                  void remove([removing]);
                }}
              >
                {t("fubestie.privates.removeName", { name })}
              </Button>
            </>
          }
        />
      )}
      {confirming && (
        <AlertDialog
          title={
            former
              ? confirming.length === 1
                ? t("fubestie.privates.removeAllConfirmOne", { name })
                : t("fubestie.privates.removeAllConfirmMany", {
                    name,
                    count: confirming.length,
                  })
              : confirming.length === 1
                ? t("fubestie.privates.addAllConfirmOne")
                : t("fubestie.privates.addAllConfirmMany", {
                    count: confirming.length,
                  })
          }
          description={
            former
              ? t("fubestie.privates.membersSeeRemoved", { name })
              : t("fubestie.privates.membersSeeAdded")
          }
          initialFocus={former ? undefined : proceed}
          onClose={() => setConfirming(undefined)}
          actions={
            <>
              <Button onClick={() => setConfirming(undefined)}>
                {t("fubestie.privates.cancel")}
              </Button>
              <Button
                ref={proceed}
                variant={former ? "destructive" : "prominent"}
                onClick={() => {
                  setConfirming(undefined);
                  void (former ? remove : add)(confirming);
                }}
              >
                {former
                  ? t("fubestie.privates.removeFromAll")
                  : t("fubestie.privates.addToAll")}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
