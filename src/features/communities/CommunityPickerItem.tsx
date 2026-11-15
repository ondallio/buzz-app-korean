import { t, useLanguage } from "../../shared/i18n";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { OpenTarget } from "../navigation/targets";
import type { UnreadCapability } from "../relay/unread";
import {
  ChecksIcon,
  LinkIcon,
  SignOutIcon,
  TicketIcon,
} from "../../shared/design-system/icons/index";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  MenuIcon,
  MenuItem,
  MenuNote,
  MenuPopup,
  MenuSeparator,
} from "../../shared/design-system/ui/Menu";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import { communityDestination } from "./destination";
import { communityName } from "./names";
import type { Membership } from "./service";
import styles from "./Communities.module.css";
import { writeClipboardText } from "../../shared/clipboard";

/** The bundled moderation plugin's Membership card, addressed by contribution key. */
export const MEMBERSHIP_SECTION = "buzz.moderation/membership";

/** A community the menu can act on through its own ready session. Absent for
 * inactive communities: no item here ever acquires a session. */
export type SelectedSession = {
  unread: Pick<
    UnreadCapability,
    "sync" | "subscribeSync" | "markAllChannelsRead"
  >;
};

const noSubscription = () => () => {};

/** Marks every conversation read and reports the outcome in a toast. Shared by
 * the menu item and the Shift+Escape shortcut. */
export function markAllRead(
  unread: Pick<UnreadCapability, "markAllChannelsRead">,
  notify: ReturnType<typeof useToastNotification>,
) {
  return unread.markAllChannelsRead().then(
    () => notify(t("v1id.picker.markedAllRead"), "success"),
    () => notify(t("v1id.picker.markAllReadFailed"), "error"),
  );
}

