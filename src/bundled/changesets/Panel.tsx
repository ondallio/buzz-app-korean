import { useEffect, useMemo, useState } from "react";
import { t, useLanguage } from "../../shared/i18n";
import type { PanelProps } from "../../features/panels/service";
import {
  CaretLeftIcon,
  CaretRightIcon,
} from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { LoadingRegion } from "../../shared/design-system/ui/LoadingRegion";
import { Select } from "../../shared/design-system/ui/Select";
import { DiffViewer } from "../diffs/DiffViewer";
import { parsePatch } from "../diffs/parse";
import type { ChangedFile } from "./git";
import { parseTarget } from "./target";
import type { Turns } from "./turns";
import { Counts, fileCount, totals } from "./Counts";
import styles from "./Changesets.module.css";
import { useLoaded } from "./useLoaded";

/** A recorded turn's checkout: its files, one diff at a time. */
export function ChangesetPanel({
  target,
  turns,
}: Pick<PanelProps, "target"> & { turns: Turns }) {
  useLanguage();
  const link = useMemo(() => parseTarget(target), [target]);
  const found = link && turns.find(link.turn, link.checkout);
  const [chosen, setChosen] = useState(link?.file);
  useEffect(() => setChosen(link?.file), [link?.file]);
  const listed = useLoaded(
    link ? () => turns.summary(link.turn, link.checkout) : undefined,
    [turns, link],
  );
  const files = listed.value;
  const index = files
    ? Math.max(
        0,
        files.findIndex((each) => each.path === chosen),
      )
    : 0;
  const file = files?.[index];
  const patch = useLoaded(
    link && file && !file.binary
      ? () => turns.patch(link.turn, link.checkout, file)
      : undefined,
    [turns, link, file],
  );
  const parsed = useMemo(
    () => (patch.value === undefined ? undefined : parsePatch(patch.value)),
    [patch.value],
  );
  if (!link || !found)
    return <p role="alert">{t("u275f00.changes.elsewhere")}</p>;
  const pending = listed.error === undefined && !files;
  const step = (by: number) => files && setChosen(files[index + by]?.path);
  return (
    <div className={styles.panel}>
      <InlineHeader
        level={3}
        title={found.checkout.label}
        subtitle={
          files ? (
            <>
              {t("u275f00.changes.changed", {
                files: fileCount(files.length),
              })}{" "}
              <Counts {...totals(files)} />
            </>
          ) : undefined
        }
      />
      <LoadingRegion
        pending={pending}
        label={t("u275f00.changes.reading")}
        statusVisibility="screen-reader"
        feedback={
          listed.error !== undefined ? (
            <div role="alert">
              <p>{t("u275f00.changes.readFailed", { error: listed.error })}</p>
              {listed.retry && (
                <Button size="sm" variant="ghost" onClick={listed.retry}>
                  {t("u275f00.changes.retry")}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {files && file && (
          <>
            {files.length > 1 && (
              <div className={styles.picker}>
                <Select
                  label={t("u275f00.changes.file.label")}
                  variant="compact"
                  value={file.path}
                  onValueChange={setChosen}
                  groups={[
                    {
                      label: t("u275f00.changes.changedFiles"),
                      options: files.map((each) => ({
                        value: each.path,
                        label: each.path,
                      })),
                    },
                  ]}
                />
                <IconButton
                  aria-label={t("u275f00.changes.previousFile")}
                  icon={<CaretLeftIcon size={16} aria-hidden="true" />}
                  disabled={index === 0}
                  onClick={() => step(-1)}
                />
                <IconButton
                  aria-label={t("u275f00.changes.nextFile")}
                  icon={<CaretRightIcon size={16} aria-hidden="true" />}
                  disabled={index === files.length - 1}
                  onClick={() => step(1)}
                />
              </div>
            )}
            <FileDiff file={file} patch={patch} parsed={parsed} />
          </>
        )}
      </LoadingRegion>
    </div>
  );
}

function FileDiff({
  file,
  patch,
  parsed,
}: {
  file: ChangedFile;
  patch: {
    value?: string | undefined;
    error?: string | undefined;
    retry?: (() => void) | undefined;
  };
  parsed: ReturnType<typeof parsePatch>;
}) {
  if (file.binary)
    return <p className="text-body-sm">{t("u275f00.changes.binaryFile")}</p>;
  if (patch.error !== undefined)
    return (
      <div role="alert">
        <p className="text-body-sm">{patch.error}</p>
        {patch.retry && (
          <Button size="sm" variant="ghost" onClick={patch.retry}>
            {t("u275f00.changes.retry")}
          </Button>
        )}
      </div>
    );
  if (patch.value === undefined)
    return (
      <p className="text-body-sm">
        {t("u275f00.changes.readingFile", { path: file.path })}
      </p>
    );
  return (
    <DiffViewer content={patch.value} files={parsed} filePath={file.path} />
  );
}
