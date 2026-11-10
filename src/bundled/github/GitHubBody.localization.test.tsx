// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import { english, korean } from "../../shared/i18n";
import { en, ko } from "../../shared/i18n/catalogs/github-body-attachment";
import { GitHubBody } from "./GitHubBody";

const url = "https://github.com/block/buzz-app/pull/327";
const image =
  "https://github.com/user-attachments/assets/cd0773ee-9861-46d9-8a0f-352ae951ec7f";
const fetch = vi.fn(async () => {
  throw new Error("Unexpected fetch in media localization fixture");
});

const provenance = [
  {
    alt: "",
    metadataName: undefined,
    expected: "Open attachment",
    fallback: true,
  },
  { alt: "", metadataName: "", expected: "Open attachment", fallback: true },
  {
    alt: "Open attachment",
    metadataName: "Metadata {name}",
    expected: "Open attachment",
    fallback: false,
  },
  {
    alt: "한글 {label}",
    metadataName: "Open attachment",
    expected: "한글 {label}",
    fallback: false,
  },
  {
    alt: "",
    metadataName: "Open attachment",
    expected: "Open attachment",
    fallback: false,
  },
  {
    alt: "",
    metadataName: "한글 {name}",
    expected: "한글 {name}",
    fallback: false,
  },
] as const;

it.each(
  (["Markdown", "HTML"] as const).flatMap((syntax) =>
    provenance.map((entry) => ({ syntax, ...entry })),
  ),
)(
  "preserves $syntax label/name provenance alt=$alt metadata=$metadataName",
  ({ syntax, alt, metadataName, expected, fallback }) => {
    const body =
      syntax === "Markdown"
        ? `![${alt}](${image})`
        : `<p><img src="${image}" alt="${alt}"></p>`;
    const bodyHtml =
      metadataName === undefined
        ? undefined
        : `<details><summary>${metadataName}</summary><img src="${image}"></details>`;
    const { container } = render(
      <GitHubBody url={url} body={body} bodyHtml={bodyHtml} />,
    );
    const preview = container.querySelector("img");
    if (!preview) throw new Error("Missing actual image preview");
    const link = screen.getByRole("link", { name: expected });
    link.focus();
    for (const language of ["ko", "en", "ko"] as const) {
      act(() => setLanguage(language));
      const name = fallback && language === "ko" ? "첨부 파일 열기" : expected;
      expect(screen.getByRole("link", { name })).toBe(link);
      expect(link).toHaveFocus();
      expect(link).toHaveAttribute("href", image);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
      expect(container.querySelector("img")).toBe(preview);
      expect(preview).toHaveAttribute("alt", alt);
      expect(preview).toHaveAttribute("src", image);
    }
    fireEvent.load(preview);
    expect(screen.queryByRole("link")).toBeNull();
    act(() => setLanguage("en"));
    expect(container.querySelector("img")).toBe(preview);
    expect(screen.queryByRole("link")).toBeNull();
    act(() => setLanguage("ko"));
    expect(container.querySelector("img")).toBe(preview);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.error(preview);
    expect(
      screen.getByRole("link", {
        name: fallback ? "첨부 파일 열기" : expected,
      }),
    ).toHaveAttribute("href", image);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it.each([
  [
    "audio",
    "https://github.com/user-attachments/files/123/recording.wav",
    "Play audio",
    "오디오 재생",
  ],
  [
    "video",
    "https://github.com/user-attachments/files/123/recording.mp4",
    "Play video",
    "동영상 재생",
  ],
] as const)(
  "retains the actual loaded %s node, position, source and focused control across locale",
  (kind, source, play, translatedPlay) => {
    const label = `${kind} authored {name}`;
    const { container } = render(
      <GitHubBody url={url} body={`[${label}](${source})`} />,
    );
    const media = container.querySelector(kind);
    if (!media) throw new Error("Missing actual audio/video node");
    const link = screen.getByRole("link", { name: label });
    expect(link).toHaveAttribute("href", source);
    Object.defineProperty(media, "duration", {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(media, "readyState", {
      configurable: true,
      value: 4,
    });
    fireEvent.loadedMetadata(media);
    fireEvent.loadedData(media);
    media.currentTime = 17.25;
    fireEvent.timeUpdate(media);
    expect(screen.queryByRole("link", { name: label })).toBeNull();
    const control = screen.getByRole("button", { name: play });
    control.focus();
    for (const language of ["ko", "en", "ko"] as const) {
      act(() => setLanguage(language));
      expect(container.querySelector(kind)).toBe(media);
      expect(media).toHaveAttribute("src", source);
      expect(media.currentTime).toBe(17.25);
      expect(media.duration).toBe(120);
      expect(screen.queryByRole("link", { name: label })).toBeNull();
      expect(
        screen.getByRole("button", {
          name: language === "ko" ? translatedPlay : play,
        }),
      ).toBe(control);
      expect(control).toHaveFocus();
      expect(container).toHaveTextContent(label);
    }
    fireEvent.error(media);
    const fallback = screen.getByRole("link", { name: label });
    expect(fallback).toHaveAttribute("href", source);
    act(() => setLanguage("en"));
    expect(screen.getByRole("link", { name: label })).toBe(fallback);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("registers exactly one whole fallback pair", () => {
  expect(en).toEqual({ "githubBodyAttachment.open": "Open attachment" });
  expect(ko).toEqual({ "githubBodyAttachment.open": "첨부 파일 열기" });
  expect(english["githubBodyAttachment.open"]).toBe("Open attachment");
  expect(korean["githubBodyAttachment.open"]).toBe("첨부 파일 열기");
});

beforeEach(() => {
  setLanguage("en");
  fetch.mockClear();
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("updates only the empty-image fallback through EN KO EN without replacing its link or image", () => {
  const { container } = render(<GitHubBody url={url} body={`![](${image})`} />);
  const link = screen.getByRole("link", { name: "Open attachment" });
  const preview = container.querySelector("img");
  if (!preview) throw new Error("Missing actual image preview");
  expect(preview).toBeInTheDocument();
  expect(preview).toHaveAttribute("src", image);
  expect(preview).toHaveAttribute("alt", "");
  expect(link).toHaveAttribute("href", image);
  link.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("link", { name: "첨부 파일 열기" })).toBe(link);
  expect(container.querySelector("img")).toBe(preview);
  expect(link).toHaveFocus();
  act(() => setLanguage("en"));
  expect(screen.getByRole("link", { name: "Open attachment" })).toBe(link);
  expect(container.querySelector("img")).toBe(preview);
  fireEvent.load(preview);
  expect(screen.queryByRole("link", { name: "Open attachment" })).toBeNull();
  act(() => setLanguage("ko"));
  expect(container.querySelector("img")).toBe(preview);
  expect(screen.queryByRole("link", { name: "첨부 파일 열기" })).toBeNull();
  fireEvent.error(preview);
  expect(screen.getByRole("link", { name: "첨부 파일 열기" })).toHaveAttribute(
    "href",
    image,
  );
  expect(fetch).not.toHaveBeenCalled();
});
