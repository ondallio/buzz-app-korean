import { DesktopLanguageProvider } from "../features/native-language/service";
import { useMemo, type ReactNode } from "react";
import {
  ChipLabelsProvider,
  type ChipLabels,
} from "../shared/design-system/ui/ChipLabels";
import {
  TabsLabelsProvider,
  type TabsLabels,
} from "../shared/design-system/ui/TabsLabels";
import { DialogLabelsProvider } from "../shared/design-system/ui/DialogLabels";
import { FieldLabelsProvider } from "../shared/design-system/ui/FieldLabels";
import { ComboboxLabelsProvider } from "../shared/design-system/ui/Combobox";
import { t, translate, useLanguage } from "../shared/i18n";

/** Product language stays outside generic design-system components. */
export function LanguageProviders({ children }: { children: ReactNode }) {
  const language = useLanguage();
  const chipLabels = useMemo<ChipLabels>(
    () => ({
      kind: (kind) => translate(language, `chips.${kind}.kind`),
      resolving: (label) => translate(language, "chips.resolving", { label }),
      unresolved: (kind) => translate(language, `chips.${kind}.unresolved`),
      resolved: (kind, label, qualifier) =>
        qualifier !== undefined
          ? translate(language, `chips.${kind}.qualified`, { label, qualifier })
          : translate(language, `chips.${kind}.resolved`, { label }),
    }),
    [language],
  );
  const tabsLabels = useMemo<TabsLabels>(
    () => ({
      close: (label) => translate(language, "tabs.close", { label }),
      actions: (label) => translate(language, "tabs.actions", { label }),
      rename: translate(language, "tabs.rename"),
      closeOthers: translate(language, "tabs.closeOthers"),
      closeAll: translate(language, "tabs.closeAll"),
      name: translate(language, "tabs.name"),
    }),
    [language],
  );
  return (
    <DesktopLanguageProvider>
      <DialogLabelsProvider closeLabel={t("dialog.close")}>
        <ChipLabelsProvider labels={chipLabels}>
          <TabsLabelsProvider labels={tabsLabels}>
            <FieldLabelsProvider optionalLabel={t("fieldLabels.optional")}>
              <ComboboxLabelsProvider searchLabel={t("search.search")}>
                {children}
              </ComboboxLabelsProvider>
            </FieldLabelsProvider>
          </TabsLabelsProvider>
        </ChipLabelsProvider>
      </DialogLabelsProvider>
    </DesktopLanguageProvider>
  );
}
