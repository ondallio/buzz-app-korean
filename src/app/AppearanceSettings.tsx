import { t, useLanguage } from "../shared/i18n";
import { Select } from "../shared/design-system/ui/Select";
import { LanguageSettings } from "./LanguageSettings";
import { ACCENTS, accentButtonStyle } from "../shared/theme/accent";

import { IconButton } from "../shared/design-system/ui/IconButton";
import {
  ArrowCounterClockwiseIcon,
  CircleIcon,
} from "../shared/design-system/icons";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";
import { ToastNotice } from "../shared/design-system/ui/Toast";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { AppearancePreview } from "./AppearancePreview";
import { Button } from "../shared/design-system/ui/Button";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { Appearance } from "../shared/theme/service";

import {
  setThreadPlacementPreference,
  useThreadPlacementPreference,
} from "../features/messages/thread-preferences";

import {
  useFollowUpBehaviorPreference,
  setFollowUpBehaviorPreference,
} from "../features/messages/follow-up-preference";
import {
  setMessageAutocorrectPreference,
  useMessageAutocorrectPreference,
} from "../features/messages/autocorrect-preference";
import {
  setUnreadFirstPreference,
  useUnreadFirstPreference,
} from "../features/search/unread-first-preference";
import { macWebKit } from "../features/messages/mac-webkit";
import { SwitchPreferenceRow } from "../shared/design-system/ui/SwitchPreferenceRow";
import {
  setClockPreference,
  useClockPreference,
} from "../shared/clock-preference";
import {
  setNamePreference,
  useNamePreference,
} from "../features/profiles/name-preference";
import type { Communities } from "../features/communities/service";

const noRelay = () => () => {};
/** Whether the connected community verifies people's names, so there is a
 * username and a full name to choose between. */
function useVerifiedCommunity(relay: Communities["relay"] | undefined) {
  const connection = useSyncExternalStore(relay?.subscribe ?? noRelay, () =>
    relay?.snapshot(),
  );
  const profiles =
    connection?.status === "ready" ? connection.session.profiles : undefined;
  return useSyncExternalStore(
    profiles?.subscribe ?? noRelay,
    () => !!profiles?.verifiedAuthority?.(),
  );
}

