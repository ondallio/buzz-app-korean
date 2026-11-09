import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { Data } from "emoji-mart";
import { setLanguage } from "../../shared/i18n/language";
import { useLanguageDocument } from "../../shared/i18n/document";
// @vitest-environment jsdom
import { SearchIndex } from "emoji-mart";
import { afterEach, expect, it, vi } from "vitest";
import { mountEmojiMart } from "./emoji-mart";

afterEach(() => {
  cleanup();
  setLanguage("en");
  document.documentElement.lang = "en";
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("adds fuzzy shortcode matches after Mart's own results", async () => {
  const martSearch = SearchIndex.search;
  for (const name of ["ResizeObserver", "IntersectionObserver"])
    vi.stubGlobal(
      name,
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  const host = document.body.appendChild(document.createElement("div"));
  const dispose = mountEmojiMart({
    host,
    autoFocus: false,
    scope: "fixture",
    perLine: 8,
    emojiSize: 24,
    emojiButtonSize: 36,
    search: "",
    searchSelection: { current: undefined },
    searchChange() {},
    entries: ["bufo-pray", "bufo-thumbs-up"].map((shortcode) => ({
      shortcode,
      url: `https://a.test/${shortcode}.png`,
    })),
    media: (url) => url,
    select() {},
    close() {},
  });
  try {
    const root = () => host.querySelector("em-emoji-picker")?.shadowRoot;
    const results = () =>
      [
        ...(root()?.querySelectorAll(
          ".category:not([data-id]) button[aria-posinset]",
        ) ?? []),
      ].map((button) => button.getAttribute("title"));
    const input = await vi.waitFor(() => {
      const element = root()?.querySelector<HTMLInputElement>("input");
      if (!element) throw new Error("Search has not rendered");
      return element;
    });
    const search = (query: string) => {
      input.value = query;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    for (const [query, expected] of [
      ["bufop", ":bufo-pray:"],
      ["bufopray", ":bufo-pray:"],
      [":bufop", ":bufo-pray:"],
      ["bufo_pray", ":bufo-pray:"],
      ["bfpray", ":bufo-pray:"],
      ["bufo p", ":bufo-pray:"],
      ["thumbsup", ":bufo-thumbs-up:"],
      ["pointup", "Index Pointing Up"],
      ["hearteyes", "Smiling Face with Heart-Eyes"],
      ["open_book", "Open Book"],
      ["thumbs up", "Thumbs Up"],
    ] as const) {
      // Clear first so the previous query's rendered results cannot pass this one.
      search("");
      await vi.waitFor(() => expect(results()).toEqual([]));
      search(query);
      await vi.waitFor(() => expect(results(), query).toContain(expected));
      // Mart's multi-word name match stays ahead of fuzzy fallbacks.
      if (query === "thumbs up") expect(results()[0]).toBe("Thumbs Up");
    }
  } finally {
    dispose();
  }
  expect(SearchIndex.search).toBe(martSearch);
});

it("updates Mart labels in place while keeping its raw search, selected result and dictionary", async () => {
  for (const name of ["ResizeObserver", "IntersectionObserver"])
    vi.stubGlobal(
      name,
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  function HostLanguage() {
    useLanguageDocument();
    return null;
  }
  render(createElement(HostLanguage));
  const host = document.body.appendChild(document.createElement("div"));
  const select = vi.fn();
  const dispose = mountEmojiMart({
    host,
    autoFocus: false,
    scope: "fixture-ko",
    perLine: 8,
    emojiSize: 24,
    emojiButtonSize: 36,
    search: "",
    searchSelection: { current: undefined },
    searchChange() {},
    entries: [{ shortcode: "raw_word", url: "https://a.test/raw.png" }],
    media: (url) => url,
    select,
    close() {},
  });
  try {
    const picker = host.querySelector("em-emoji-picker");
    const root = picker?.shadowRoot;
    const input = await vi.waitFor(() => {
      const input = root?.querySelector<HTMLInputElement>("input");
      if (!input) throw new Error("Missing search");
      return input;
    });
    input.value = "raw_word";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const selected = await vi.waitFor(() => {
      const selected = root?.querySelector<HTMLButtonElement>(
        'button[title=":raw_word:"]',
      );
      if (!selected) throw new Error("Missing raw custom emoji");
      return selected;
    });
    input.focus();
    input.setSelectionRange(2, 5);
    const dictionary = Data.emojis;
    const key = "buzz-custom/fixture-ko/raw_word";
    const raw = JSON.stringify(Data.emojis[key]);
    const search = SearchIndex.search;
    const people = root?.querySelector<HTMLButtonElement>(
      '#nav button[aria-label="Smileys & People"]',
    );
    expect(people).not.toBeNull();
    const selectedCategory = people?.getAttribute("aria-selected");
    act(() => setLanguage("ko"));
    await vi.waitFor(() =>
      expect(input).toHaveAttribute("aria-label", "이모지 검색"),
    );
    await vi.waitFor(() =>
      expect(people).toHaveAttribute("aria-label", "표정 및 사람"),
    );
    expect(people).toHaveAttribute("title", "표정 및 사람");
    expect(people?.getAttribute("aria-selected")).toBe(selectedCategory);
    expect(
      root?.querySelector('#nav button[aria-label="사용자 지정"]'),
    ).not.toBeNull();
    people?.focus();
    expect(root?.activeElement).toBe(people);
    input.focus();
    expect(input.placeholder).toBe("이모지 검색");
    expect(host.querySelector("em-emoji-picker")).toBe(picker);
    expect(root?.querySelector("input")).toBe(input);
    expect(root?.activeElement).toBe(input);
    expect(input.value).toBe("raw_word");
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5]);
    expect(root?.querySelector('button[title=":raw_word:"]')).toBe(selected);
    expect(Data.emojis).toBe(dictionary);
    expect(JSON.stringify(Data.emojis[key])).toBe(raw);
    expect(SearchIndex.search).toBe(search);
    expect(root?.querySelector(".search .delete")).toHaveAttribute(
      "aria-label",
      "검색 지우기",
    );
    expect(root?.querySelector(".skin-tone-button")).toHaveAttribute(
      "aria-label",
      "기본 피부색 선택",
    );
    people?.focus();
    act(() => setLanguage("en"));
    await vi.waitFor(() =>
      expect(input).toHaveAttribute("aria-label", "Search emoji"),
    );
    await vi.waitFor(() =>
      expect(people).toHaveAttribute("aria-label", "Smileys & People"),
    );
    expect(
      root?.querySelector('#nav button[aria-label="Smileys & People"]'),
    ).toBe(people);
    expect(people?.getAttribute("aria-selected")).toBe(selectedCategory);
    expect(root?.activeElement).toBe(people);
    expect(input.value).toBe("raw_word");
    selected.click();
    expect(select).toHaveBeenCalledExactlyOnceWith(":raw_word:", "raw_word");
  } finally {
    dispose();
  }
});
