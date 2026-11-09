import { t, useLanguage } from "../../shared/i18n";
import { useEffect, useState } from "react";
import { Accordion } from "../../shared/design-system/ui/Accordion";
import { Button } from "../../shared/design-system/ui/Button";
import { Field } from "../../shared/design-system/ui/Field";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { Select } from "../../shared/design-system/ui/Select";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { loadPolicy, open, parse, savePolicy, type Rule } from "./authors";
import type { GitHubCli } from "./gh";

/** Whose pull request comments and reviews wake agents watching it. */
export function AuthorSettings({
  active,
  gh,
}: {
  active(): boolean;
  gh?: GitHubCli | undefined;
}) {
  useLanguage();
  const [saved, setSaved] = useState(loadPolicy);
  const [draft, setDraft] = useState(saved.text);
  const [fallback, setFallback] = useState(saved.fallback);
  /** Why the rules could not be saved, apart from why they are not rules. */
  const [error, setError] = useState("");
  // After a Save, each edit checks the rules again.
  const [checked, setChecked] = useState(saved.error !== undefined);
  const parsed = parse(draft);
  const dirty =
    typeof parsed === "string" ||
    parsed.text !== saved.text ||
    fallback !== saved.fallback;
  return (
    <section aria-label={t("githubSettings.authorsSettings")}>
      <InlineHeader
        title={t("githubSettings.authors")}
        subtitle={t("githubSettings.authorsHelp")}
      />
      <form
        aria-label={t("githubSettings.rulesForm")}
        onSubmit={(event) => {
          event.preventDefault();
          if (!active() || !dirty) return;
          setChecked(true);
          if (typeof parsed === "string") return;
          try {
            const policy = savePolicy(draft, fallback);
            setSaved(policy);
            setDraft(policy.text);
            setChecked(false);
            setError("");
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
          }
        }}
      >
        <SettingsGroup layout="form">
          <Account gh={gh} />
          {saved.error !== undefined && (
            <p role="status" className="m-0 text-body-sm text-subtle">
              {t("githubSettings.invalidSaved")}
            </p>
          )}
          {open(saved) && (
            <p role="status" className="m-0 text-body-sm text-subtle">
              {t("githubSettings.openPolicy")}
            </p>
          )}
          <Field
            label={t("githubSettings.rules")}
            error={checked && typeof parsed === "string" ? parsed : undefined}
            description={t("githubSettings.rulesHelp")}
          >
            <Textarea
              rows={6}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
            />
          </Field>
          <Accordion
            variant="form"
            items={[
              {
                value: "syntax",
                title: t("githubSettings.syntax"),
                content: (
                  <ul className="m-0 flex flex-col gap-1 pl-5 text-body-sm text-subtle">
                    <li>{t("githubSettings.syntaxConditions")}</li>
                    <li>{t("githubSettings.syntaxAccount")}</li>
                    <li>{t("githubSettings.syntaxBody")}</li>
                    <li>{t("githubSettings.syntaxPattern")}</li>
                    <li>{t("githubSettings.syntaxMembership")}</li>
                  </ul>
                ),
              },
            ]}
          />
          <Select
            label={t("githubSettings.fallback")}
            value={fallback}
            groups={[
              {
                label: "",
                options: [
                  { value: "allow", label: t("githubSettings.allow") },
                  { value: "deny", label: t("githubSettings.deny") },
                ],
              },
            ]}
            onValueChange={(value) => setFallback(value as Rule["effect"])}
          />
          {error && (
            <p role="alert" className="m-0 text-body-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="submit" variant="primary" disabled={!dirty}>
              {t("githubSettings.save")}
            </Button>
          </div>
        </SettingsGroup>
      </form>
    </section>
  );
}
/** Who author:@me is: the account the person's `gh` is signed in to. */
function Account({ gh }: { gh: GitHubCli | undefined }) {
  useLanguage();
  /** The login, or why `gh` could not say. */
  const [answer, setAnswer] = useState<{ login: string } | Error>();
  useEffect(() => {
    if (!gh) return;
    const stop = new AbortController();
    gh<{ viewer: { login: string } }>(
      "query{viewer{login}}",
      {},
      stop.signal,
    ).then(
      ({ viewer }) => setAnswer(viewer),
      (reason) => {
        if (!stop.signal.aborted)
          setAnswer(reason instanceof Error ? reason : Error(String(reason)));
      },
    );
    return () => stop.abort();
  }, [gh]);
  return (
    <p className="m-0 text-body-sm text-subtle">
      {!gh
        ? t("githubSettings.accountDesktop")
        : !answer
          ? t("githubSettings.accountChecking")
          : answer instanceof Error
            ? t("githubSettings.accountFailed", { reason: answer.message })
            : t("githubSettings.accountSignedIn", { login: answer.login })}
    </p>
  );
}
