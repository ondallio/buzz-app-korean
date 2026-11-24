import { useEffect, useId, useRef, useState } from "react";
import { t, useLanguage } from "../../shared/i18n";
import { Input } from "../../shared/design-system/ui/Input";
import { InputGroup } from "../../shared/design-system/ui/InputGroup";
import { PreferenceRow } from "../../shared/design-system/ui/PreferenceRow";
import { compactAt, MIN_COMPACT_AT } from "./compact-at";

const shown = (value: string | undefined) => {
  const tokens = compactAt(value);
  return tokens ? String(tokens / 1000) : "";
};

/** Thousands typed in the field as stored tokens: "" when blank, undefined
 * when invalid. */
const parse = (text: string) => {
  const k = text.trim();
  if (!k) return "";
  const tokens = /^\d+$/.test(k) ? String(Number(k) * 1000) : "";
  return compactAt(tokens) ? tokens : undefined;
};

const compactionHint = () => t("v106msg.compaction.hint");

const invalidMessage = () =>
  t("v106msg.compaction.invalid", { min: MIN_COMPACT_AT / 1000 });

/** When the agent's session compacts its context: a size in thousands of
 * tokens, or blank for the harness default. Only valid sizes reach
 * `onChange`; anything else keeps its error and stops its form submitting. */
export function CompactionField({
  value,
  disabled = false,
  onChange,
}: {
  value: string | undefined;
  disabled?: boolean;
  onChange(value: string): void;
}) {
  useLanguage();
  const [text, setText] = useState(shown(value));
  useEffect(() => setText(shown(value)), [value]);
  const valid = parse(text) !== undefined;
  const input = useRef<HTMLInputElement>(null);
  const error = useId();
  useEffect(() =>
    input.current?.setCustomValidity(valid ? "" : invalidMessage()),
  );
  return (
    <>
      <PreferenceRow
        title={
          <>
            {t("v106msg.compaction.title")}{" "}
            <span className="sr-only">{t("v106msg.compaction.unit")}</span>
          </>
        }
        subtitle={compactionHint()}
        trailing={(label) => (
          <div className="w-40">
            <InputGroup
              surface="panel"
              trailing={
                text.trim() ? <span aria-hidden="true">K</span> : undefined
              }
            >
              <Input
                {...label}
                aria-describedby={
                  valid
                    ? label["aria-describedby"]
                    : `${label["aria-describedby"] ?? ""} ${error}`.trim()
                }
                ref={input}
                aria-invalid={!valid || undefined}
                inputMode="numeric"
                placeholder={t("v106msg.compaction.placeholder")}
                value={text}
                disabled={disabled}
                onChange={(event) => {
                  setText(event.target.value);
                  const tokens = parse(event.target.value);
                  if (tokens !== undefined) onChange(tokens);
                }}
                onBlur={() => valid && setText(shown(value))}
              />
            </InputGroup>
          </div>
        )}
      />
      {!valid && (
        <p id={error} role="alert" className="buzz-field-error">
          {invalidMessage()}
        </p>
      )}
    </>
  );
}
