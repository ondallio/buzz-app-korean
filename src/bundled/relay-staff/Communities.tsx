import { useState } from "react";
import { t, useLanguage } from "../../shared/i18n";
import { Button } from "../../shared/design-system/ui/Button";
import { SearchField } from "../../shared/design-system/ui/SearchField";
import { Tabs } from "../../shared/design-system/ui/Tabs";
import { ArrowLeftIcon } from "../../shared/design-system/icons";
import {
  type CommunityDto,
  unsupported,
} from "../../features/relay-staff/contract";
import { ActionsSection, MembersSection } from "./DirectActions";
import { Reports } from "./Reports";
import { Restrictions } from "./Restrictions";
import { usePages, useRead, useSession } from "./session";
import {
  CommunityBadge,
  containsSecretKey,
  Failure,
  listButton,
  Loading,
  NotConnected,
  secretKeyWarning,
  unsupportedBrowsing,
  useRetry,
  type CommunityRef,
} from "./ui";
import { searchable, useDebounced } from "../../shared/search-debounce";

/**
 * The relay's community directory, searched by host prefix, with the
 * connected community pinned by exact host whatever page is loaded.
 */
export function Communities({
  connectedHost,
  onOpen,
}: {
  connectedHost: string;
  onOpen(community: CommunityRef): void;
}) {
  useLanguage();
  const { context } = useSession();
  const [query, setQuery] = useState("");
  const settled = useDebounced(query.trim().toLowerCase());
  // Text too short to search lists every community.
  const q = searchable(settled) ? settled : "";
  // A pasted secret key never leaves the device, in a search or a cursor.
  const secret = containsSecretKey(query) || containsSecretKey(q);
  const pages = usePages(
    secret
      ? null
      : (cursor) => ({
          route: "listCommunities",
          ...(q ? { q } : {}),
          ...(cursor ? { cursor } : {}),
        }),
    [context, q, secret],
  );
  // A failed later page retries that page; a failed first load starts over.
  const retry = useRetry(
    pages.failure,
    pages.settled,
    pages.next ? pages.more : pages.restart,
  );
  const [pinnedRead, reloadPinned] = useRead(
    connectedHost ? { route: "listCommunities", q: connectedHost } : null,
    [context, connectedHost],
  );
  const pinned =
    connectedHost && pinnedRead.state === "ok"
      ? (pinnedRead.value.items.find((c) => c.host === connectedHost) ?? null)
      : null;
  const shownPinned = pinned?.host.toLowerCase().startsWith(q) ? pinned : null;
  const pinnedRetry = useRetry(
    pinnedRead.state === "failed" ? pinnedRead.failure : null,
    pinnedRead.settled,
    reloadPinned,
  );

  const items = secret
    ? []
    : pages.items.filter((c) => c.id !== shownPinned?.id);
  const row = (community: CommunityDto, connected: boolean) => (
    <li key={community.id}>
      <button
        type="button"
        className={`${listButton} flex items-center gap-2`}
        onClick={() => onOpen({ id: community.id, host: community.host })}
      >
        <span className="flex-1 truncate">{community.host}</span>
        {connected && (
          <span className="text-caption text-secondary">
            {t("furs.connected")}
          </span>
        )}
      </button>
    </li>
  );

  return (
    <div className="flex flex-col gap-3">
      <SearchField
        label={t("furs.searchCommunities")}
        placeholder={t("furs.searchPlaceholder")}
        value={query}
        onValueChange={setQuery}
      />
      {secret && (
        <p className="text-body-sm text-danger" role="alert">
          {secretKeyWarning()}
        </p>
      )}
      {/* The directory's own alert already explains a missing route. */}
      {pinnedRetry.failure && !unsupported(pinnedRetry.failure) && (
        <Failure
          failure={pinnedRetry.failure}
          onRetry={pinnedRetry.retry}
          retrying={pinnedRetry.retrying}
        />
      )}
      {shownPinned && <ul>{row(shownPinned, true)}</ul>}
      {retry.failure && (
        <Failure
          failure={retry.failure}
          unsupportedText={unsupportedBrowsing()}
          onRetry={retry.retry}
          retrying={retry.retrying}
        />
      )}
      {!secret &&
        !pages.loading &&
        !pages.failure &&
        items.length === 0 &&
        !shownPinned && (
          <p className="text-body-sm text-secondary">
            {t("furs.noCommunities")}
          </p>
        )}
      <ul className="flex flex-col gap-1">{items.map((c) => row(c, false))}</ul>
      {pages.loading && <Loading />}
      {!secret && pages.next && !pages.loading && (
        <div>
          <Button size="sm" variant="outline" onClick={pages.more}>
            {t("furs.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

const SECTIONS = [
  { value: "reports", label: "furs.section.reports" },
  { value: "restrictions", label: "furs.section.restrictions" },
  { value: "members", label: "furs.section.members" },
  { value: "actions", label: "furs.section.actions" },
] as const;
type Section = (typeof SECTIONS)[number]["value"];

/** One community's Reports, Restrictions, Members and Actions, by its host. */
export function CommunityPage({
  community,
  onBack,
}: {
  community: CommunityRef;
  onBack(): void;
}) {
  useLanguage();
  const [section, setSection] = useState<Section>("reports");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("furs.back")}
          onClick={onBack}
        >
          <ArrowLeftIcon />
        </Button>
        <CommunityBadge id={community.id} host={community.host} />
        <NotConnected host={community.host} />
      </div>
      <Tabs
        label={t("furs.communitySections")}
        variant="panel"
        value={section}
        onValueChange={setSection}
        items={SECTIONS.map((item) => ({ ...item, label: t(item.label) }))}
        renderPanel={(value) =>
          value === "reports" ? (
            <Reports communityId={community.id} />
          ) : value === "restrictions" ? (
            <Restrictions communityHost={community.host} />
          ) : value === "members" ? (
            <MembersSection
              communityHost={community.host}
              onAct={() => setSection("actions")}
            />
          ) : (
            <ActionsSection community={community} />
          )
        }
      />
    </div>
  );
}
