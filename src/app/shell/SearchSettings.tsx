import {
  t,
  translate,
  useLanguage,
  languagePreference,
} from "../../shared/i18n";
import { pluginCategoryDefinitions } from "../plugin-categories";
import { GearIcon, SquaresFourIcon } from "../../shared/design-system/icons";
import { useEffect, useSyncExternalStore } from "react";
import type { AppServices } from "../services";
import type { SearchDestination, SearchGroup } from "./SearchChoices";
import { MatchRank, matchName, matchRank } from "../../features/search/match";
import { settingsSections } from "../settings-sections";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { SwitchPreferenceRow } from "../../shared/design-system/ui/SwitchPreferenceRow";
import { Select } from "../../shared/design-system/ui/Select";
import { Button } from "../../shared/design-system/ui/Button";

const entries = [
  {
    id: "mode",
    label: "Color mode",
    section: "Appearance",
    keywords: "theme light dark system",
  },
  {
    id: "sound",
    label: "Sound",
    section: "Notifications",
    keywords: "audio mute alerts",
  },
  {
    id: "viewing",
    label: "Notify while viewing",
    section: "Notifications",
    keywords: "direct messages conversation alerts",
  },
] as const;

const noSubscribe = () => () => {};
const noSnapshot = () => null;

/** A section opens Settings on Enter, so letters merely in order do not match
 * it: "wes" would find Software updates before a person Wes is found. Word
 * runs still do, as in channel completion. */
function matchSection(label: string, needle: string) {
  const found = matchName(label, needle);
  return found && found.rank <= MatchRank.wordRuns ? found : undefined;
}

function controlDestination(
  key: string,
  label: string,
  detail: string,
  content: import("react").ReactNode,
  rank: number,
): SearchDestination {
  return {
    key,
    label,
    detail,
    icon: GearIcon,
    content,
    rank,
    run: () => {
      const control = document
        .getElementById(key)
        ?.querySelector<HTMLElement>('[role="switch"], [role="combobox"]');
      if (
        control?.getAttribute("aria-disabled") === "true" ||
        control?.hasAttribute("disabled")
      )
        return;
      control?.focus();
    },
  };
}

