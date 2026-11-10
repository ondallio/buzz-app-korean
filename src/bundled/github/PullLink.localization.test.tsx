// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Contribution } from "../../plugins/contributions";
import type { LinkRenderer } from "../../features/conversation/contracts";
import { MessageLink } from "../../features/conversation/MessageLink";
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import { localeStorageKey, setLanguage } from "../../shared/i18n/language";
import { describePull } from "./pull-state-view";
import type { PullState, PullStates } from "./pull-states";
import { PullLink } from "./PullLink";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("updates only the actual host anchor description across EN KO EN while keeping its raw name, focus, canonical identity and one watch", async () => {
  const identity = "https://github.com/Block/Buzz-App/pull/7";
  const url = `${identity}/files?raw={name}#diff-한글`;
  const rawLabel = "Pull request, merged {name} 한글";
  const state: PullState = { state: "merged", title: rawLabel };
  const stop = vi.fn();
  const states = {
    watch: vi.fn((_url: string, _listener: () => void) => stop),
    get: vi.fn((_url: string) => state),
    readAt: vi.fn(() => undefined),
    read: vi.fn(async () => {
      throw new Error("Unexpected explicit read");
    }),
  } satisfies PullStates;
  const entries: readonly Contribution<LinkRenderer>[] = [
    {
      id: "pull",
      key: "buzz.github/pull",
      pluginId: "buzz.github",
      revision: "fixture",
      title: "Pull request and issue state",
      matches: (candidate) => candidate === url,
      component: ({ url }) => <PullLink url={url} states={states} />,
    },
  ];
  const registryStop = vi.fn();
  const registry = {
    snapshot: () => entries,
    subscribe: vi.fn((_listener: () => void) => registryStop),
  };
  const fetch = vi.fn(async () => {
    throw new Error("Unexpected network request");
  });
  vi.stubGlobal("fetch", fetch);
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const onOpenLink = vi.fn(() => true);
  const h = render(
    <ToastProvider>
      <MessageLink
        url={url}
        registry={registry}
        label={rawLabel}
        onOpenLink={onOpenLink}
      />
    </ToastProvider>,
  );
  const anchor = screen.getByRole("link", { name: rawLabel });
  await waitFor(() =>
    expect(anchor).toHaveAttribute("aria-description", "Pull request, merged"),
  );
  const glyph = anchor.querySelector("[data-pr-state]");
  expect(glyph).not.toBeNull();
  const originalGlyph = glyph?.innerHTML;
  expect(glyph).toHaveAttribute("data-pr-state", "merged");
  expect(glyph).toHaveAttribute("title", "Pull request, merged");
  expect(anchor).toHaveAttribute("href", url);
  expect(anchor).toHaveAttribute("data-link-label", rawLabel);
  expect(states.watch).toHaveBeenCalledExactlyOnceWith(
    identity,
    expect.any(Function),
  );
  expect(registry.subscribe).toHaveBeenCalledTimes(1);
  expect(storage).not.toHaveBeenCalled();
  anchor.focus();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    const description =
      language === "ko" ? "병합된 PR" : "Pull request, merged";
    await waitFor(() =>
      expect(anchor).toHaveAttribute("aria-description", description),
    );
    expect(screen.getByRole("link", { name: rawLabel })).toBe(anchor);
    expect(anchor).toHaveFocus();
    expect(anchor).toHaveAttribute("href", url);
    expect(anchor).toHaveAttribute("data-link-label", rawLabel);
    expect(anchor.querySelector("[data-pr-state]")).toBe(glyph);
    expect(glyph?.innerHTML).toBe(originalGlyph);
    expect(glyph).toHaveAttribute("data-pr-state", "merged");
    expect(glyph).toHaveAttribute("title", description);
    expect(states.get(identity)).toBe(state);
    expect(describePull({ state })).toBe("Pull request, merged");
    expect(states.watch).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    expect(registry.subscribe).toHaveBeenCalledTimes(1);
    expect(registryStop).not.toHaveBeenCalled();
    expect(states.read).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(onOpenLink).not.toHaveBeenCalled();
  }
  expect(storage.mock.calls).toEqual([
    [localeStorageKey, "ko"],
    [localeStorageKey, "en"],
  ]);
  fireEvent.click(anchor);
  expect(onOpenLink).toHaveBeenCalledExactlyOnceWith(url);
  expect(fetch).not.toHaveBeenCalled();
  h.unmount();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(registryStop).toHaveBeenCalledTimes(1);
});
