import { createContext, useContext, type ReactNode } from "react";
import type { ChipKind } from "../chips/address";

/** Host-owned complete accessible phrases; addresses and authored names stay literal. */
export type ChipLabels = Readonly<{
  kind(kind: ChipKind): string;
  resolving(label: string): string;
  unresolved(kind: ChipKind): string;
  resolved(kind: ChipKind, label: string, qualifier?: string): string;
}>;
const kindNames = {
  person: "Person",
  agent: "Agent",
  channel: "Channel",
  message: "Message",
  link: "Link",
};
const defaults: ChipLabels = {
  kind: (kind) => kindNames[kind],
  resolving: (label) => `Resolving mention ${label}`,
  unresolved: (kind) => `Unresolved ${kindNames[kind].toLowerCase()}`,
  resolved: (kind, label, qualifier) =>
    `${kindNames[kind]} ${label}${qualifier !== undefined ? `, ${qualifier}` : ""}`,
};
const ChipLabelsContext = createContext(defaults);

/** Supplies localized presentation without coupling shared controls to product language state. */
export function ChipLabelsProvider({
  labels,
  children,
}: {
  labels: ChipLabels;
  children: ReactNode;
}) {
  return (
    <ChipLabelsContext.Provider value={labels}>
      {children}
    </ChipLabelsContext.Provider>
  );
}
export function useChipLabels(): ChipLabels {
  return useContext(ChipLabelsContext);
}