/** One picker row and its context menu. Selection stays with the picker. */
export function CommunityPickerItem({
  membership,
  icon,
  selected,
  viewer,
  session,
  manager,
  leaving,
  onSelect,
  onOpenTarget,
  onMenuOpen,
  onLeave,
}: {
  membership: Membership;
  icon: string | undefined;
  selected: boolean;
  viewer: string | undefined;
  /** The selected community's session once it is ready; never another community's. */
  session: SelectedSession | undefined;
  /** The viewer is an owner or admin of this community, and this build can mint invites. */
  manager: boolean;
  /** A leave request for this community is in flight. */
  leaving: boolean;
  onSelect: (id: string) => void;
  onOpenTarget?: ((target: OpenTarget) => void) | undefined;
  onMenuOpen?: (() => void) | undefined;
  /** Asks the picker to confirm and run a leave; the picker owns the dialog. */
  onLeave: (membership: Membership) => void;
}) {
  useLanguage();
  // A keyboard open anchors to the picker item; a pointer open leaves the anchor
  // to Base UI's cursor point.
  const [menu, setMenu] = useState<{
    anchor: HTMLElement | undefined;
  } | null>(null);
  const button = useRef<HTMLElement | null>(null);
  const navigated = useRef(false);
  // Outlives `menu`, which is already null when the closing menu asks where
  // focus should go.
  const fromKeyboard = useRef(false);
  useEffect(() => {
    if (menu) fromKeyboard.current = menu.anchor !== undefined;
  }, [menu]);
  // Browsers focus the picker row on a right-click's mousedown, before the
  // contextmenu event opens the menu, so Base UI's own "previous focus" is
  // the button rather than the field the pointer interrupted. Remember that
  // field at pointerdown, ahead of the focus move.
  const interrupted = useRef<HTMLElement | null>(null);
  const rememberInterrupted = (event: PointerEvent<HTMLElement>) => {
    const active = event.currentTarget.ownerDocument.activeElement;
    interrupted.current =
      active instanceof HTMLElement && active !== active.ownerDocument.body
        ? active
        : null;
  };
  const notify = useToastNotification();
  const name = communityName(membership);
  const origin = communityDestination(membership.id).url;
  const scope = viewer ? { viewer, communityOrigin: origin } : undefined;
  /** Both entry points open here, so the roster refresh runs for each. */
  const openMenu = (anchor?: HTMLElement) => {
    navigated.current = false;
    // Some browsers synthesise a contextmenu event for Shift+F10, which re-enters
    // through Base UI once the keyboard open has rendered: the first anchor
    // wins, and the roster is not read a second time for the same open.
    setMenu((current) => current ?? { anchor });
    if (menu === null) onMenuOpen?.();
  };
  const openFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      event.preventDefault();
      openMenu(event.currentTarget);
    }
  };
  const open = (target: OpenTarget) => {
    navigated.current = true;
    onOpenTarget?.(target);
  };
  const copy = () =>
    writeClipboardText(origin).then(
      () => notify(t("v1id.picker.urlCopied"), "success"),
      () => notify(t("v1id.picker.urlCopyFailed"), "error"),
    );
  return (
    <ContextMenuRoot
      open={menu !== null}
      onOpenChange={(next) => {
        if (next) openMenu();
        else setMenu(null);
      }}
    >
      <ContextMenuTrigger
        render={<div className={styles.item} />}
        onKeyDown={openFromKeyboard}
        onPointerDown={rememberInterrupted}
      >
        <NavigationItem
          ref={(node) => {
            button.current = node;
          }}
          label={name}
          title={`${name} — ${origin}`}
          aria-label={t("v1id.picker.switchTo", { name })}
          aria-current={selected ? "true" : undefined}
          selected={selected}
          icon={
            <Avatar
              size="small"
              shape="squircle"
              alt=""
              fallback={name}
              src={icon}
            />
          }
          onClick={() => onSelect(membership.id)}
        />
      </ContextMenuTrigger>
      <MenuPopup
        aria-label={t("communityAdmin.actionsFor", { name })}
        size="compact"
        anchor={menu?.anchor}
        side={menu?.anchor ? "right" : "bottom"}
        finalFocus={() => {
          // Opening Settings hands focus to the page, like the account menu does.
          if (navigated.current) {
            const main = document.getElementById("main-content");
            return main && !main.contains(document.activeElement)
              ? main
              : false;
          }
          // A keyboard open came from the picker, so focus goes back there.
          if (fromKeyboard.current) return button.current ?? false;
          // A pointer open may have interrupted typing elsewhere; that field
          // takes focus back while it is still in the document. With nothing
          // interrupted, Base UI's default lands on the picker row the
          // right-click focused.
          const field = interrupted.current;
          return field?.isConnected ? field : true;
        }}
      >
        <MarkAllReadItem
          name={name}
          selected={selected}
          session={session}
          notify={notify}
        />
        <MenuSeparator />
        <MenuItem onClick={() => void copy()}>
          <MenuIcon>
            <LinkIcon size={14} />
          </MenuIcon>
          {t("v1id.picker.copyUrl")}
        </MenuItem>
        {selected && manager && scope && onOpenTarget && (
          <MenuItem
            onClick={() =>
              open({
                version: 1,
                kind: "settings",
                section: MEMBERSHIP_SECTION,
                scope,
              })
            }
          >
            <MenuIcon>
              <TicketIcon size={14} />
            </MenuIcon>
            {t("v1id.picker.invite")}
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem
          tone="danger"
          disabled={leaving}
          onClick={() => {
            if (!leaving) onLeave(membership);
          }}
        >
          <MenuIcon>
            <SignOutIcon size={14} />
          </MenuIcon>
          {leaving ? t("v1id.picker.leaving") : t("v1id.picker.leaveCommunity")}
        </MenuItem>
      </MenuPopup>
    </ContextMenuRoot>
  );
}

/** Mounted only while the menu is open, so the read-state subscription is too. */
function MarkAllReadItem({
  name,
  selected,
  session,
  notify,
}: {
  name: string;
  selected: boolean;
  session: SelectedSession | undefined;
  notify: ReturnType<typeof useToastNotification>;
}) {
  useLanguage();
  const noteId = useId();
  const unread = session?.unread;
  const subscribe = useCallback(
    (listener: () => void) =>
      unread ? unread.subscribeSync(listener) : noSubscription(),
    [unread],
  );
  const capability = useSyncExternalStore(
    subscribe,
    () => unread?.sync().capability,
    () => unread?.sync().capability,
  );
  // Read state is session-bound and validated against the relay snapshot, so an
  // inactive community cannot be marked without acquiring it.
  const reason = !selected
    ? t("v1id.picker.onlySelected")
    : !unread
      ? t("v1id.picker.waitingFor", { name })
      : capability !== "frontier-sync"
        ? t("v1id.picker.cantSync")
        : undefined;
  return (
    <>
      <MenuItem
        disabled={!!reason}
        aria-describedby={reason ? noteId : undefined}
        onClick={() => {
          if (!unread || reason) return;
          void markAllRead(unread, notify);
        }}
      >
        <MenuIcon>
          <ChecksIcon size={14} />
        </MenuIcon>
        {t("v1id.picker.markAllRead")}
      </MenuItem>
      {reason && <MenuNote id={noteId}>{reason}</MenuNote>}
    </>
  );
}