export function AppearanceSettings({
  appearance,
  active = true,
  autocorrectAvailable = macWebKit(),
  communities,
}: {
  appearance: Appearance;
  active?: boolean;
  /** Only Mac WebKit applies the composer's autocorrect attribute. */
  autocorrectAvailable?: boolean;
  communities?: Pick<Communities, "relay"> | undefined;
}) {
  useLanguage();
  const followUp = useFollowUpBehaviorPreference();
  const autocorrect = useMessageAutocorrectPreference();
  const unreadFirst = useUnreadFirstPreference();
  const clock = useClockPreference();
  const names = useNamePreference();
  const verifiedCommunity = useVerifiedCommunity(communities?.relay);
  const { placement, unsaved } = useThreadPlacementPreference();
  const increaseButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<HTMLButtonElement | null>(null);
  const resetRef = useCallback((node: HTMLButtonElement | null) => {
    if (!node) return;
    return () => {
      if (document.activeElement === node)
        pendingFocus.current = increaseButton.current;
    };
  }, []);
  useLayoutEffect(() => {
    // At 200%, Increase is still disabled during Reset's ref cleanup.
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target?.isConnected) target.focus();
  });
  const {
    preference,
    mode,
    error,
    messageWidth,
    messageWidthError,
    fontScale,
    fontError,
    accent,
    accentError,
    contrast,
    contrastError,
    density,
    densityError,
  } = useSyncExternalStore(appearance.subscribe, appearance.snapshot);
  return (
    <section aria-labelledby="appearance-settings-title">
      <Header
        id="appearance-settings-title"
        title={t("appearance.appearance")}
      />
      <div>
        <InlineHeader title={t("appearance.interface")} />
        <SettingsGroup>
          <LanguageSettings />
          <PreferenceRow
            id="setting-mode"
            title={t("appearance.mode")}
            trailing={
              <Select
                variant="compact"
                label={t("appearance.mode")}
                value={preference}
                groups={[
                  {
                    label: t("appearance.mode"),
                    options: [
                      { value: "system", label: t("appearance.system") },
                      { value: "light", label: t("appearance.light") },
                      { value: "dark", label: t("appearance.dark") },
                    ],
                  },
                ]}
                onValueChange={(value) => {
                  if (
                    value === "system" ||
                    value === "light" ||
                    value === "dark"
                  )
                    appearance.setMode(value);
                }}
              />
            }
          />
          <PreferenceRow
            title={t("appearance.interface_size")}
            trailing={
              <fieldset
                aria-label={t("appearance.interface_size")}
                className="m-0 flex min-w-0 flex-wrap items-center gap-3 border-0 p-0"
              >
                <Button
                  type="button"
                  size="sm"
                  aria-label={t("appearance.decrease_interface_size")}
                  disabled={fontScale <= 0.8}
                  onClick={() => appearance.setFontScale(fontScale - 0.1)}
                >
                  −
                </Button>
                <output
                  aria-label={t("appearance.interface_size")}
                  className="text-body-sm tabular-nums"
                >
                  {Math.round(fontScale * 100)}%
                </output>
                <Button
                  type="button"
                  size="sm"
                  ref={increaseButton}
                  aria-label={t("appearance.increase_interface_size")}
                  disabled={fontScale >= 2}
                  onClick={() => appearance.setFontScale(fontScale + 0.1)}
                >
                  +
                </Button>
                {fontScale !== 1 && (
                  <IconButton
                    icon={<ArrowCounterClockwiseIcon aria-hidden="true" />}
                    title={t("appearance.reset_interface_size")}
                    size="sm"
                    type="button"
                    ref={resetRef}
                    aria-label={t("appearance.reset_interface_size")}
                    onClick={() => appearance.setFontScale(1)}
                  />
                )}
              </fieldset>
            }
          />
          <PreferenceRow
            title={t("appearance.accent_color")}
            trailing={(label) => (
              <fieldset
                {...label}
                className="m-0 min-w-0 max-w-full border-0 p-0"
              >
                <div
                  data-accent-colors
                  className="grid auto-cols-max grid-flow-col gap-2 overflow-x-auto p-1 scroll-p-1 [&>button]:scroll-m-1"
                >
                  {ACCENTS.map((color) => {
                    const colorLabel = t(
                      (
                        {
                          bee: "appearance.color_honey",
                          cobalt: "appearance.color_cobalt",
                          iris: "appearance.color_iris",
                          magenta: "appearance.color_magenta",
                          citrus: "appearance.color_citrus",
                          mono: "appearance.color_mono",
                        } as const
                      )[color],
                    );
                    return (
                      <IconButton
                        key={color}
                        data-color-swatch=""
                        data-accent={color}
                        data-color-mode={mode}
                        style={accentButtonStyle}
                        variant="primary"
                        size="sm"
                        shape="round"
                        aria-label={t("appearance.accent_accessible", {
                          color: colorLabel,
                        })}
                        title={colorLabel}
                        aria-pressed={accent === color}
                        onFocus={(event) =>
                          event.currentTarget.scrollIntoView({
                            block: "nearest",
                            inline: "nearest",
                          })
                        }
                        onClick={() => appearance.setAccent(color)}
                        icon={
                          <CircleIcon
                            size={24}
                            strokeWidth={3}
                            aria-hidden="true"
                            className={
                              accent === color ? "opacity-100" : "opacity-0"
                            }
                          />
                        }
                      />
                    );
                  })}
                </div>
              </fieldset>
            )}
          />
          <PreferenceRow
            title={t("appearance.vibe_level")}
            trailing={
              <Select
                variant="compact"
                label={t("appearance.vibe_level")}
                value={contrast}
                groups={[
                  {
                    label: t("appearance.vibe_level"),
                    options: [
                      { value: "low", label: t("appearance.chillin") },
                      { value: "high", label: t("appearance.buzzin") },
                    ],
                  },
                ]}
                onValueChange={(value) => {
                  if (value === "low" || value === "high")
                    appearance.setContrast(value);
                }}
              />
            }
          />
          <PreferenceRow
            title={t("appearance.clock")}
            subtitle={t("appearance.system_uses_your_device_s_time_format")}
            trailing={
              <Select
                variant="compact"
                label={t("appearance.clock")}
                value={clock.hourCycle}
                groups={[
                  {
                    label: t("appearance.clock"),
                    options: [
                      { value: "system", label: t("appearance.system") },
                      { value: "h12", label: t("appearance.12_hour") },
                      { value: "h23", label: t("appearance.24_hour") },
                    ],
                  },
                ]}
                onValueChange={(value) => {
                  if (value === "system" || value === "h12" || value === "h23")
                    setClockPreference({ hourCycle: value });
                }}
              />
            }
          />
          <SwitchPreferenceRow
            label={t("appearance.show_seconds")}
            checked={clock.seconds}
            onCheckedChange={(seconds) => setClockPreference({ seconds })}
          />
        </SettingsGroup>
      </div>
      <div className="mt-section-gap">
        <InlineHeader title={t("appearance.conversations")} />
        <SettingsGroup>
          <PreferenceRow
            title={t("appearance.message_density")}
            subtitle={t(
              "appearance.compact_shows_conversations_as_a_flat_list_that_fits_more_messages_on_screen",
            )}
            trailing={
              <Select
                variant="compact"
                label={t("appearance.message_density")}
                value={density}
                groups={[
                  {
                    label: t("appearance.density"),
                    options: [
                      { value: "default", label: t("appearance.default") },
                      { value: "compact", label: t("appearance.compact") },
                    ],
                  },
                ]}
                onValueChange={(value) => {
                  if (value === "default" || value === "compact")
                    appearance.setDensity(value);
                }}
              />
            }
          />
          {density === "default" && (
            <PreferenceRow
              title={t("appearance.message_width")}
              trailing={
                <Select
                  variant="compact"
                  label={t("appearance.message_width")}
                  value={messageWidth}
                  groups={[
                    {
                      label: t("appearance.width"),
                      options: [
                        { value: "narrow", label: t("appearance.narrow") },
                        { value: "wide", label: t("appearance.wide") },
                      ],
                    },
                  ]}
                  onValueChange={(value) => {
                    if (value === "narrow" || value === "wide")
                      appearance.setMessageWidth(value);
                  }}
                />
              }
            />
          )}
          <AppearancePreview
            messageWidth={messageWidth}
            density={density}
            embedded
          />
        </SettingsGroup>
        <div className="mt-4">
          <SettingsGroup>
            <PreferenceRow
              title={t("appearance.message_timestamps")}
              subtitle={t(
                "appearance.hidden_times_stay_available_to_screen_readers",
              )}
              trailing={
                <Select
                  variant="compact"
                  label={t("appearance.message_timestamps")}
                  value={clock.messageTimestamps}
                  groups={[
                    {
                      label: t("appearance.timestamps"),
                      options: [
                        { value: "show", label: t("appearance.show") },
                        {
                          value: "hide-solo",
                          label: t("appearance.hide_in_solo_chats"),
                        },
                        { value: "hide", label: t("appearance.hide") },
                      ],
                    },
                  ]}
                  onValueChange={(value) => {
                    if (
                      value === "show" ||
                      value === "hide-solo" ||
                      value === "hide"
                    )
                      setClockPreference({ messageTimestamps: value });
                  }}
                />
              }
            />
            {verifiedCommunity && (
              <PreferenceRow
                title={t("appearance.show_people_by")}
                subtitle={t(
                  "appearance.how_people_with_verified_names_appear_to_you_search_profiles_and_previews_show_both",
                )}
                trailing={
                  <Select
                    variant="compact"
                    label={t("appearance.show_people_by")}
                    value={names}
                    groups={[
                      {
                        label: t("appearance.name"),
                        options: [
                          {
                            value: "username",
                            label: t("appearance.username"),
                          },
                          {
                            value: "full-name",
                            label: t("appearance.full_name"),
                          },
                        ],
                      },
                    ]}
                    onValueChange={(value) => {
                      if (value === "username" || value === "full-name")
                        setNamePreference(value);
                    }}
                  />
                }
              />
            )}
            <PreferenceRow
              title={t("appearance.follow_up_behavior")}
              subtitle={t(
                "appearance.in_solo_send_follow_ups_immediately_or_queue_them_until_the_agent_finishes_its_previous_response",
              )}
              trailing={
                <Select
                  variant="compact"
                  label={t("appearance.follow_up_behavior")}
                  value={followUp.behavior}
                  groups={[
                    {
                      label: t("appearance.behavior"),
                      options: [
                        {
                          value: "immediate",
                          label: t("appearance.send_immediately"),
                        },
                        { value: "queue", label: t("appearance.queue") },
                      ],
                    },
                  ]}
                  onValueChange={(value) => {
                    if (value === "immediate" || value === "queue")
                      setFollowUpBehaviorPreference(value);
                  }}
                />
              }
            />

            <PreferenceRow
              title={t("appearance.open_threads_in")}
              subtitle={t(
                "appearance.new_threads_open_here_already_open_threads_stay_where_you_placed_them",
              )}
              trailing={
                <Select
                  variant="compact"
                  label={t("appearance.open_threads_in")}
                  value={placement}
                  groups={[
                    {
                      label: t("appearance.pane"),
                      options: [
                        { value: "side", label: t("appearance.side_pane") },
                        { value: "main", label: t("appearance.main_pane") },
                      ],
                    },
                  ]}
                  onValueChange={(value) => {
                    if (value === "main" || value === "side")
                      setThreadPlacementPreference(value);
                  }}
                />
              }
            />
            {autocorrectAvailable && (
              <SwitchPreferenceRow
                label={t("appearance.allow_automatic_spelling_correction")}
                description={t(
                  "appearance.lets_macos_correct_misspelled_words_in_messages_turn_correction_on_or_off_from_the_message_box_s_spelling_and_grammar_menu",
                )}
                checked={autocorrect.enabled}
                onCheckedChange={setMessageAutocorrectPreference}
              />
            )}
            <SwitchPreferenceRow
              label={t("appearance.show_unread_first_in_search")}
              description={t(
                "appearance.with_nothing_typed_search_leads_with_unread_channels_and_dms_and_selects_the_newest",
              )}
              checked={unreadFirst.enabled}
              onCheckedChange={setUnreadFirstPreference}
            />
          </SettingsGroup>
        </div>
        {active && messageWidthError && (
          <ToastNotice
            title={t("appearance.message_width_wasn_t_saved")}
            description={messageWidthError}
          >
            <Button
              size="sm"
              onClick={() => appearance.setMessageWidth(messageWidth)}
            >
              {t("appearance.retry_saving_message_width")}
            </Button>
          </ToastNotice>
        )}
        {active && followUp.unsaved && (
          <ToastNotice
            title={t("appearance.follow_up_preference_wasn_t_saved")}
            description={t(
              "appearance.this_choice_is_active_but_could_not_be_saved_on_this_device",
            )}
          >
            <Button
              size="sm"
              onClick={() => setFollowUpBehaviorPreference(followUp.behavior)}
            >
              {t("appearance.retry_saving_follow_up_behavior")}
            </Button>
          </ToastNotice>
        )}
        {active && clock.unsaved && (
          <ToastNotice
            title={t("appearance.clock_preference_wasn_t_saved")}
            description={t(
              "appearance.this_choice_is_active_but_could_not_be_saved_on_this_device_try_again",
            )}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => setClockPreference({})}
            >
              {t("appearance.retry_saving_clock_preference")}
            </Button>
          </ToastNotice>
        )}
        {active && autocorrect.unsaved && (
          <ToastNotice
            title={t("appearance.spelling_preference_wasn_t_saved")}
            description={t(
              "appearance.this_choice_is_active_but_could_not_be_saved_on_this_device_try_again",
            )}
          >
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setMessageAutocorrectPreference(autocorrect.enabled)
              }
            >
              {t("appearance.retry_saving_spelling_correction")}
            </Button>
          </ToastNotice>
        )}
        {active && unreadFirst.unsaved && (
          <ToastNotice
            title={t("appearance.search_preference_wasn_t_saved")}
            description={t(
              "appearance.this_choice_is_active_but_could_not_be_saved_on_this_device_try_again",
            )}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => setUnreadFirstPreference(unreadFirst.enabled)}
            >
              {t("appearance.retry_saving_search_preference")}
            </Button>
          </ToastNotice>
        )}
        {active && unsaved && (
          <ToastNotice
            title={t("appearance.thread_preference_wasn_t_saved")}
            description={t(
              "appearance.this_choice_is_active_but_could_not_be_saved_on_this_device_try_again",
            )}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => setThreadPlacementPreference(placement)}
            >
              {t("appearance.retry_saving_thread_placement")}
            </Button>
          </ToastNotice>
        )}
        {active && contrastError && (
          <ToastNotice
            title={t("appearance.vibe_level_wasn_t_saved")}
            description={contrastError}
          >
            <Button size="sm" onClick={() => appearance.setContrast(contrast)}>
              {t("appearance.retry_saving_vibe_level")}
            </Button>
          </ToastNotice>
        )}
        {active && densityError && (
          <ToastNotice
            title={t("appearance.message_density_wasn_t_saved")}
            description={densityError}
          >
            <Button size="sm" onClick={() => appearance.setDensity(density)}>
              {t("appearance.retry_saving_message_density")}
            </Button>
          </ToastNotice>
        )}
        {active && accentError && (
          <ToastNotice
            title={t("appearance.accent_color_wasn_t_saved")}
            description={accentError}
          >
            <Button size="sm" onClick={() => appearance.setAccent(accent)}>
              {t("appearance.retry_saving_accent_color")}
            </Button>
          </ToastNotice>
        )}

        {active && fontError && (
          <ToastNotice
            title={t("appearance.interface_size_wasn_t_saved")}
            description={fontError}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => appearance.setFontScale(fontScale)}
            >
              {t("appearance.retry_saving_interface_size")}
            </Button>
          </ToastNotice>
        )}
        {active && error && (
          <ToastNotice
            title={t("appearance.appearance_wasn_t_saved")}
            description={error}
          >
            <Button
              type="button"
              size="sm"
              onClick={() => appearance.setMode(preference)}
            >
              {t("appearance.retry_saving_appearance")}
            </Button>
          </ToastNotice>
        )}
      </div>
    </section>
  );
}
