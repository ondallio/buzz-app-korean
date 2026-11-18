import { useEffect, useState } from "react";
import type { AgentViewProps } from "../../features/agents/service";
import { ActivityTranscript } from "../../features/agents/ActivityTranscript";
import { Button } from "../../shared/design-system/ui/Button";
import { Select } from "../../shared/design-system/ui/Select";
import { t, useLanguage } from "../../shared/i18n";
import { meshAgentConfig, type MeshAgentConfig } from "./meshAgent";
import type {
  GooseTranscript,
  MeshHistory,
  MeshHistoryRow,
} from "./meshTranscript";

/** The Agents/profile host owns framing and tabs; this body only reads history. */
export function createMeshTranscriptTab(
  history: Pick<MeshHistory, "recent" | "transcript">,
) {
  return function MeshTranscriptTab({
    agent,
    conversation,
  }: AgentViewProps<MeshAgentConfig>) {
    useLanguage();
    const workspace = meshAgentConfig(agent.config).workspace;
    const [rows, setRows] = useState<MeshHistoryRow[]>();
    const [selected, setSelected] = useState("");
    const [transcript, setTranscript] = useState<GooseTranscript>();
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [attempt, setAttempt] = useState(0);
    // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the explicit refresh.
    useEffect(() => {
      const abort = new AbortController();
      setRows(undefined);
      setSelected("");
      setTranscript(undefined);
      setError(undefined);
      setLoading(true);
      void history.recent(agent.key, workspace, abort.signal).then(
        (found) => {
          if (abort.signal.aborted) return;
          setRows(found);
          const nearby = found.find(
            (row) =>
              row.channelId === conversation?.channelId &&
              (!row.root || row.root === conversation?.rootId),
          );
          setSelected((nearby ?? found[0])?.sessionId ?? "");
          setLoading(false);
        },
        (reason: unknown) => {
          if (abort.signal.aborted) return;
          setError(String(reason));
          setLoading(false);
        },
      );
      return () => abort.abort();
    }, [
      agent.key,
      workspace,
      conversation?.channelId,
      conversation?.rootId,
      attempt,
    ]);
    useEffect(() => {
      const row = rows?.find((item) => item.sessionId === selected);
      if (!row) return;
      const abort = new AbortController();
      setLoading(true);
      setTranscript(undefined);
      setError(undefined);
      void history.transcript(agent.key, workspace, row, abort.signal).then(
        (found) => {
          if (abort.signal.aborted) return;
          setTranscript(found);
          setLoading(false);
        },
        (reason: unknown) => {
          if (abort.signal.aborted) return;
          setError(String(reason));
          setLoading(false);
        },
      );
      return () => abort.abort();
    }, [rows, selected, agent.key, workspace]);
    return (
      <div className="grid gap-4">
        <div>
          <Button
            variant="ghost"
            loading={loading}
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t("fubestie.transcript.refresh")}
          </Button>
        </div>
        {rows && rows.length > 0 && (
          <Select
            label={t("fubestie.transcript.session")}
            variant="field"
            value={selected}
            onValueChange={setSelected}
            groups={[
              {
                label: t("fubestie.transcript.recent"),
                options: rows.map((row) => ({
                  value: row.sessionId,
                  label: `${new Date(row.at).toLocaleString()} · ${row.root ? t("fubestie.transcript.thread") : t("fubestie.transcript.channel")} ${row.channelId.slice(0, 8)}`,
                })),
              },
            ]}
          />
        )}
        {error ? (
          <p role="alert" className="m-0 text-body-sm">
            {t("fubestie.transcript.readFailed", { error })}
          </p>
        ) : loading ? (
          <p role="status" className="m-0 text-body-sm text-subtle">
            {t("fubestie.transcript.reading")}
          </p>
        ) : rows?.length === 0 ? (
          <p className="m-0 text-body-sm text-subtle">
            {t("fubestie.transcript.none")}
          </p>
        ) : (
          transcript && (
            <ActivityTranscript
              transcript={transcript}
              agentName={agent.name}
              state={() => "unknown"}
              before={
                <p className="m-0 text-body-sm text-subtle">
                  {t("fubestie.transcript.snapshot")}
                  {transcript.more ? t("fubestie.transcript.latest50") : ""}
                </p>
              }
            />
          )
        )}
      </div>
    );
  };
}
