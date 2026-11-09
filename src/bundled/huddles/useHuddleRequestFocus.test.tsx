// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useHuddleRequestFocus } from "./useHuddleRequestFocus";
import { PageSearch } from "../../app/shell/PageSearch";
import { setLanguage } from "../../shared/i18n";

afterEach(() => {
  cleanup();
  setLanguage("en");
});
function Request({
  shown,
  error,
  initial = false,
  withSearch = true,
}: {
  shown: boolean;
  error?: string | undefined;
  initial?: boolean;
  withSearch?: boolean;
}) {
  const focus = useHuddleRequestFocus(false, error, initial);
  return (
    <>
      {withSearch && (
        <button
          type="button"
          aria-label="Search Buzz"
          data-global-search-trigger=""
        >
          Search
        </button>
      )}
      <textarea aria-label="Message" />
      {shown && (
        <section ref={focus.requestRef}>
          <button type="button" data-huddle-join="">
            Join
          </button>
          <button type="button" ref={focus.cancel}>
            Cancel
          </button>
        </section>
      )}
    </>
  );
}
it.each(["owned", "before", "after"])(
  "preserves retry focus ownership when focus moves %s teardown",
  (when) => {
    const view = render(<Request shown />);
    const editor = screen.getByRole("textbox");
    screen.getByRole("button", { name: "Cancel" }).focus();
    if (when === "before") editor.focus();
    view.rerender(<Request shown={false} />);
    if (when === "after") editor.focus();
    view.rerender(<Request shown error="Admission failed" />);
    expect(
      when === "owned" ? screen.getByRole("button", { name: "Join" }) : editor,
    ).toHaveFocus();
  },
);
it("gives a newly opened retry companion an initial Join target", () => {
  render(<Request shown error="Admission failed" initial />);
  expect(screen.getByRole("button", { name: "Join" })).toHaveFocus();
});

it.each(["en", "ko"] as const)(
  "returns focus to the actual %s search trigger when an owned request closes",
  (language) => {
    setLanguage(language);
    const select = () => {};
    const host = (shown: boolean, error?: string) => (
      <>
        <PageSearch pages={[]} onSelect={select} />
        <Request shown={shown} error={error} withSearch={false} />
      </>
    );
    const view = render(host(true));
    const search = screen.getByRole("button", {
      name: language === "ko" ? "Buzz 검색" : "Search Buzz",
    });
    screen.getByRole("button", { name: "Cancel" }).focus();
    view.rerender(host(false));
    expect(search).toHaveFocus();
    view.rerender(host(true, "Opaque admission failure"));
    expect(screen.getByRole("button", { name: "Join" })).toHaveFocus();
  },
);
