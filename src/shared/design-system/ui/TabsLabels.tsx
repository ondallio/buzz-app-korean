import { createContext, useContext, type ReactNode } from "react";
/** Complete shared-tab phrases supplied by the host; tab values and names stay literal. */
export type TabsLabels = Readonly<{
  close(label: string): string;
  actions(label: string): string;
  rename: string;
  closeOthers: string;
  closeAll: string;
  name: string;
}>;
const defaults: TabsLabels = {
  close: (label) => `Close ${label} tab`,
  actions: (label) => `Actions for ${label} tab`,
  rename: "Rename tab",
  closeOthers: "Close other tabs",
  closeAll: "Close all tabs",
  name: "Tab name",
};
const TabsLabelsContext = createContext(defaults);
/** Supplies language without adding product dependencies to shared controls. */
export function TabsLabelsProvider({
  labels,
  children,
}: {
  labels: TabsLabels;
  children: ReactNode;
}) {
  return (
    <TabsLabelsContext.Provider value={labels}>
      {children}
    </TabsLabelsContext.Provider>
  );
}
export function useTabsLabels(): TabsLabels {
  return useContext(TabsLabelsContext);
}
