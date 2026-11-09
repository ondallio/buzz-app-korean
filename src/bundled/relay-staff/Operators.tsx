import { useState } from "react";
import { t, useLanguage, type TranslationKey } from "../../shared/i18n";
import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { Select } from "../../shared/design-system/ui/Select";
import { typedPublicKey } from "../../shared/identity/public-key";
import type {
  OperatorDto,
  StaffRequest,
  StaffRole,
  StaffRoleSource,
} from "../../features/relay-staff/contract";
import { useRead, useSession, useWrite } from "./session";
import { NamesSource, Person, PeopleScope, usePeople } from "./people";
import { containsSecretKey, Loaded, displayStaffFailure } from "./ui";

type OperatorWrite = Extract<
  StaffRequest,
  { route: "putOperator" } | { route: "deleteOperator" }
>;

const SOURCES = {
  config: "adminStaff.source.config",
  owner_fallback: "adminStaff.source.ownerFallback",
  db: "adminStaff.source.db",
} as const satisfies Record<StaffRoleSource, TranslationKey>;
const ROLES = [
  {
    label: "",
    options: [
      { value: "moderator", label: "moderator" },
      { value: "operator", label: "operator" },
    ],
  },
];

function roleLabel(role: string) {
  return role === "operator"
    ? t("adminStaff.role.operator")
    : role === "moderator"
      ? t("adminStaff.role.moderator")
      : role;
}

/** Config-backed staff come from relay configuration and cannot change here. */
const configBacked = (operator: OperatorDto) =>
  operator.sources.some((source) => source !== "db");

export function Operators() {
  useLanguage();
  const roleGroups = ROLES.map((group) => ({
    ...group,
    options: group.options.map((option) => ({
      ...option,
      label: roleLabel(option.value),
    })),
  }));
  const { context, staff, canMutate } = useSession();
  const [list, reload] = useRead({ route: "listOperators" }, [context]);
  const [input, setInput] = useState("");
  const [role, setRole] = useState<StaffRole>("moderator");
  const [error, setError] = useState<DisplayMessage>("");
  /** A change to your own entry re-checks your role. */
  const write = useWrite<OperatorWrite>("operators", (outcome, change) => {
    if (!outcome.ok) return setError(displayStaffFailure(outcome.failure));
    reload();
    if (change.route === "putOperator") setInput("");
    if (change.pubkey === context.signer) staff.reprobe(context);
  });
  const working = write.busy ? (write.frozen?.pubkey ?? null) : null;
  /** Every operator change shares one write, so all controls wait for it. */
  const busy = write.busy;
  const [removing, setRemoving] = useState<OperatorDto | null>(null);
  const pubkey = typedPublicKey(input);
  const secret = containsSecretKey(input);
  const keys = list.state === "ok" ? list.value.map((o) => o.pubkey) : [];
  const names = usePeople(keys);

  const after = (change: OperatorWrite) => {
    setError("");
    write.run(change);
  };
  const add = (operators: OperatorDto[]) => {
    if (!pubkey) return;
    const existing = operators.find((operator) => operator.pubkey === pubkey);
    if (existing)
      return setError(
        localMessage(
          existing.effectiveRole === "operator"
            ? "adminStaff.duplicateOperator"
            : "adminStaff.duplicateModerator",
        ),
      );
    after({ route: "putOperator", pubkey, role });
  };

  return (
    <Loaded read={list} onRetry={reload}>
      {(operators) => (
        <div className="flex flex-col gap-4">
          {canMutate && (
            <div className="flex flex-col gap-2 rounded-md border px-3 py-2.5">
              <p className="text-caption font-medium text-secondary">
                {t("adminStaff.addStaff")}
              </p>
              <div className="flex items-end gap-2">
                <Field
                  label={t("adminStaff.publicKey")}
                  error={secret ? t("adminStaff.privateKey") : undefined}
                >
                  <Input
                    placeholder={t("adminStaff.publicKeyPlaceholder")}
                    value={input}
                    disabled={busy}
                    onChange={(event) => setInput(event.target.value)}
                  />
                </Field>
                <Select
                  label={t("adminStaff.role")}
                  variant="compact"
                  value={role}
                  groups={roleGroups}
                  disabled={busy}
                  onValueChange={(value) => setRole(value as StaffRole)}
                />
                <Button
                  size="sm"
                  loading={working !== null && working === pubkey}
                  disabled={!pubkey || busy}
                  onClick={() => add(operators)}
                >
                  {t("adminStaff.add")}
                </Button>
              </div>
            </div>
          )}
          {error && (
            <p className="text-body-sm text-danger" role="alert">
              {resolveMessage(error)}
            </p>
          )}
          {operators.length === 0 ? (
            <p className="text-body-sm text-secondary">
              {t("adminStaff.empty")}
            </p>
          ) : (
            <PeopleScope people={names}>
              <NamesSource />
              <ul className="flex flex-col gap-1">
                {operators.map((operator) => {
                  const fixed = configBacked(operator);
                  const name = names.text(operator.pubkey);
                  return (
                    <li
                      key={operator.pubkey}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-body-sm"
                    >
                      <span className="min-w-0 flex-1">
                        <Person
                          pubkey={operator.pubkey}
                          detail={
                            operator.pubkey === context.signer
                              ? t("adminStaff.you")
                              : undefined
                          }
                        />
                      </span>
                      <span className="text-caption text-secondary">
                        {operator.sources
                          .map((source) => t(SOURCES[source]))
                          .join(", ")}
                      </span>
                      {fixed || !canMutate ? (
                        <span className="text-caption">
                          {roleLabel(operator.effectiveRole)}
                        </span>
                      ) : (
                        <Select
                          label={t("adminStaff.roleFor", { name })}
                          variant="compact"
                          value={operator.effectiveRole}
                          groups={roleGroups}
                          disabled={busy}
                          onValueChange={(value) =>
                            value !== operator.effectiveRole &&
                            after({
                              route: "putOperator",
                              pubkey: operator.pubkey,
                              role: value as StaffRole,
                            })
                          }
                        />
                      )}
                      {canMutate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={fixed || busy}
                          title={
                            fixed ? t("adminStaff.fixedSource") : undefined
                          }
                          onClick={() => setRemoving(operator)}
                        >
                          {t("adminStaff.remove")}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </PeopleScope>
          )}
          {removing && (
            <AlertDialog
              title={t("adminStaff.removeTitle")}
              description={
                removing.pubkey === context.signer
                  ? t("adminStaff.removeSelf")
                  : t(
                      removing.effectiveRole === "operator"
                        ? "adminStaff.removeOperator"
                        : "adminStaff.removeModerator",
                      { name: names.text(removing.pubkey) },
                    )
              }
              onClose={() => setRemoving(null)}
              actions={
                <>
                  <Button onClick={() => setRemoving(null)}>
                    {t("adminStaff.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const target = removing.pubkey;
                      setRemoving(null);
                      after({ route: "deleteOperator", pubkey: target });
                    }}
                  >
                    {t("adminStaff.remove")}
                  </Button>
                </>
              }
            />
          )}
        </div>
      )}
    </Loaded>
  );
}
