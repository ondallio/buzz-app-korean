import { useDesktopLanguageStatus } from "../features/native-language/service";
import { Button } from "../shared/design-system/ui/Button";
import { Select } from "../shared/design-system/ui/Select";
import { t } from "../shared/i18n";
import { setLanguage, useLanguagePreference } from "../shared/i18n/language";

/** One immediate device preference with an explicit recovery path if storage fails. */
export function LanguageSettings() {
  const { language, unsaved, systemUnavailable } = useLanguagePreference();
  const nativeMenu = useDesktopLanguageStatus();
  return (
    <div data-testid="language-setting">
      <Select
        name="buzz-language"
        variant="preference"
        label={t("language.label")}
        description={t("language.description")}
        value={language}
        groups={[
          {
            label: t("language.label"),
            options: [
              { value: "ko", label: "한국어" },
              { value: "en", label: "English" },
            ],
          },
        ]}
        onValueChange={(value) => {
          if (value === "en" || value === "ko") setLanguage(value);
        }}
        error={
          unsaved
            ? t("language.unsaved")
            : systemUnavailable
              ? t("language.systemUnavailable")
              : undefined
        }
      />
      {unsaved && (
        <Button type="button" onClick={() => setLanguage(language)}>
          {t("language.retry")}
        </Button>
      )}
      {nativeMenu.error ? (
        <div role="alert">
          <p>{t("language.nativeFailed")}</p>
          <Button
            type="button"
            onClick={nativeMenu.retry}
            disabled={nativeMenu.pending}
          >
            {t("language.nativeRetry")}
          </Button>
        </div>
      ) : nativeMenu.missingKeys.length > 0 ? (
        <p role="status">{t("language.nativeIncomplete")}</p>
      ) : null}
    </div>
  );
}
