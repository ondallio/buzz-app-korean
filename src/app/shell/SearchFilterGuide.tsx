import {
  CalendarIcon,
  ChatCircleIcon,
  HashIcon,
  RobotIcon,
  UserIcon,
} from "../../shared/design-system/icons/index";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import { ValueChip } from "../../shared/design-system/ui/ValueChip";
import { t } from "../../shared/i18n";

/** A filter the guide teaches, with what Enter on its row types. */
export type GuideFilter = {
  key: "from" | "in" | "during" | "before" | "after" | "on" | "ask" | "phrase";
  label: string;
  /** What the row's Enter types, which opens that filter's own picker. */
  syntax: string;
  about: string;
  /** Complete filters to try, each with what it finds. */
  examples: readonly (readonly [example: string, meaning: string])[];
  icon: typeof UserIcon;
};

/**
 * The filters search reads, in plain words. `channel` names a real channel
 * for the `in:` example; `agent` is who `ask:` asks, by name once known.
 * Searching one conversation already has its `in:`.
 */
export function guideFilters({
  channel,
  ask,
  agent,
  scoped,
}: {
  channel?: string | undefined;
  /** Whether `ask:` can start a chat here. */
  ask: boolean;
  agent?: string | undefined;
  scoped: boolean;
}): GuideFilter[] {
  const filters: (GuideFilter | false)[] = [
    {
      key: "from",
      label: t("v106sh.guide.from"),
      syntax: "from:",
      about: t("v106sh.guide.fromAbout"),
      examples: [["from:me", t("v106sh.guide.fromMe")]],
      icon: UserIcon,
    },
    !scoped && {
      key: "in",
      label: t("v106sh.guide.in"),
      syntax: "in:",
      about: t("v106sh.guide.inAbout"),
      examples: channel
        ? [[`in:#${channel}`, t("v106sh.guide.inChannel", { channel })]]
        : [],
      icon: HashIcon,
    },
    ask && {
      key: "ask",
      label: t("v105shell.search.ask", {
        name: agent ?? t("v105shell.search.yourAgent"),
      }),
      syntax: "ask:",
      about: agent
        ? t("v106sh.guide.askAbout", { name: agent })
        : t("v106sh.guide.askAboutDefault"),
      examples: [["ask: what did we ship?", t("v106sh.guide.askQuestion")]],
      icon: RobotIcon,
    },

    {
      key: "during",
      label: t("v106sh.guide.during"),
      syntax: "during:",
      about: t("v106sh.guide.duringAbout"),
      examples: [
        ["during:today", t("date.today")],
        ["during:7d", t("v105shell.search.past7Days")],
        ["during:march", t("v106sh.guide.inMarch")],
        [`during:${new Date().getFullYear()}`, t("search.thisYear")],
      ],
      icon: CalendarIcon,
    },
    {
      key: "before",
      label: t("v106sh.guide.before"),
      syntax: "before:",
      about: t("v106sh.guide.beforeAbout"),
      examples: [["before:today", t("v106sh.guide.beforeToday")]],
      icon: CalendarIcon,
    },
    {
      key: "after",
      label: t("v106sh.guide.after"),
      syntax: "after:",
      about: t("v106sh.guide.afterAbout"),
      examples: [["after:yesterday", t("v106sh.guide.sinceYesterday")]],
      icon: CalendarIcon,
    },
    {
      key: "on",
      label: t("v106sh.guide.on"),
      syntax: "on:",
      about: t("v106sh.guide.onAbout"),
      examples: [["on:yesterday", t("date.yesterday")]],
      icon: CalendarIcon,
    },
    {
      key: "phrase",
      label: t("v106sh.guide.phrase"),
      syntax: '"',
      about: t("v106sh.guide.phraseAbout"),
      examples: [
        ['"release notes"', t("v106sh.guide.thatPhrase")],
        ["-draft", t("v106sh.guide.withoutDraft")],
      ],
      icon: ChatCircleIcon,
    },
  ];
  return filters.filter((filter) => !!filter);
}

/** What a filter's row types, as the guide shows it. */
export const syntaxOf = (filter: GuideFilter) =>
  filter.key === "phrase" ? "“…”" : filter.syntax;

/** A filter as it's typed, led by a dot in the hue of its operator. */
export function FilterSyntax({
  text,
  operator = text.slice(0, text.indexOf(":")),
}: {
  text: string;
  operator?: string;
}) {
  return (
    <ValueChip
      icon={
        <svg
          viewBox="0 0 12 12"
          className="search-guide-dot"
          data-operator={operator}
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="3" />
        </svg>
      }
    >
      <code>{text}</code>
    </ValueChip>
  );
}

/** What a filter finds, with examples to try. */
export function FilterGuidePreview({
  filter,
  onTry,
}: {
  filter: GuideFilter;
  onTry: (example: string) => void;
}) {
  return (
    <div className="search-peek-card">
      <div className="search-peek-summary">
        <div className="search-peek-head">
          <FilterSyntax operator={filter.key} text={syntaxOf(filter)} />
          <span className="search-peek-title text-label">{filter.label}</span>
        </div>
        <p className="search-peek-about text-body-sm">{filter.about}</p>
      </div>
      {filter.examples.length > 0 && (
        <div className="search-guide-examples">
          <span className="text-label-sm text-subtle">
            {t("v106sh.guide.try")}
          </span>
          <div className="search-guide-tries">
            {filter.examples.map(([example, meaning]) => (
              <NavigationItem
                key={example}
                variant="option"
                multiline
                // The field keeps focus, so typing carries on after the example.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onTry(example)}
                label={
                  <>
                    <FilterSyntax operator={filter.key} text={example} />{" "}
                    <span className="text-body-sm text-subtle">{meaning}</span>
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