export function useSearchSettings({
  query,
  appearance,
  notifications,
  plugins,
  adminAccess,
  settingsCards,
  communities,
  navigation,
  close,
  openSection,
}: {
  navigation: AppServices["navigation"];
  close: () => void;
  /** Opens Settings at a section, scoped to the selected community. */
  openSection: (section: string) => void;
  settingsCards?: AppServices["settingsCards"] | undefined;
  communities?: AppServices["communities"] | undefined;
  plugins?: AppServices["plugins"] | undefined;
  adminAccess?: AppServices["adminAccess"] | undefined;
  query: string;
  appearance?: AppServices["appearance"] | undefined;
  notifications?: AppServices["notifications"] | undefined;
}): SearchGroup[] {
  const language = useLanguage();
  const pluginState = useSyncExternalStore(
    plugins?.subscribe ?? noSubscribe,
    plugins?.snapshot ?? noSnapshot,
  );
  useEffect(() => adminAccess?.ensure(), [adminAccess]);
  // The cards snapshot lists only cards whose visibility has settled visible.
  useEffect(() => settingsCards?.retainVisibility(), [settingsCards]);
  const cards = useSyncExternalStore(
    settingsCards?.subscribe ?? noSubscribe,
    settingsCards?.snapshot ?? noSnapshot,
  );
  const client = useSyncExternalStore(
    communities?.subscribe ?? noSubscribe,
    communities?.snapshot ?? noSnapshot,
  );
  const moderationAccess = useSyncExternalStore(
    adminAccess?.subscribe ?? noSubscribe,
    () => adminAccess?.status("buzz.moderation") ?? "unavailable",
  );
  const staffAccess = useSyncExternalStore(
    adminAccess?.subscribe ?? noSubscribe,
    () => adminAccess?.status("buzz.relay-staff") ?? "unavailable",
  );
  const needle = query.trim().toLowerCase();
  const community = cards
    ? client?.memberships.find(({ id }) => id === client.selected)
    : undefined;
  const english = cards ? settingsSections(cards, community, "en") : undefined;
  const korean = cards ? settingsSections(cards, community, "ko") : undefined;
  if (!needle) return [];
  // The same sections as the Settings sidebar, ahead of their own controls.
  const sections: SearchDestination[] = cards
    ? settingsSections(cards, community, language).groups.flatMap((group) =>
        group.sections.flatMap((section) => {
          const match = matchSection(section.label, needle);
          // A group label such as "Buzz" or "Community" names many sections,
          // so it ranks a step behind a section's own label, as a plugin's
          // category does.
          const sectionAliases = [english, korean].flatMap(
            (projection) =>
              projection?.sections.find((item) => item.id === section.id)
                ?.label ?? [],
          );
          const groupAliases = [english, korean].flatMap(
            (projection) =>
              projection?.groups.find((item) => item.id === group.id)?.label ??
              [],
          );
          const rank = Math.min(
            ...sectionAliases.map(
              (label) => matchSection(label, needle)?.rank ?? Infinity,
            ),
            ...groupAliases.map(
              (label) => (matchSection(label, needle)?.rank ?? Infinity) + 1,
            ),
            match?.rank ?? Infinity,
            (matchSection(group.label, needle)?.rank ?? Infinity) + 1,
          );
          if (!Number.isFinite(rank)) return [];
          return [
            {
              key: "search-section-" + section.id,
              label: section.label,
              detail: group.label,
              icon: section.icon ?? GearIcon,
              rank,
              ...(match?.positions.length ? { matches: match.positions } : {}),
              run: () => openSection(section.id),
            },
          ];
        }),
      )
    : [];
  const controls = entries.flatMap((entry) => {
    if (!(entry.id === "mode" ? appearance : notifications)) return [];
    const rank = Math.min(
      matchRank(entry.label, needle) ?? Infinity,
      matchRank(entryLabel(entry.id, "ko"), needle) ?? Infinity,
      matchRank(
        translate(
          "ko",
          entry.id === "mode"
            ? "navigation.appearance"
            : "navigation.notifications",
        ),
        needle,
      ) ?? Infinity,
      matchRank(entry.section, needle) ?? Infinity,
      (matchRank(entry.keywords + " settings", needle) ?? Infinity) + 1,
    );
    if (!Number.isFinite(rank)) return [];
    const key = "search-setting-" + entry.id;
    return [
      {
        ...controlDestination(
          key,
          translate(
            language,
            entry.id === "mode"
              ? "navigation.appearance"
              : "navigation.notifications",
          ),
          entryLabel(entry.id, language),
          entry.id === "mode" && appearance ? (
            <ColorMode appearance={appearance} />
          ) : notifications && entry.id !== "mode" ? (
            <NotificationPreference
              notifications={notifications}
              entry={entry}
            />
          ) : null,
          rank,
        ),
        run: () => {
          close();
          const section = entry.id === "mode" ? "appearance" : "notifications";
          void navigation
            .open({ version: 1, kind: "settings", section })
            .then((result) => {
              if (result.status !== "opened") return;
              const target = document.getElementById(`setting-${entry.id}`);
              const row =
                target?.closest<HTMLElement>(".buzz-preference-row") ??
                document.getElementById("setting-delivery");
              if (
                !row ||
                row.closest('[hidden], [inert], [aria-hidden="true"]')
              )
                return;
              row.scrollIntoView({ block: "center", behavior: "instant" });
              const control = row.querySelector<HTMLElement>(
                '[role="switch"]:not([aria-disabled="true"]), [role="combobox"]:not([aria-disabled="true"]), button:not(:disabled), input:not(:disabled)',
              );
              if (!control) row.tabIndex = -1;
              (control ?? row).focus({ preventScroll: true });
              row.classList.remove("settings-search-highlight");
              void row.offsetWidth;
              row.classList.add("settings-search-highlight");
              row.addEventListener(
                "animationend",
                () => row.classList.remove("settings-search-highlight"),
                { once: true },
              );
            });
        },
      },
    ];
  });
  const settings = [...sections, ...controls].sort(
    (a, b) => (a.rank ?? 0) - (b.rank ?? 0),
  );
  const pluginRows =
    plugins && pluginState?.configuration.status === "ready"
      ? pluginState.configuration.catalog.plugins
          .flatMap((plugin) => {
            const category =
              pluginCategoryDefinitions.find(
                (item) => item.id === plugin.manifest.discovery?.category,
              )?.label ?? "Other";
            const rank = Math.min(
              matchRank(plugin.manifest.name, needle) ?? Infinity,
              (matchRank(category, needle) ?? Infinity) + 1,
              (matchRank(categoryLabel(category, "ko"), needle) ?? Infinity) +
                1,
              (matchRank("plugins " + plugin.manifest.description, needle) ??
                Infinity) + 2,
            );
            if (!Number.isFinite(rank)) return [];
            const restricted =
              plugin.source === "bundled" &&
              (plugin.manifest.id === "buzz.moderation" ||
                plugin.manifest.id === "buzz.relay-staff");
            const access =
              plugin.manifest.id === "buzz.moderation"
                ? moderationAccess
                : staffAccess;
            const blocked =
              pluginState.busy ||
              (!plugin.enabled && restricted && access !== "allowed");
            const key = "search-plugin-" + plugin.manifest.id;
            const failure =
              plugin.error ??
              (pluginState.activation[plugin.manifest.id]?.revision ===
              plugin.revision
                ? pluginState.activation[plugin.manifest.id]?.error
                : null);
            return [
              controlDestination(
                key,
                categoryLabel(category, language),
                plugin.manifest.name,
                <>
                  {plugin.manifest.id === "buzz.channels" ? (
                    <PreferenceRow
                      variant="search"
                      icon={<SquaresFourIcon size={21} />}
                      title={categoryLabel(category, language)}
                      subtitle={plugin.manifest.name}
                      trailing={
                        <span className="text-body-sm text-subtle">
                          {t("search.required")}
                        </span>
                      }
                    />
                  ) : (
                    <SwitchPreferenceRow
                      variant="search"
                      icon={<SquaresFourIcon size={21} />}
                      label={categoryLabel(category, language)}
                      description={plugin.manifest.name}
                      aria-label={t("search.enablePlugin", {
                        name: plugin.manifest.name,
                      })}
                      checked={plugin.enabled}
                      readOnly={blocked}
                      aria-disabled={blocked}
                      onCheckedChange={() => {
                        if (
                          !pluginState.busy &&
                          (plugin.enabled ||
                            !restricted ||
                            adminAccess?.status(plugin.manifest.id) ===
                              "allowed")
                        )
                          void plugins.change(
                            plugin.enabled ? "disable" : "enable",
                            plugin.manifest.id,
                          );
                      }}
                    />
                  )}
                  {failure && (
                    <p role="alert" className="text-body-sm text-subtle">
                      {failure}
                    </p>
                  )}
                </>,
                rank,
              ),
            ];
          })
          .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      : [];
  // Each group ranks by its best row, not by its own label, which is just as
  // generic: "plugins" leads with Manage plugins, not the Plugins switches.
  return [
    {
      id: "Settings",
      label: t("shell.profile.settings"),
      rank: settings[0]?.rank ?? Infinity,
      destinations: settings,
    },
    {
      id: "Plugins",
      label: t("navigation.plugins"),
      rank: pluginRows[0]?.rank ?? Infinity,
      destinations: pluginRows,
      notice: (
        <>
          {pluginState?.error && (
            <p role="alert" className="text-body-sm text-subtle">
              {pluginState.error}
            </p>
          )}
          {pluginState?.configuration.status === "ready" &&
            pluginState.configuration.externalPluginsPaused && (
              <p className="text-body-sm text-subtle">
                {t("search.externalPaused")}
              </p>
            )}
        </>
      ),
    },
  ];
}

