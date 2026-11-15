import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import { AttentionSonar } from "./AttentionSonar";
import { t, useLanguage } from "../../shared/i18n";

export function AttentionEmptyState({
  name,
  picture,
}: {
  name: string;
  picture?: string | undefined;
}) {
  useLanguage();
  return (
    <section aria-label={t("v1wf.watch.startWatching")}>
      <EmptyState
        icon={
          <AttentionSonar name={name} picture={picture} size="large" hints />
        }
        title={t("v1wf.watch.attention")}
        description={t("v1wf.watch.emptyDescription", { name })}
      />
    </section>
  );
}
