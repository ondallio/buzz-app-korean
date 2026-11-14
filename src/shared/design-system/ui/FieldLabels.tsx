import { createContext, useContext, type ReactNode } from "react";

const OptionalLabel = createContext("Optional");

/** The host supplies copy; Field retains its label and validation semantics. */
export function FieldLabelsProvider({
  optionalLabel,
  children,
}: {
  optionalLabel: string;
  children: ReactNode;
}) {
  return <OptionalLabel value={optionalLabel}>{children}</OptionalLabel>;
}

/** Standalone controls retain the English default outside a host provider. */
export function useFieldOptionalLabel(): string {
  return useContext(OptionalLabel);
}