function ColorMode({ appearance }: { appearance: AppServices["appearance"] }) {
  useLanguage();
  const state = useSyncExternalStore(appearance.subscribe, appearance.snapshot);
  return (
    <>
      <PreferenceRow
        variant="search"
        icon={<GearIcon size={21} />}
        title={t("shell.profile.appearance")}
        subtitle={t("search.colorMode")}
        trailing={
          <Select
            label={t("search.colorMode")}
            variant="compact"
            value={state.preference}
            groups={[
              {
                label: "",
                options: [
                  { value: "system", label: t("shell.profile.system") },
                  { value: "light", label: t("shell.profile.light") },
                  { value: "dark", label: t("shell.profile.dark") },
                ],
              },
            ]}
            onValueChange={(value) => {
              if (value === "system" || value === "light" || value === "dark")
                appearance.setMode(value);
            }}
          />
        }
      />
      {state.error && (
        <p role="alert" className="text-body-sm text-subtle">
          {state.error}{" "}
          <Button
            size="sm"
            onClick={() => appearance.setMode(state.preference)}
          >
            {t("search.retrySaving")}
          </Button>
        </p>
      )}
    </>
  );
}

function NotificationPreference({
  notifications,
  entry,
}: {
  notifications: AppServices["notifications"];
  entry: (typeof entries)[1] | (typeof entries)[2];
}) {
  useLanguage();
  const state = useSyncExternalStore(
    notifications.subscribe,
    notifications.snapshot,
  );
  const key = entry.id === "sound" ? "sound" : "notifyWhileViewing";
  return (
    <>
      <SwitchPreferenceRow
        variant="search"
        icon={<GearIcon size={21} />}
        label={t("navigation.notifications")}
        aria-label={entryLabel(entry.id)}
        description={
          state.developmentPaused
            ? t("search.pausedPreference", { label: entryLabel(entry.id) })
            : entryLabel(entry.id)
        }
        checked={state.preferences[key]}
        disabled={state.developmentPaused || !state.preferences.enabled}
        onCheckedChange={(value) =>
          notifications.updatePreferences({ [key]: value })
        }
      />
      {state.preferencesError && (
        <p role="alert" className="text-body-sm text-subtle">
          {state.preferencesError}{" "}
          <Button size="sm" onClick={() => notifications.updatePreferences({})}>
            {t("search.retrySaving")}
          </Button>
        </p>
      )}
    </>
  );
}

function entryLabel(
  id: (typeof entries)[number]["id"],
  language = languagePreference(),
): string {
  return translate(
    language,
    id === "mode"
      ? "search.colorMode"
      : id === "sound"
        ? "search.sound"
        : "search.notifyViewing",
  );
}
function categoryLabel(
  source: string,
  language = languagePreference(),
): string {
  const keys = {
    Communication: "search.communication",
    Agents: "search.agents",
    "Agent tools": "search.agentTools",
    "Developer tools & integrations": "search.developerTools",
    "People & communities": "search.peopleCommunities",
    Productivity: "search.productivity",
    Other: "search.other",
  } as const;
  const key = Object.hasOwn(keys, source)
    ? keys[source as keyof typeof keys]
    : undefined;
  return key ? translate(language, key) : source;
}
