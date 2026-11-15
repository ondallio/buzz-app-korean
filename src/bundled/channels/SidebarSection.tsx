import { RenameSidebarSection } from "./RenameSidebarSection";
import { SidebarActiveDialog } from "./SidebarActiveDialog";
import { FadingLabel } from "./FadingLabel";
import {
  useId,
  useRef,
  useState,
  type DOMAttributes,
  type ReactNode,
  type Ref,
} from "react";
import {
  MenuGroup,
  MenuGroupLabel,
  MenuIcon,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuPopup,
  MenuSubmenuTrigger,
  MenuTrigger,
  MenuTrailing,
} from "../../shared/design-system/ui/Menu";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowsDownUpIcon,
  CaretDownIcon,
  ChatsCircleIcon,
  ChatUnreadIcon,
  DotsThreeIcon,
  Filter2Icon,
  PencilSimpleIcon,
  PlusIcon,
  TextAaIcon,
  TimerIcon,
  TrashIcon,
} from "../../shared/design-system/icons";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { t, useLanguage } from "../../shared/i18n";
import { NavigationSectionHeading } from "../../shared/design-system/ui/NavigationSection";
import type { RelaySession } from "../../features/relay/session";
import type { ChannelSummary } from "../../features/relay/contracts";
import type { SidebarSortMode } from "../../features/relay/sidebar-sort";
import { DEFAULT_ACTIVE_WINDOW_SECONDS } from "../../features/relay/sidebar-preferences";
import type { SidebarFilter } from "./useSidebarFilters";
import { SidebarGroupIcon } from "./SidebarGroupIcon";
import { SidebarStarIcon } from "./SidebarStarIcon";
import { ChannelSidebarMenuItem } from "./ChannelSidebarMenuItem";
import styles from "./Channels.module.css";

