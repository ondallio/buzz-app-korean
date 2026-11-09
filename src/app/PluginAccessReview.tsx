import {
  t,
  useLanguage,
  formattingLocale,
  languagePreference,
} from "../shared/i18n";
import { rich } from "../shared/i18n/rich";
import { type Ref, useContext, useSyncExternalStore } from "react";
import { AgentsContext } from "../features/agents/react";
import type { RegisteredAgentType } from "../features/agents/service";

import type { PluginManifest } from "../plugins/api";
import { Accordion } from "../shared/design-system/ui/Accordion";
import { Button } from "../shared/design-system/ui/Button";
import {
  GlobeIcon,
  FolderOpenIcon,
  PlugIcon,
  TerminalWindowIcon,
  MonitorIcon,
} from "../shared/design-system/icons/index";
import styles from "./PluginImport.module.css";

const noSubscribe = () => () => {};
const noTypes = () => EMPTY_TYPES;
const EMPTY_TYPES: readonly RegisteredAgentType[] = [];
const byteCount = (count: number) =>
  languagePreference() === "en"
    ? String(count)
    : new Intl.NumberFormat(formattingLocale()).format(count);

function ProgramDetails({
  program,
  args,
}: {
  program: string;
  args: readonly string[];
}) {
  useLanguage();
  return (
    <>
      <p className="mb-2 mt-1">
        {rich("pluginManagement.access.program", {
          program: <code className={styles.sourcePath}>{program}</code>,
        })}
      </p>
      <p className="mb-1 mt-0">
        {t(
          args.length
            ? "pluginManagement.access.arguments"
            : "pluginManagement.access.noArguments",
        )}
      </p>
      {args.length > 0 && (
        <ol className="m-0 list-decimal space-y-2 pl-6">
          {args.map((argument, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: Argument position is its identity; repeated values are valid.
              key={index}
              aria-label={t("pluginManagement.access.argument", {
                index: index + 1,
              })}
            >
              <pre className="m-0 whitespace-pre-wrap break-words">
                <code className={styles.sourcePath}>{argument}</code>
              </pre>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function hostDeclarations(
  manifest: PluginManifest,
  types: readonly RegisteredAgentType[],
) {
  return [
    ...(manifest.host?.agentExecution ?? []).map((harness) => ({
      key: `agentExecution:${harness}`,
      signature: `Agent execution: ${harness}`,
      title: t("pluginManagement.access.executionTitle"),
      label: t("pluginManagement.access.executionLabel", {
        name: types.find((type) => type.key === harness)?.title ?? harness,
      }),
      hint: t("pluginManagement.access.executionHint"),
      icon: PlugIcon,
      details: <code className={styles.sourcePath}>{harness}</code>,
    })),
    ...(manifest.host?.agentHooks ?? []).map((harness) => ({
      key: `agentHooks:${harness}`,
      signature: `Agent hooks: ${harness}`,
      title: t("pluginManagement.access.hooksTitle"),
      label: t("pluginManagement.access.hooksLabel", {
        name: types.find((type) => type.key === harness)?.title ?? harness,
      }),
      hint: t("pluginManagement.access.hooksHint"),
      icon: PlugIcon,
      details: <code className={styles.sourcePath}>{harness}</code>,
    })),
    ...(manifest.host?.commands ?? []).map((command) => ({
      key: `command:${command.id}`,
      signature: `Command ${command.id}: ${JSON.stringify([command.program, ...command.args])} · input: ${command.maxInputBytes === undefined ? "none" : `up to ${command.maxInputBytes} bytes`} · output: up to ${command.maxOutputBytes ?? 4096} bytes`,
      title: t("pluginManagement.access.command", { id: command.id }),
      label: t("pluginManagement.access.run", { program: command.program }),
      hint: t("pluginManagement.access.commandHint"),
      icon: TerminalWindowIcon,
      details: (
        <>
          <ProgramDetails program={command.program} args={command.args} />
          <p className="mb-0 mt-2">
            {command.maxInputBytes === undefined
              ? t("pluginManagement.access.inputNone")
              : t("pluginManagement.access.inputBytes", {
                  count: byteCount(command.maxInputBytes),
                })}
          </p>
          <p className="m-0">
            {t("pluginManagement.access.outputBytes", {
              count: byteCount(command.maxOutputBytes ?? 4096),
            })}
          </p>
        </>
      ),
    })),
    ...(manifest.host?.networkOrigins ?? []).map((origin) => ({
      key: `origin:${origin}`,
      signature: `HTTPS origin: ${origin}`,
      title: t("pluginManagement.access.originTitle"),
      name: t("pluginManagement.access.originName", { origin }),
      label: t("pluginManagement.access.originLabel", { origin }),
      hint: t("pluginManagement.access.originHint"),
      icon: GlobeIcon,
      details: <code className={styles.sourcePath}>{origin}</code>,
    })),
    ...(manifest.host?.federatedIdentity?.operations ?? []).map(
      (operation) => ({
        key: `federated:${operation.method} ${operation.path}`,
        signature: `Federated authority ${manifest.host?.federatedIdentity?.authority}: ${operation.method} ${operation.path}`,
        title: t("pluginManagement.access.federatedTitle", {
          authority: String(manifest.host?.federatedIdentity?.authority),
        }),
        label: `${operation.method} ${operation.path}`,
        hint: t("pluginManagement.access.federatedHint"),
        icon: GlobeIcon,
        details: <code className={styles.sourcePath}>{operation.path}</code>,
      }),
    ),
    ...(manifest.host?.processes ?? []).map((process) => ({
      key: `process:${process.id}`,
      signature: `Process ${process.id}: ${JSON.stringify([process.program, ...(process.args ?? [])])}${process.bundled ? " (bundled with Buzz)" : ""} · artifact: ${JSON.stringify(process.artifact ?? null)} and any further arguments · stdin, full user access`,
      title: t("pluginManagement.access.processTitle", { id: process.id }),
      label: t("pluginManagement.access.processLabel", {
        program: process.program,
      }),
      hint: t("pluginManagement.access.processHint"),
      icon: TerminalWindowIcon,
      details: (
        <>
          <ProgramDetails program={process.program} args={process.args ?? []} />
          {process.bundled && (
            <p className="mb-0 mt-2">{t("pluginManagement.access.bundled")}</p>
          )}
          {process.artifact && (
            <div className="mt-2 break-all">
              <p className="m-0">
                {rich("pluginManagement.access.artifact", {
                  path: <code>{process.artifact.path}</code>,
                })}
              </p>
              <p className="m-0">
                {rich("pluginManagement.access.sha256", {
                  hash: <code>{process.artifact.sha256}</code>,
                })}
              </p>
              {process.artifact.siblings?.map((sibling) => (
                <p className="m-0" key={sibling.name}>
                  {rich("pluginManagement.access.sibling", {
                    name: <code>{sibling.name}</code>,
                    hash: <code>{sibling.sha256}</code>,
                  })}
                </p>
              ))}
            </div>
          )}
          <p className="mb-0 mt-2">
            {t("pluginManagement.access.processAccess")}
          </p>
        </>
      ),
    })),
    ...(manifest.host?.mcp
      ? [
          {
            key: "mcp",
            signature:
              "MCP servers: tools served to local agents over loopback HTTP",
            title: t("pluginManagement.access.mcpTitle"),
            label: t("pluginManagement.access.mcpLabel"),
            hint: t("pluginManagement.access.mcpHint"),
            icon: PlugIcon,
            details: (
              <p className="m-0">{t("pluginManagement.access.mcpDetails")}</p>
            ),
          },
        ]
      : []),
    ...(manifest.host?.managedFiles
      ? [
          {
            key: "managedFiles",
            signature:
              "Managed files: temporary private saves · no file reading",
            title: t("pluginManagement.access.managedTitle"),
            label: t("pluginManagement.access.managedLabel"),
            hint: t("pluginManagement.access.managedHint"),
            icon: FolderOpenIcon,
            details: (
              <p className="m-0">
                {t("pluginManagement.access.managedDetails")}
              </p>
            ),
          },
        ]
      : []),
    ...(manifest.host?.files
      ? [
          {
            key: "files",
            signature:
              "Files: read any file and resolve folders · full user access",
            title: t("pluginManagement.access.filesTitle"),
            label: t("pluginManagement.access.filesLabel"),
            hint: t("pluginManagement.access.filesHint"),
            icon: FolderOpenIcon,
            details: (
              <p className="m-0">{t("pluginManagement.access.filesDetails")}</p>
            ),
          },
        ]
      : []),
  ];
}

export function pluginAccessIncreases(
  manifest: PluginManifest,
  previous: PluginManifest,
) {
  const granted = new Set(
    hostDeclarations(previous, []).map((item) => item.signature),
  );
  return hostDeclarations(manifest, []).some(
    (item) => !granted.has(item.signature),
  );
}

export function PluginAccessReview({
  manifest,
  previousManifest,
  unchangedOnly = false,
  unchangedTrigger,
  onShowUnchanged,
}: {
  manifest: PluginManifest;
  previousManifest?: PluginManifest | undefined;
  unchangedOnly?: boolean;
  unchangedTrigger?: Ref<HTMLButtonElement>;
  onShowUnchanged?: () => void;
}) {
  useLanguage();
  const agents = useContext(AgentsContext);
  const types = useSyncExternalStore(
    agents?.subscribe ?? noSubscribe,
    agents?.types ?? noTypes,
    noTypes,
  );
  const updating = !!previousManifest;
  const declaredDetails = hostDeclarations(manifest, types);
  const previousDetails = previousManifest
    ? hostDeclarations(previousManifest, types)
    : [];
  const previousGrants = previousDetails.map((grant) => grant.signature);
  const removedDetails = previousDetails.filter(
    (grant) => !declaredDetails.some((next) => next.key === grant.key),
  );
  const addedDetails = declaredDetails.filter(
    (grant) => !previousDetails.some((previous) => previous.key === grant.key),
  );
  const changedDetails = declaredDetails.filter((grant) =>
    previousDetails.some(
      (previous) =>
        previous.key === grant.key && previous.signature !== grant.signature,
    ),
  );
  const unchangedDetails = declaredDetails.filter((grant) =>
    previousGrants.includes(grant.signature),
  );
  const hasAccessChanges =
    addedDetails.length + changedDetails.length + removedDetails.length > 0;
  function scopeItem(
    grant: ReturnType<typeof hostDeclarations>[number],
    removed = false,
    compare = updating,
  ) {
    const changed =
      compare &&
      !!previousManifest &&
      !removed &&
      !previousGrants.includes(grant.signature);
    const previous = changed
      ? previousDetails.find((item) => item.key === grant.key)
      : undefined;
    const changeLabel = (label: string) =>
      changed
        ? t(
            previous
              ? "pluginManagement.access.changed"
              : "pluginManagement.access.added",
            { label },
          )
        : label;
    const Icon = grant.icon;
    return {
      value: grant.signature,
      title: (
        <span className="flex items-start gap-3 text-left text-body-sm break-words">
          <Icon size={20} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="min-w-0">
            <span className="block font-medium">
              {removed
                ? t("pluginManagement.access.removed", { label: grant.label })
                : changeLabel(grant.label)}
            </span>
            <span className="block text-muted">{grant.hint}</span>
          </span>
        </span>
      ),
      content: (
        <section
          aria-label={t(
            removed
              ? "pluginManagement.access.removedDetails"
              : "pluginManagement.access.details",
            {
              name: String(
                "name" in grant ? grant.name : grant.title.slice(0, -1),
              ),
            },
          )}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Scroll owner supports keyboard access to long command details.
          tabIndex={0}
          className={styles.technicalDetails}
        >
          <p className="m-0 font-medium">{changeLabel(grant.title)}</p>
          {previous && (
            <>
              <p className="mb-2 mt-3 text-label">
                {t("pluginManagement.access.previously")}
              </p>
              {previous.details}
              <p className="mb-2 mt-3 text-label">
                {t("pluginManagement.access.afterUpdate")}
              </p>
            </>
          )}
          {grant.details}
        </section>
      ),
    };
  }
  const allDeclarations = (
    <section aria-label={t("pluginManagement.access.declared")}>
      {(updating ? unchangedDetails : declaredDetails).length ? (
        <Accordion
          animate
          key={manifest.id}
          items={(updating ? unchangedDetails : declaredDetails).map((grant) =>
            scopeItem(grant, false, false),
          )}
        />
      ) : (
        <p className="m-0">{t("pluginManagement.access.noAdditional")}</p>
      )}
    </section>
  );

  if (unchangedOnly) return allDeclarations;
  return (
    <section
      aria-label={t("pluginManagement.access.computer")}
      className="text-body-sm"
    >
      {updating && (
        <section
          aria-label={t("pluginManagement.access.changes")}
          className="mb-4"
        >
          <p className="mt-0 mb-2 text-label">
            {hasAccessChanges
              ? t("pluginManagement.access.changes")
              : t("pluginManagement.access.noChanges")}
          </p>
          {(
            [
              [
                "Added",
                addedDetails,
                "pluginManagement.access.addedGroup",
                "pluginManagement.access.addedDeclarations",
              ],
              [
                "Changed",
                changedDetails,
                "pluginManagement.access.changedGroup",
                "pluginManagement.access.changedDeclarations",
              ],
              [
                "Removed",
                removedDetails,
                "pluginManagement.access.removedGroup",
                "pluginManagement.access.removedDeclarations",
              ],
            ] as const
          ).map(
            ([label, grants, heading, declarations]) =>
              grants.length > 0 && (
                <section
                  key={label}
                  aria-label={t(declarations)}
                  className="mt-3"
                >
                  <p className="mt-0 mb-2 text-label">{t(heading)}</p>
                  <Accordion
                    animate
                    key={`${manifest.id}-${label}`}
                    items={grants.map((grant) =>
                      scopeItem(grant, label === "Removed"),
                    )}
                  />
                </section>
              ),
          )}
        </section>
      )}
      {updating ? (
        <p className="mt-0 mb-4 text-body-sm text-muted" role="note">
          {t("pluginManagement.access.updateTrust")}
        </p>
      ) : (
        <Accordion
          animate
          key={`computer-${manifest.id}`}
          items={[
            {
              value: "computer-access",
              title: (
                <span className="flex items-start gap-3 text-left text-body-sm">
                  <MonitorIcon
                    size={20}
                    className="shrink-0 text-muted"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block font-medium">
                      {t("pluginManagement.access.computer")}
                    </span>
                    <span className="block text-muted">
                      {t("pluginManagement.access.computerHint")}
                    </span>
                  </span>
                </span>
              ),
              content: (
                <section
                  aria-label={t("pluginManagement.access.safety")}
                  className="max-w-prose pl-8 text-body"
                >
                  <h4 className="mb-2 mt-0 text-label">
                    {t("pluginManagement.access.beyondTitle")}
                  </h4>
                  <p className="m-0">
                    {t("pluginManagement.access.notSandboxed")}
                  </p>
                  <p className="mb-0 mt-3 text-muted">
                    {t("pluginManagement.access.notLimits")}
                  </p>
                </section>
              ),
            },
          ]}
        />
      )}
      {updating
        ? unchangedDetails.length > 0 && (
            <Button
              ref={unchangedTrigger}
              variant="link"
              size="inline"
              onClick={onShowUnchanged}
            >
              {t("pluginManagement.access.unchanged")}
            </Button>
          )
        : allDeclarations}
    </section>
  );
}
