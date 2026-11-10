// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Field } from "./Field";
import { Input } from "./Input";
import { FieldLabelsProvider } from "./FieldLabels";

afterEach(cleanup);
it.each(["Optional", "Host {name} <b> 한글", ""])(
  "renders the host's arbitrary optional copy %s literally and preserves the raw field label",
  (optionalLabel) => {
    render(
      <FieldLabelsProvider optionalLabel={optionalLabel}>
        <Field label="Optional" optional>
          <Input defaultValue="Raw value" />
        </Field>
      </FieldLabelsProvider>,
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAccessibleName(`Optional ${optionalLabel}`.trim());
    const label = input
      .closest(".buzz-field")
      ?.querySelector(".buzz-field-optional");
    expect(label?.textContent).toBe(optionalLabel);
    expect(label?.querySelector("b")).toBeNull();
    expect(input).toHaveValue("Raw value");
    expect(input).not.toBeRequired();
  },
);
it("scopes the suffix to optional fields and the nearest provider without changing hidden-label semantics", () => {
  render(
    <FieldLabelsProvider optionalLabel="Outer copy">
      <Field label="Outer" optional>
        <Input />
      </Field>
      <Field label="Required raw">
        <Input required />
      </Field>
      <FieldLabelsProvider optionalLabel="Inner copy">
        <Field
          label="Inner"
          optional
          nativeLabel={false}
          labelVisibility="hidden"
        >
          <Input />
        </Field>
      </FieldLabelsProvider>
    </FieldLabelsProvider>,
  );
  expect(
    screen.getByRole("textbox", { name: "Outer Outer copy" }),
  ).not.toBeRequired();
  expect(screen.getByRole("textbox", { name: "Required raw" })).toBeRequired();
  const inner = screen.getByRole("textbox", { name: "Inner Inner copy" });
  expect(
    inner.closest(".buzz-field")?.querySelector(".sr-only"),
  ).not.toBeNull();
  expect(inner.closest(".buzz-field")?.querySelector("label")).toBeNull();
});
