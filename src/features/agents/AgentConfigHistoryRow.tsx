import { t, useLanguage } from "../../shared/i18n";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Accordion } from "../../shared/design-system/ui/Accordion";
import styles from "./AgentConfigHistory.module.css";
import {
  AgentConfigHistory,
  AgentConfigVersionRow,
} from "./AgentConfigHistory";
import type {
  HistoryPresentation,
  HistorySelection,
} from "./history-presentation";
import { recalledHistory, type History } from "./agent-config-history";
import type { Agents, ConfigHistory } from "./service";

/** One settings disclosure; each track keeps its existing history owner. */
export function AgentConfigHistoryRow({
  agents,
  pubkey,
  presentation,
}: {
  agents: Pick<Agents, "configHistory" | "snapshot" | "subscribe">;
  pubkey: string;
  presentation?: HistoryPresentation | undefined;
}) {
  useSyncExternalStore(agents.subscribe, agents.snapshot);
  const history = agents.configHistory(pubkey);
  return history ? (
    <ConfigHistoryRow
      key={pubkey}
      history={history}
      presentation={presentation}
    />
  ) : null;
}

/** Previous versions of each side `history` has. */
export function ConfigHistoryRow({
  history,
  presentation,
}: {
  history: ConfigHistory;
  presentation?: HistoryPresentation | undefined;
}) {
  useLanguage();
  const [localSelection, select] = useState<HistorySelection>();
  const selected = presentation ? presentation.selected : localSelection;
  const setSelected = presentation?.select ?? select;
  const [expanded, setExpanded] = useState<string[]>(() =>
    selected || presentation?.active ? ["Previous versions"] : [],
  );
  const selectionId = selected?.id;
  const active = presentation?.active;
  useEffect(() => {
    if (selectionId || active) setExpanded(["Previous versions"]);
  }, [selectionId, active]);
  const [counts, setCounts] = useState<
    Partial<Record<"settings" | "instructions", History>>
  >(() =>
    Object.fromEntries(
      history.sides.flatMap((track) => {
        const loaded = recalledHistory(
          history.read,
          track.expected,
          track.head,
          track.version,
        );
        return loaded ? [[track.side, loaded]] : [];
      }),
    ),
  );
  const settingsChanged = useCallback((value: History) => {
    setCounts((current) => ({ ...current, settings: value }));
  }, []);
  const instructionsChanged = useCallback((value: History) => {
    setCounts((current) => ({ ...current, instructions: value }));
  }, []);
  const tracks = history.sides.map(({ side }) => counts[side]);
  const count = tracks.reduce(
    (total, track) => total + (track?.revisions.length ?? 0),
    0,
  );
  const summary = tracks.some(
    (track) => !track || (!track.next && !track.failed),
  )
    ? t("v1agent.history.loadingVersions")
    : tracks.some((track) => track?.failed)
      ? t("v1agent.history.countUnavailable")
      : t(
          tracks.some((track) => !track?.done)
            ? "v1agent.history.versionsMore"
            : count === 1
              ? "v1agent.history.versionOne"
              : "v1agent.history.versions",
          { count },
        );
  const revisions = history.sides
    .flatMap((track) => {
      const loaded = counts[track.side];
      const events =
        loaded && (loaded.next || loaded.failed)
          ? loaded.revisions
          : track.head
            ? [track.head]
            : [];
      return events.map((event) => ({ track, event }));
    })
    .sort(
      (a, b) =>
        b.event.created_at - a.event.created_at ||
        a.event.id.localeCompare(b.event.id),
    );
  return (
    <Accordion
      variant="settings"
      keepMounted
      value={expanded}
      onValueChange={setExpanded}
      items={[
        {
          value: "Previous versions",
          title: (
            <span className="flex items-center justify-between gap-3 text-body-sm text-left">
              <span>{t("v1agent.history.previous")}</span>
              <span className="text-secondary">{summary}</span>
            </span>
          ),
          content: (
            <div className="grid gap-2">
              <ol
                className={styles.list}
                aria-label={t("v1agent.history.previous")}
              >
                {revisions.map(({ track, event }) => (
                  <AgentConfigVersionRow
                    key={`${track.side}/${event.id}`}
                    event={event}
                    label={
                      track.side === "settings"
                        ? t("agentsBrowse.settings")
                        : t("agentCreate.instructions")
                    }
                    head={track.head}
                    expected={track.expected}
                    settings={
                      track.side === "settings" ? history.settings : undefined
                    }
                    onSelect={() =>
                      setSelected({ side: track.side, id: event.id })
                    }
                  />
                ))}
              </ol>
              {history.sides.map(({ side, expected, head, version }) => (
                <AgentConfigHistory
                  key={`${expected.channel}/${expected.d}`}
                  selected={selected?.side === side ? selected.id : undefined}
                  onSelect={(id) => setSelected(id ? { side, id } : undefined)}
                  title={
                    side === "settings"
                      ? t("agentsBrowse.settings")
                      : t("agentCreate.instructions")
                  }
                  expected={expected}
                  head={head}
                  version={version}
                  read={history.read}
                  {...(side === "settings" && history.settings
                    ? { settings: history.settings }
                    : {})}
                  onRevert={(template) => history.revise(side, template)}
                  onHistoryChange={
                    side === "settings" ? settingsChanged : instructionsChanged
                  }
                />
              ))}
            </div>
          ),
        },
      ]}
    />
  );
}
