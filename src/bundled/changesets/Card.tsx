import { useEffect, useState, useSyncExternalStore } from "react";
import { t, useLanguage } from "../../shared/i18n";
import type { ComposerAccessoryProps } from "../../features/conversation/contracts";
import { Button } from "../../shared/design-system/ui/Button";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import { targetFor } from "./target";
import type { Turn, TurnCheckout, Turns } from "./turns";
import { Counts, fileCount, totals } from "./Counts";
import styles from "./Changesets.module.css";
import { useLoaded } from "./useLoaded";

const FIRST = 8;

/** Under an agent's last message in a turn: a card for each checkout the turn
 * changed. Nothing for any other message. */
export function TurnCards({
  turns,
  message,
  canOpen,
  open,
}: ComposerAccessoryProps & { turns: Turns }) {
  useSyncExternalStore(turns.subscribe, turns.version);
  useEffect(() => {
    if (message) turns.claim(message);
  });
  const cards = message ? turns.cardsFor(message.id) : [];
  if (!cards.length) return null;
  return (
    <div className={styles.cards}>
      {cards.flatMap((turn) =>
        turn.checkouts.map((checkout, index) =>
          checkout.files ? (
            <ChangesetCard
              key={`${turn.id}:${checkout.dir}:${checkout.prefix}`}
              turns={turns}
              turn={turn}
              checkout={checkout}
              index={index}
              canOpen={canOpen}
              open={open}
            />
          ) : null,
        ),
      )}
    </div>
  );
}

function ChangesetCard({
  turns,
  turn,
  checkout,
  index,
  canOpen,
  open,
}: {
  turns: Turns;
  turn: Turn;
  checkout: TurnCheckout;
  index: number;
  canOpen(target: string): boolean;
  open(target: string): boolean;
}) {
  useLanguage();
  const [all, setAll] = useState(false);
  const {
    value: files,
    error,
    retry,
  } = useLoaded(() => turns.summary(turn.id, index), [turns, turn.id, index]);
  const shown = files && !all ? files.slice(0, FIRST) : files;
  const sum = files && totals(files);
  const opens = canOpen(targetFor(turn.id, index));
  return (
    <section
      className={styles.card}
      aria-label={t("u275f00.changes.card", { label: checkout.label })}
    >
      <InlineHeader
        level={4}
        title={checkout.label}
        subtitle={
          files && sum ? (
            <>
              {t("u275f00.changes.changed", {
                files: fileCount(files.length),
              })}{" "}
              <Counts {...sum} />
            </>
          ) : (
            fileCount(checkout.files ?? 0)
          )
        }
      />
      {checkout.late && (
        <p className={styles.note}>{t("u275f00.changes.late")}</p>
      )}
      {checkout.shared && (
        <p className={styles.note}>{t("u275f00.changes.shared")}</p>
      )}
      {error && (
        <div role="alert" className={styles.note}>
          <p>{t("u275f00.changes.readFailed", { error })}</p>
          {retry && (
            <Button size="sm" variant="ghost" onClick={retry}>
              {t("u275f00.changes.retry")}
            </Button>
          )}
        </div>
      )}
      {shown && (
        <ul
          className={styles.files}
          aria-label={t("u275f00.changes.changedFiles")}
        >
          {shown.map((file) => (
            <li key={file.path}>
              <NavigationItem
                variant="row"
                label={file.path}
                title={file.from ? `${file.from} → ${file.path}` : file.path}
                disabled={!opens}
                onClick={() => open(targetFor(turn.id, index, file.path))}
                trailing={
                  file.binary ? (
                    t("u275f00.changes.binary")
                  ) : (
                    <Counts {...file} />
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      {files && files.length > FIRST && (
        <Button size="sm" variant="ghost" onClick={() => setAll(!all)}>
          {all
            ? t("u275f00.changes.fewer")
            : t("u275f00.changes.all", { count: String(files.length) })}
        </Button>
      )}
    </section>
  );
}
