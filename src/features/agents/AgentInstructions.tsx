import { Field } from "../../shared/design-system/ui/Field";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { t, useLanguage } from "../../shared/i18n";

export function AgentInstructions({
  value,
  disabled,
  onChange,
  description,
  creation = false,
}: {
  value: string;
  disabled: boolean;
  onChange(value: string): void;
  description?: string | undefined;
  creation?: boolean;
}) {
  useLanguage();
  return (
    <Field
      label={t("agentCreate.instructions")}
      description={description}
      optional={creation}
    >
      <Textarea
        appearance="outlined"
        rows={creation ? 4 : 8}
        value={value}
        disabled={disabled}
        placeholder={t("agentCreate.example")}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
