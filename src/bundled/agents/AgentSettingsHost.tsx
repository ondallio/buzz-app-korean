import {
  errorMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { t, useLanguage } from "../../shared/i18n";
import { ProviderDialog } from "./ProviderDialog";
import { useId, useRef, useState, type ReactNode } from "react";
import type {
  Agent,
  AgentSettingsHost,
  Agents,
  Carry,
  RegisteredAgentType,
} from "../../features/agents/service";
import { ArrowRightIcon } from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { ChoiceRow } from "../../shared/design-system/ui/ChoiceRow";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { CaretDownIcon } from "../../shared/design-system/icons";
import {
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPopup,
  PopoverDescription,
} from "../../shared/design-system/ui/Popover";

/** One settings composition for both the Agents page and profile panes. */
export function useAgentSettingsHost(options: {
  agents: Agents;
  agent: Agent;
  type: RegisteredAgentType | undefined;
  types: readonly RegisteredAgentType[];
}): {
  agent: Agent;
  type: RegisteredAgentType | undefined;
  settingsHost: AgentSettingsHost;
  discard(): void;
};
export function useAgentSettingsHost(options: {
  agents: Agents | undefined;
  agent: Agent | undefined;
  type: RegisteredAgentType | undefined;
  types: readonly RegisteredAgentType[];
}): {
  agent: Agent | undefined;
  type: RegisteredAgentType | undefined;
  settingsHost: AgentSettingsHost | undefined;
  discard(): void;
};
export function useAgentSettingsHost({
  agents,
  agent,
  type,
  types,
}: {
  agents: Agents | undefined;
  agent: Agent | undefined;
  type: RegisteredAgentType | undefined;
  types: readonly RegisteredAgentType[];
}): {
  agent: Agent | undefined;
  type: RegisteredAgentType | undefined;
  settingsHost: AgentSettingsHost | undefined;
  discard(): void;
} {
  const [pendingType, setPendingType] = useState<{
    key: string;
    config: unknown;
  }>();
  const stagedType =
    agent && pendingType?.key !== agent.type ? pendingType : undefined;
  const settingsType =
    types.find((item) => item.key === stagedType?.key) ?? type;
  const settingsAgent =
    agent && stagedType
      ? { ...agent, type: stagedType.key, config: stagedType.config }
      : agent;
  const pendingTypeSave = stagedType
    ? async (config: unknown = stagedType.config) => {
        if (!agents || !agent) return;
        await agents.retype(agent.key, stagedType.key, { config });
        setPendingType(undefined);
      }
    : undefined;
  const showTypeControl =
    (agent?.place === "here" ||
      (agent?.place === "hosted" && Boolean(type?.remote))) &&
    types.some((item) => item.key !== agent.type);
  return {
    agent: settingsAgent,
    type: settingsType,
    discard: () => setPendingType(undefined),
    settingsHost:
      agents && agent
        ? {
            ...(pendingTypeSave ? { pendingSave: pendingTypeSave } : {}),
            ...(showTypeControl
              ? {
                  typeControl: (dirty: boolean, action?: ReactNode) => (
                    <TypeField
                      agents={agents}
                      agent={agent}
                      type={type}
                      types={types}
                      dirty={dirty}
                      action={action}
                      selected={stagedType?.key ?? agent.type}
                      onSelect={setPendingType}
                    />
                  ),
                }
              : {}),
          }
        : undefined,
  };
}

const CARRY_LABELS: Record<keyof Carry, string> = {
  instructions: "Instructions",
  workspace: "Workspace",
};
const CARRY_KEYS = Object.keys(CARRY_LABELS) as (keyof Carry)[];

function TypeField({
  agents,
  agent,
  type,
  types,
  dirty,
  selected,
  onSelect,
  action,
}: {
  agents: Agents;
  agent: Agent;
  type: RegisteredAgentType | undefined;
  types: readonly RegisteredAgentType[];
  dirty: boolean;
  selected: string;
  action?: ReactNode;
  onSelect(type: { key: string; config: unknown } | undefined): void;
}) {
  useLanguage();
  const others = types.filter((item) => item.key !== agent.type);
  const unavailable = others.filter((item) => type?.remote || item.remote);
  const selectedType = types.find((item) => item.key === selected) ?? type;
  const TypeIcon = selectedType?.icon;
  const [error, setError] = useState<DisplayMessage>("");
  const [helpOpen, setHelpOpen] = useState<"Remote" | "Local">();
  const providerButton = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [checking, setChecking] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [migration, setMigration] = useState<{
    target: RegisteredAgentType;
    preview: ReturnType<Agents["previewRetype"]>;
  }>();
  const choose = (next: string) => {
    if (agent.place !== "here") return;
    if (next === selected) return;
    if (next === agent.type) {
      onSelect(undefined);
      return;
    }
    const target = types.find((item) => item.key === next);
    if (!target || target.remote) return;
    setError("");
    try {
      setMigration({
        target,
        preview: agents.previewRetype(agent.key, target.key),
      });
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };
  const stage = () => {
    if (!migration) return;
    setError("");
    onSelect({ key: migration.target.key, config: migration.preview.config });
    setMigration(undefined);
  };
  const prepare = async () => {
    if (!migration || checking) return;
    const provider = migration.target.provider;
    if (!provider) return stage();
    setChecking(true);
    setError("");
    try {
      await provider.check();
      if (provider.snapshot().readiness === "ready") stage();
      else setConfiguring(true);
    } catch {
      // The provider owns install/auth recovery, including failed checks.
      setConfiguring(true);
    } finally {
      setChecking(false);
    }
  };
  const value = (
    <span className="flex min-w-0 items-center gap-2">
      {TypeIcon && <TypeIcon size={20} aria-hidden="true" />}
      {selectedType?.title ?? t("agentsDetails.unavailableType")}
    </span>
  );
  return (
    <>
      <PreferenceRow
        title={t("agentsDetails.harness")}
        trailing={
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {others.length > 0 ? (
              <div className="buzz-select" data-variant="compact">
                <MenuRoot
                  onOpenChange={(open) => {
                    if (open) setError("");
                    else setHelpOpen(undefined);
                  }}
                >
                  <MenuTrigger
                    aria-label={t("agentsDetails.changeHarness", {
                      type:
                        selectedType?.title ??
                        t("agentsDetails.unavailableHarness"),
                    })}
                    render={
                      <Button
                        ref={providerButton}
                        variant="outline"
                        shape="control"
                        size="sm"
                      >
                        {value}
                        <CaretDownIcon size={14} aria-hidden="true" />
                      </Button>
                    }
                  />
                  <MenuPopup
                    onKeyDownCapture={(event) => {
                      // WebKit keeps focus on the menu root after pointer entry.
                      // Consume the help's Escape here, including that focus path.
                      if (event.key === "Escape" && helpOpen) {
                        event.preventDefault();
                        event.stopPropagation();
                        setHelpOpen(undefined);
                      }
                    }}
                  >
                    <MenuRadioGroup
                      value={selected}
                      onValueChange={(next) => choose(String(next))}
                    >
                      {[true, false].map((remote) => {
                        const label = remote ? "Remote" : "Local";
                        const choices = types.filter(
                          (item) => Boolean(item.remote) === remote,
                        );
                        if (!choices.length) return null;
                        const blocked = choices.filter((item) =>
                          unavailable.includes(item),
                        );
                        return (
                          <MenuGroup key={label}>
                            <MenuGroupLabel emphasis="quiet">
                              <span className="text-caption">
                                {t(
                                  remote
                                    ? "agentsDetails.remote"
                                    : "agentsDetails.localHarness",
                                )}
                              </span>
                            </MenuGroupLabel>
                            {choices
                              .filter((item) => !unavailable.includes(item))
                              .map((item) => {
                                const Icon = item.icon;
                                return (
                                  <MenuRadioItem
                                    key={item.key}
                                    value={item.key}
                                    selection="highlight"
                                    closeOnClick
                                  >
                                    <ChoiceRow
                                      label={item.title}
                                      leading={
                                        Icon ? <Icon size={20} /> : undefined
                                      }
                                    />
                                  </MenuRadioItem>
                                );
                              })}
                            {blocked.length > 0 && (
                              <UnavailableHarnessChoices
                                types={blocked}
                                source={type}
                                open={helpOpen === label}
                                onOpenChange={(open) =>
                                  setHelpOpen(open ? label : undefined)
                                }
                              />
                            )}
                          </MenuGroup>
                        );
                      })}
                    </MenuRadioGroup>
                  </MenuPopup>
                </MenuRoot>
              </div>
            ) : (
              value
            )}
            {action}
          </div>
        }
      />
      {error && !migration && (
        <p role="alert" className="m-0 mt-1 text-body-sm text-danger">
          {resolveMessage(error)}
        </p>
      )}
      <Dialog
        open={Boolean(migration) && !configuring}
        initialFocus={cancel}
        preventClose={checking}
        onOpenChange={(open) => {
          if (!open) {
            setMigration(undefined);
            setError("");
          }
        }}
        title={
          migration
            ? t("agentsDetails.moveTo", {
                name: agent.name,
                type: migration.target.title,
              })
            : t("agentsDetails.move")
        }
        headerGap="compact"
        actions={
          <>
            <Button
              ref={cancel}
              disabled={checking}
              onClick={() => setMigration(undefined)}
            >
              {t("agentsDetails.cancel")}
            </Button>
            <Button
              variant="primary"
              loading={checking}
              onClick={() => void prepare()}
            >
              {t("agentsDetails.continue")}
            </Button>
          </>
        }
      >
        {migration && (
          <MigrationPreview
            source={type}
            target={migration.target}
            preview={migration.preview}
            discardDraft={dirty}
          />
        )}
      </Dialog>
      {configuring && migration && (
        <ProviderDialog
          type={migration.target}
          finalFocus={providerButton}
          onClose={() => {
            setConfiguring(false);
            if (migration.target.provider?.snapshot().readiness === "ready")
              stage();
            else setMigration(undefined);
          }}
        />
      )}
    </>
  );
}

function UnavailableHarnessChoices({
  types,
  source,
  open,
  onOpenChange,
}: {
  types: readonly RegisteredAgentType[];
  source: RegisteredAgentType | undefined;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  useLanguage();
  const triggerId = useId();
  const trigger = useRef<HTMLDivElement>(null);
  const description = useId();
  // Builderlab is currently the only registered remote harness.
  const hosted = types[0];
  return (
    <PopoverRoot
      open={open}
      triggerId={triggerId}
      onOpenChange={(next, details) => {
        // The menu returns focus to itself when the pointer enters this card.
        // Let hover dismissal handle that move; another item still closes it.
        if (
          details.reason === "focus-out" &&
          "relatedTarget" in details.event &&
          details.event.relatedTarget ===
            trigger.current?.closest('[role="menu"]')
        ) {
          details.cancel();
          return;
        }
        onOpenChange(next);
      }}
    >
      <PopoverTrigger
        id={triggerId}
        openOnHover="control"
        nativeButton={false}
        role="group"
        aria-label={t("agentsDetails.unavailableHarnesses")}
        aria-haspopup={false}
        aria-expanded={undefined}
        tabIndex={-1}
        onFocus={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.matches(":focus-visible")
          )
            onOpenChange(true);
        }}
        onKeyDownCapture={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
        render={
          <div ref={trigger}>
            {types.map((item) => {
              const Icon = item.icon;
              return (
                <MenuRadioItem
                  key={item.key}
                  value={item.key}
                  selection="highlight"
                  disabled
                  aria-describedby={open ? description : undefined}
                >
                  <ChoiceRow
                    label={item.title}
                    leading={Icon ? <Icon size={20} /> : undefined}
                  />
                </MenuRadioItem>
              );
            })}
          </div>
        }
      />
      <PopoverPopup
        side="right"
        align="start"
        aria-label={t("agentsDetails.harnessAvailability")}
        initialFocus={false}
        finalFocus={false}
      >
        <PopoverDescription id={description}>
          {source?.remote
            ? t("agentsDetails.remoteNotice", { type: source.title })
            : t("agentsDetails.localNotice", { type: hosted?.title ?? "" })}
        </PopoverDescription>
      </PopoverPopup>
    </PopoverRoot>
  );
}

export function MigrationPreview({
  source,
  target,
  preview,
  discardDraft,
}: {
  source: RegisteredAgentType | undefined;
  target: RegisteredAgentType;
  preview: ReturnType<Agents["previewRetype"]>;
  discardDraft: boolean;
}) {
  useLanguage();
  const SourceIcon = source?.icon;
  const TargetIcon = target.icon;
  const carry = CARRY_KEYS.filter(
    (key) => preview.moved.includes(key) || preview.dropped.includes(key),
  );
  const warning = source?.migrationWarning;
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 text-body">
        <span className="flex items-center gap-2">
          {SourceIcon && <SourceIcon size={24} aria-hidden="true" />}
          {source?.title ?? t("agentsDetails.unavailableSource")}
        </span>
        <ArrowRightIcon size={16} aria-hidden="true" />
        <span className="flex items-center gap-2">
          {TargetIcon && <TargetIcon size={24} aria-hidden="true" />}
          {target.title}
        </span>
      </div>
      <p className="m-0 text-body-sm text-secondary">
        {t("agentsDetails.migrationNotice")}
        {warning && ` ${warning}`}
      </p>
      {discardDraft && (
        <p className="m-0 text-body-sm text-warning">
          {t("agentsDetails.discardNotice")}
        </p>
      )}
      {(carry.length > 0 || preview.settings.length > 0) && (
        <dl className="m-0 grid gap-2">
          {carry.map((key) => {
            const moved = preview.moved.includes(key);
            const dropped = preview.dropped.includes(key);
            return (
              <div className="flex justify-between gap-3" key={key}>
                <dt>
                  {t(
                    key === "instructions"
                      ? "agentsDetails.instructions"
                      : "agentsDetails.workspace",
                  )}
                </dt>
                <dd
                  className={`m-0 text-body-sm ${dropped ? "text-danger" : "text-secondary"}`}
                >
                  {dropped
                    ? t("agentsDetails.dropped")
                    : moved
                      ? t("agentsDetails.moves")
                      : null}
                </dd>
              </div>
            );
          })}
          {preview.settings.map((setting) => (
            <div className="flex justify-between gap-3" key={setting.id}>
              <dt>{setting.label}</dt>
              <dd
                className={`m-0 text-body-sm ${setting.outcome === "reset" ? "text-warning" : "text-danger"}`}
              >
                {t(
                  setting.outcome === "reset"
                    ? "agentsDetails.resets"
                    : "agentsDetails.dropped",
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
