import type { detailsDraftErrors } from "../../features/relay/channel-details-protocol";
import { en as formEnglish } from "../../shared/i18n/catalogs/channel-forms";
import { t, useLanguage, formattingLocale } from "../../shared/i18n";
import { useId, type Ref } from "react";
import { Field } from "../../shared/design-system/ui/Field";
import { Input } from "../../shared/design-system/ui/Input";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import styles from "./ChannelTextField.module.css";

type Props = {
  value: string;
  onChange(value: string): void;
  error?: string | undefined;
  disabled?: boolean | undefined;
} & (
  | { field: "name"; inputRef?: Ref<HTMLInputElement>; creation?: boolean }
  | { field: "description"; inputRef?: Ref<HTMLTextAreaElement> }
);

/** Shared presentation/input policy, not draft or persistence ownership. */
export function ChannelTextField(props: Props) {
  useLanguage();
  const countId = useId();
  const isName = props.field === "name";
  const limit = isName ? 120 : 1000;
  const count = [...props.value].length;
  const showCount = count >= limit * 0.9 && !props.error;
  const countLabel = count.toLocaleString(formattingLocale());
  const limitLabel = limit.toLocaleString(formattingLocale());
  const control = {
    value: props.value,
    disabled: props.disabled,
    ...(showCount ? { "aria-describedby": countId } : {}),
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => props.onChange(boundedInput(event.currentTarget, props.value, limit)),
  };
  return (
    <Field
      label={
        <span className={styles.label}>
          <span>
            {isName
              ? t("channelForms.field.name")
              : t("channelForms.field.description")}
          </span>
          {showCount && (
            <span
              aria-hidden="true"
              className="text-body-sm text-subtle tabular-nums"
            >
              {countLabel}/{limitLabel}
            </span>
          )}
        </span>
      }
      error={props.error}
    >
      {props.field === "name" ? (
        <Input
          {...control}
          ref={props.inputRef}
          data-create-channel-name={props.creation ? "" : undefined}
          required
          autoComplete={props.creation ? "off" : undefined}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("channelForms.field.namePlaceholder")}
        />
      ) : (
        <Textarea
          {...control}
          ref={props.inputRef}
          rows={3}
          placeholder={t("channelForms.field.descriptionPlaceholder")}
        />
      )}
      {showCount && (
        <span id={countId} className="sr-only">
          {t("channelForms.field.characters", { count, limit })}
        </span>
      )}
    </Field>
  );
}

/** Unlike native maxLength, count Unicode code points without splitting emoji.
 * Trim only inserted growth, preserving existing text even above the UI limit. */
function boundedInput(
  input: HTMLInputElement | HTMLTextAreaElement,
  previous: string,
  limit: number,
): string {
  const ceiling = Math.max(limit, [...previous].length);
  const excess = [...input.value].length - ceiling;
  if (excess <= 0) return input.value;
  // The caret follows the inserted text. Remove overflow there, not from the
  // end of the field, so typing/pasting in the middle cannot eat existing text.
  const caret = input.selectionStart ?? input.value.length;
  const before = [...input.value.slice(0, caret)];
  const prefix = before.slice(0, Math.max(0, before.length - excess)).join("");
  const value = prefix + input.value.slice(caret);
  input.value = value;
  input.setSelectionRange(prefix.length, prefix.length);
  return value;
}

/** Display projection only for the local detailsDraftErrors producer; never pass API diagnostics. */
export function localizedDetailsErrors(
  errors: ReturnType<typeof detailsDraftErrors>,
) {
  const known = [
    "channelForms.validation.name",
    "channelForms.validation.description",
    "channelForms.validation.huddle",
    "channelForms.validation.duration",
  ] as const;
  const display = (message: string | undefined) => {
    const key = known.find((key) => formEnglish[key] === message);
    return key ? t(key) : message;
  };
  return {
    ...errors,
    name: display(errors.name),
    description: display(errors.description),
    lifetime: display(errors.lifetime),
  };
}
