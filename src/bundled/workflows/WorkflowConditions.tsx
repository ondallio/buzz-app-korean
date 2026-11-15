import { t, useLanguage, type TranslationKey } from "../../shared/i18n";
import { en } from "../../shared/i18n/catalogs/workflow-fields";
import { useState } from "react";
import { TrashIcon } from "../../shared/design-system/icons";
import { Field } from "../../shared/design-system/ui/Field";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { Input } from "../../shared/design-system/ui/Input";
import { Select } from "../../shared/design-system/ui/Select";
import { Tabs } from "../../shared/design-system/ui/Tabs";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { ConfirmAction } from "./ConfirmAction";
import {
  buildConditionExpressions,
  conditionFieldsForTrigger,
  conditionOperatorsForField,
  conditionOperatorNeedsValue,
  conditionRowError,
  defaultConditionOperatorForField,
  parseConditionExpressions,
  type ConditionOperator,
  type ParsedConditionExpression,
} from "./workflowConditionExpression";
import type { TriggerConfig } from "./workflowFormTypes";

const LABELS = {
  contains: "workflowFields.operator.contains",
  not_contains: "workflowFields.operator.not_contains",
  starts_with: "workflowFields.operator.starts_with",
  ends_with: "workflowFields.operator.ends_with",
  equals: "workflowFields.operator.equals",
  not_equals: "workflowFields.operator.not_equals",
  is_not_empty: "workflowFields.operator.is_not_empty",
  is_empty: "workflowFields.operator.is_empty",
} as const satisfies Record<ConditionOperator, TranslationKey>;

const FIELD_LABELS: Readonly<
  Record<string, Extract<keyof typeof en, `workflowFields.field.${string}`>>
> = {
  trigger_author: "workflowFields.field.author",
  trigger_emoji: "workflowFields.field.reaction",
  trigger_message_id: "workflowFields.field.message",
};
const VALIDATION_KEYS = [
  "workflowFields.valueRequired",
  "workflowFields.pubkeyRequired",
  "workflowFields.eventIdRequired",
] as const;

function displayedConditionError(row: ParsedConditionExpression) {
  const error = conditionRowError(row);
  // Only this finite validator's own output has app-owned display provenance.
  const key = VALIDATION_KEYS.find((key) => en[key] === error);
  return key ? t(key) : error;
}

/** Incomplete Basic rows stay local; only an explicit edit may replace an expression. */
export function WorkflowConditions({
  trigger,
  disabled,
  onChange,
}: {
  trigger: TriggerConfig;
  disabled: boolean;
  onChange: (patch: Partial<TriggerConfig>) => void;
}) {
  useLanguage();
  const expression = trigger.filter ?? "";
  const parsed = parseConditionExpressions(expression, trigger.on);
  const [mode, setMode] = useState<"basic" | "advanced">(() =>
    parsed ? "basic" : "advanced",
  );
  const [replace, setReplace] = useState(false);
  const [modeError, setModeError] = useState(false);
  const rows = trigger.conditionRows ?? parsed ?? [];
  const fields = conditionFieldsForTrigger(trigger.on).map((field) => {
    const key = FIELD_LABELS[field.value];
    return {
      ...field,
      label:
        field.value === "trigger_text"
          ? t(
              trigger.on === "diff_posted"
                ? "workflowFields.field.diffText"
                : "workflowFields.field.messageText",
            )
          : key
            ? t(key)
            : field.label,
    };
  });
  const update = (next: ParsedConditionExpression[]) => {
    if (disabled) return;
    const filter = buildConditionExpressions(next);
    onChange({ filter, conditionRows: next });
  };
  return (
    <div className="workflow-options">
      <Tabs
        variant="panel"
        label={t("workflowFields.conditionMode")}
        value={mode}
        items={[
          { value: "basic", label: t("workflowFields.basic") },
          { value: "advanced", label: t("workflowFields.advanced") },
        ]}
        onValueChange={(next) => {
          if (next === "advanced" && rows.some(conditionRowError)) {
            setModeError(true);
            return;
          }
          setModeError(false);
          if (next === "basic" && parsed === null) setReplace(true);
          else setMode(next);
        }}
      />
      {modeError && rows.some(conditionRowError) && (
        <p role="alert" className="text-danger">
          {t("workflowFields.completeCondition")}
        </p>
      )}
      {mode === "advanced" ? (
        <Field
          label={t("workflowFields.triggerCondition")}
          description={t("workflowFields.expressionHelp")}
        >
          <Textarea
            variant="code"
            rows={4}
            disabled={disabled}
            value={expression}
            onChange={(event) => {
              onChange({
                filter: event.currentTarget.value,
                conditionRows: undefined,
              });
            }}
          />
        </Field>
      ) : (
        <>
          <p className="text-body-sm text-subtle">
            {rows.length
              ? t("workflowFields.allConditions")
              : t("workflowFields.matchingEvents")}
          </p>
          {rows.map((row, index) => (
            <div className="workflow-condition" key={row.field}>
              <div className="workflow-condition-heading">
                <span className="text-label-sm">
                  {fields.find((field) => field.value === row.field)?.label}
                </span>
                <IconButton
                  aria-label={t("workflowFields.removeCondition", {
                    field: String(
                      fields.find((field) => field.value === row.field)?.label,
                    ),
                  })}
                  icon={<TrashIcon size={16} aria-hidden="true" />}
                  disabled={disabled}
                  onClick={() => update(rows.filter((_, i) => i !== index))}
                />
              </div>
              <Select
                label={t("workflowFields.comparison", {
                  field: String(
                    fields.find((field) => field.value === row.field)?.label,
                  ),
                })}
                variant="field"
                disabled={disabled}
                value={row.operator}
                groups={[
                  {
                    label: "",
                    options: conditionOperatorsForField(row.field).map(
                      (value) => ({ value, label: t(LABELS[value]) }),
                    ),
                  },
                ]}
                onValueChange={(operator) =>
                  update(
                    rows.map((item, i) =>
                      i === index
                        ? { ...item, operator: operator as ConditionOperator }
                        : item,
                    ),
                  )
                }
              />
              {conditionOperatorNeedsValue(row.operator) && (
                <Field
                  label={t("workflowFields.value")}
                  error={displayedConditionError(row) ?? undefined}
                >
                  <Input
                    value={row.value}
                    disabled={disabled}
                    onValueChange={(value) =>
                      update(
                        rows.map((item, i) =>
                          i === index ? { ...item, value } : item,
                        ),
                      )
                    }
                  />
                </Field>
              )}
            </div>
          ))}
          {fields.some(
            (field) => !rows.some((row) => row.field === field.value),
          ) && (
            <Select
              label={t("workflowFields.addCondition")}
              variant="field"
              disabled={disabled}
              value=""
              groups={[
                {
                  label: "",
                  options: fields.filter(
                    (field) => !rows.some((row) => row.field === field.value),
                  ),
                },
              ]}
              onValueChange={(field) =>
                update([
                  ...rows,
                  {
                    field,
                    operator: defaultConditionOperatorForField(field),
                    value: "",
                    webhookField: "",
                  },
                ])
              }
            />
          )}
        </>
      )}
      {replace && (
        <ConfirmAction
          title={t("workflowFields.replaceTitle")}
          cancel={t("workflowsList.keepEditing")}
          description={t("workflowFields.replaceDescription")}
          action={t("workflowFields.replaceAction")}
          onCancel={() => setReplace(false)}
          onConfirm={() => {
            update([]);
            setMode("basic");
            setReplace(false);
          }}
        />
      )}
    </div>
  );
}