export function SidebarSection({
  sectionKey,
  title,
  icon,
  session,
  open,
  onToggle,
  headerActions,
  headerNotice,
  hideMoreActions = false,
  persistentChevron = false,
  createChannel,
  createSection,
  newMessage,
  sort,
  filter,
  channels,
  dropRef,
  dropTarget = false,
  dropEdge,
  dragHandle,
  dragging = false,
  move,
  onRemove,
  onRename,
  channelCount,
  removalFocus,
  children,
}: {
  sectionKey: string;
  title: string;
  icon?: ReactNode;
  session?: RelaySession | undefined;
  open: boolean;
  onToggle: (open: boolean) => void;
  headerActions?: ReactNode;
  headerNotice?: ReactNode;
  onRemove?: (() => unknown) | undefined;
  onRename?: ((name: string) => unknown) | undefined;
  hideMoreActions?: boolean;
  /** Keep the disclosure affordance visible instead of revealing it on hover. */
  persistentChevron?: boolean;
  channelCount?: number | undefined;
  removalFocus?: (() => HTMLElement | null | undefined) | undefined;
  createChannel?:
    | { available: boolean; open: (trigger: HTMLButtonElement) => void }
    | undefined;
  newMessage?: (() => void) | undefined;
  createSection?:
    | { available: boolean; open: (trigger: HTMLButtonElement) => void }
    | undefined;
  sort?:
    | {
        value: SidebarSortMode;
        modes?: readonly { id: SidebarSortMode; label: string }[];
        change: (mode: SidebarSortMode) => void;
      }
    | undefined;
  filter?:
    | {
        value: SidebarFilter;
        disabled?: boolean;
        activeWindowSeconds?: number | undefined;
        change: (mode: SidebarFilter, seconds?: number) => unknown;
        dismissError?: () => void;
      }
    | undefined;
  channels?:
    | {
        rows: readonly ChannelSummary[];
        selected?: string | undefined;
        select: (id: string) => void;
      }
    | undefined;
  dropRef?: Ref<HTMLDivElement> | undefined;
  dropTarget?: boolean;
  /** Where a dragged group would land relative to this one. */
  dropEdge?: "before" | "after" | undefined;
  dragHandle?:
    | {
        ref: Ref<HTMLElement>;
        listeners?: DOMAttributes<HTMLElement> | undefined;
      }
    | undefined;
  dragging?: boolean;
  /** Single-pointer and keyboard reordering; an absent direction is disabled. */
  move?:
    | { up?: (() => void) | undefined; down?: (() => void) | undefined }
    | undefined;
  children: ReactNode;
}) {
  useLanguage();
  const displayTitle =
    sectionKey === "starred" && title === "Starred"
      ? t("channelForms.create.starred")
      : sectionKey === "channels" && title === "Channels"
        ? t("channelPages.channels")
        : sectionKey === "forums" && title === "Forums"
          ? t("sidebarSectionParent.forums")
          : sectionKey === "dms" && title === "Direct messages"
            ? t("search.dms")
            : title;
  const activeDays =
    (filter?.activeWindowSeconds ?? DEFAULT_ACTIVE_WINDOW_SECONDS) / 86400;
  const id = useId();
  const cancelRemove = useRef<HTMLButtonElement>(null);
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // The menu unmounts while hidden, so it must not reopen when shown again.
  if (hideMoreActions && menuOpen) setMenuOpen(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const canRemove = !!onRemove && sectionKey.startsWith("group:");
  const canRename = !!onRename && sectionKey.startsWith("group:");
  const remove = async () => {
    if (!onRemove || removing) return;
    setRemoving(true);
    setRemoveError("");
    try {
      await onRemove();
      setRemoveOpen(false);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : String(error));
    } finally {
      setRemoving(false);
    }
  };
  return (
    <div
      ref={dropRef}
      className={styles.channelSection}
      data-sidebar-section={sectionKey}
      data-drop-target={dropTarget || undefined}
      data-drop-edge={dropEdge}
      data-section-dragging={dragging || undefined}
      data-menu-open={menuOpen || undefined}
    >
      <NavigationSectionHeading
        disclosure
        revealActions
        actions={
          <>
            {!hideMoreActions && (
              <MenuRoot open={menuOpen} onOpenChange={setMenuOpen}>
                <MenuTrigger
                  ref={actionsTrigger}
                  render={(props) => (
                    <IconButton
                      {...props}
                      size="compact"
                      aria-label={t("sidebarSectionParent.actions", {
                        title: displayTitle,
                      })}
                      icon={<DotsThreeIcon strokeWidth={2.5} size={15} />}
                    />
                  )}
                />
                <MenuPopup
                  align="end"
                  aria-label={t("sidebarSectionParent.actions", {
                    title: displayTitle,
                  })}
                >
                  {filter && (
                    <MenuSubmenu>
                      <MenuSubmenuTrigger>
                        <MenuIcon>
                          <Filter2Icon size={14} />
                        </MenuIcon>
                        {t("sidebarSectionParent.filter")}
                      </MenuSubmenuTrigger>
                      <MenuSubmenuPopup
                        aria-label={t("sidebarSectionParent.filterTitle", {
                          title: displayTitle,
                        })}
                        finalFocus={false}
                      >
                        <MenuRadioGroup
                          value={filter.value}
                          onValueChange={(mode) => {
                            if (mode === "active") return;
                            void Promise.resolve(
                              filter.change(mode as SidebarFilter),
                            ).catch(() => {});
                            setMenuOpen(false);
                          }}
                        >
                          <MenuRadioItem
                            disabled={filter.disabled}
                            closeOnClick={false}
                            value="all"
                          >
                            <MenuIcon>
                              <ChatsCircleIcon size={14} />
                            </MenuIcon>
                            {t("shell.sidebar.all")}
                          </MenuRadioItem>
                          <MenuRadioItem
                            disabled={filter.disabled}
                            closeOnClick={false}
                            value="unreads"
                          >
                            <MenuIcon>
                              <ChatUnreadIcon size={14} />
                            </MenuIcon>
                            {t("sidebarSectionParent.unreads")}
                          </MenuRadioItem>
                          <MenuRadioItem
                            disabled={filter.disabled}
                            closeOnClick={false}
                            value="active"
                            onClick={() => {
                              setMenuOpen(false);
                              setActiveOpen(true);
                            }}
                          >
                            <MenuIcon>
                              <TimerIcon size={14} />
                            </MenuIcon>
                            {t("sidebarSectionDialogs.activeTitle")}
                            {filter.value === "active" && (
                              <MenuTrailing>
                                {t(
                                  activeDays === 1
                                    ? "sidebarSectionDialogs.day"
                                    : "sidebarSectionDialogs.days",
                                  { days: activeDays },
                                )}
                              </MenuTrailing>
                            )}
                          </MenuRadioItem>
                        </MenuRadioGroup>
                        {channels &&
                          filter.value !== "all" &&
                          channels.rows.length > 0 && (
                            <>
                              <MenuSeparator />
                              <MenuGroup>
                                <MenuGroupLabel emphasis="quiet">
                                  {filter.value === "unreads"
                                    ? t("sidebarSectionParent.noUnread")
                                    : t(
                                        activeDays === 1
                                          ? "sidebarSectionParent.noActivityDay"
                                          : "sidebarSectionParent.noActivityDays",
                                        { days: activeDays },
                                      )}
                                </MenuGroupLabel>
                                {channels.rows.map((channel) => {
                                  const select = () => {
                                    onToggle(true);
                                    channels.select(channel.id);
                                    setMenuOpen(false);
                                  };
                                  return session ? (
                                    <ChannelSidebarMenuItem
                                      key={channel.id}
                                      channel={channel}
                                      session={session}
                                      selected={
                                        channels.selected === channel.id
                                      }
                                      onSelect={select}
                                    />
                                  ) : (
                                    <MenuItem
                                      key={channel.id}
                                      aria-current={
                                        channels.selected === channel.id
                                          ? "page"
                                          : undefined
                                      }
                                      onClick={select}
                                    >
                                      {channel.name}
                                    </MenuItem>
                                  );
                                })}
                              </MenuGroup>
                            </>
                          )}
                      </MenuSubmenuPopup>
                    </MenuSubmenu>
                  )}
                  {sort && (
                    <MenuSubmenu>
                      <MenuSubmenuTrigger>
                        <MenuIcon>
                          <ArrowsDownUpIcon size={14} />
                        </MenuIcon>
                        {t("sidebarSectionParent.sort")}
                      </MenuSubmenuTrigger>
                      <MenuSubmenuPopup
                        aria-label={t("sidebarSectionParent.sortTitle", {
                          title: displayTitle,
                        })}
                        finalFocus={false}
                      >
                        <MenuRadioGroup
                          value={sort.value}
                          onValueChange={(mode) => {
                            sort.change(mode as SidebarSortMode);
                            setMenuOpen(false);
                          }}
                        >
                          <MenuRadioItem closeOnClick={false} value="recent">
                            <MenuIcon>
                              <TimerIcon size={14} />
                            </MenuIcon>
                            {t("sidebarSectionParent.recent")}
                          </MenuRadioItem>
                          <MenuRadioItem closeOnClick={false} value="alpha">
                            <MenuIcon>
                              <TextAaIcon size={14} />
                            </MenuIcon>
                            {t("sidebarSectionParent.alpha")}
                          </MenuRadioItem>
                          {sort.modes?.map((mode) => (
                            <MenuRadioItem
                              key={mode.id}
                              closeOnClick={false}
                              value={mode.id}
                            >
                              <MenuIcon>{null}</MenuIcon>
                              {mode.label}
                            </MenuRadioItem>
                          ))}
                        </MenuRadioGroup>
                      </MenuSubmenuPopup>
                    </MenuSubmenu>
                  )}
                  {createSection && (
                    <>
                      {(filter || sort) && <MenuSeparator />}
                      <MenuItem
                        disabled={!createSection.available}
                        onClick={() => {
                          setMenuOpen(false);
                          if (actionsTrigger.current)
                            createSection.open(actionsTrigger.current);
                        }}
                      >
                        <MenuIcon>
                          <PlusIcon size={14} />
                        </MenuIcon>
                        {t("sidebarSectionParent.createSection")}
                      </MenuItem>
                    </>
                  )}
                  {move && (
                    <>
                      <MenuItem
                        disabled={!move.up}
                        onClick={() => {
                          move.up?.();
                          setMenuOpen(false);
                        }}
                      >
                        <MenuIcon>
                          <ArrowUpIcon size={14} />
                        </MenuIcon>
                        {t("sidebarSectionParent.moveUp")}
                      </MenuItem>
                      <MenuItem
                        disabled={!move.down}
                        onClick={() => {
                          move.down?.();
                          setMenuOpen(false);
                        }}
                      >
                        <MenuIcon>
                          <ArrowDownIcon size={14} />
                        </MenuIcon>
                        {t("sidebarSectionParent.moveDown")}
                      </MenuItem>
                    </>
                  )}
                  {canRename && (
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        setRenameOpen(true);
                      }}
                    >
                      <MenuIcon>
                        <PencilSimpleIcon size={14} />
                      </MenuIcon>
                      {t("sidebarSectionDialogs.renameTitle")}
                    </MenuItem>
                  )}
                  {canRemove && (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        tone="danger"
                        onClick={() => {
                          setRemoveError("");
                          setMenuOpen(false);
                          setRemoveOpen(true);
                        }}
                      >
                        <MenuIcon>
                          <TrashIcon size={14} />
                        </MenuIcon>
                        {t("sidebarSectionParent.removeSection")}
                      </MenuItem>
                    </>
                  )}
                </MenuPopup>
              </MenuRoot>
            )}
            {headerActions}
            {newMessage && (
              <IconButton
                hint="familiar"
                size="compact"
                aria-label={t("directMessage.new")}
                title={t("directMessage.new")}
                onClick={newMessage}
                icon={<PlusIcon strokeWidth={2.5} size={15} />}
              />
            )}
            {activeOpen && filter && (
              <SidebarActiveDialog
                seconds={filter.activeWindowSeconds}
                apply={(seconds) => filter.change("active", seconds)}
                close={() => {
                  filter.dismissError?.();
                  setActiveOpen(false);
                }}
                finalFocus={actionsTrigger}
              />
            )}
            {renameOpen && onRename && (
              <RenameSidebarSection
                title={title}
                rename={onRename}
                close={() => setRenameOpen(false)}
                finalFocus={actionsTrigger}
              />
            )}
            {canRemove && (
              <Dialog
                size="compact"
                open={removeOpen}
                onOpenChange={setRemoveOpen}
                dismissOnOutsideClick
                preventClose={removing}
                initialFocus={cancelRemove}
                finalFocus={() =>
                  actionsTrigger.current?.isConnected
                    ? actionsTrigger.current
                    : (removalFocus?.() ?? false)
                }
                title={t("sidebarSectionParent.removeTitle", { title })}
                description={
                  channelCount === undefined
                    ? t("sidebarSectionParent.removeAssigned")
                    : t(
                        channelCount === 1
                          ? "sidebarSectionParent.removeOne"
                          : "sidebarSectionParent.removeMany",
                        { count: channelCount },
                      )
                }
                actions={
                  <>
                    <Button
                      ref={cancelRemove}
                      type="button"
                      disabled={removing}
                      onClick={() => setRemoveOpen(false)}
                    >
                      {t("channelForms.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      loading={removing}
                      onClick={() => void remove()}
                    >
                      {t("sidebarSectionParent.removeSection")}
                    </Button>
                  </>
                }
              >
                {removeError && <p role="alert">{removeError}</p>}
                {removing && (
                  <p role="status" className="sr-only">
                    {t("sidebarSectionParent.removing")}
                  </p>
                )}
              </Dialog>
            )}
            {createChannel && (
              <IconButton
                size="compact"
                aria-label={t("channelForms.create.action")}
                title={
                  createChannel.available
                    ? t("channelForms.create.action")
                    : t("sidebarSectionParent.creationUnavailable")
                }
                disabled={!createChannel.available}
                onClick={(event) => createChannel.open(event.currentTarget)}
                icon={<PlusIcon strokeWidth={2.5} size={15} />}
              />
            )}
          </>
        }
      >
        <details open={open}>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: summary has native keyboard activation. */}
          <summary
            ref={dragHandle?.ref}
            {...dragHandle?.listeners}
            aria-label={displayTitle}
            aria-controls={id}
            onClick={(event) => {
              event.preventDefault();
              onToggle(!open);
            }}
          >
            <span className={styles.sectionLabel}>
              {sectionKey === "starred" ? (
                <SidebarStarIcon />
              ) : typeof icon === "string" && session ? (
                <SidebarGroupIcon icon={icon} session={session} />
              ) : (
                icon
              )}
              <FadingLabel
                className={`${styles.sectionTitle} ${
                  persistentChevron ? styles.scopeSectionTitle : ""
                }`}
              >
                {displayTitle}
              </FadingLabel>
            </span>
            <span
              className={`${styles.sidebarIcon} ${styles.sectionChevron}`}
              data-navigation-reveal={persistentChevron ? undefined : ""}
            >
              <CaretDownIcon strokeWidth={2.5} size={15} />
            </span>
          </summary>
        </details>
      </NavigationSectionHeading>
      {headerNotice}
      <div
        id={id}
        className={styles.sectionContent}
        inert={!open}
        hidden={!open}
      >
        <div>{children}</div>
      </div>
    </div>
  );
}
