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
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { createMediaPreparation } from "../relay/media";
import { AttachmentImage } from "./AttachmentImage";
import { MediaAttachment } from "./MediaAttachment";
import { ImageReviewStage } from "./ImageReviewStage";

afterEach(() => {
  cleanup();
  createMediaPreparation().dispose();
  vi.restoreAllMocks();
  setLanguage("en");
});

it("retains the actual fallback viewer, pixels and focus while its captions change", async () => {
  const attachment = {
    kind: "image" as const,
    url: "https://image.test/한글.png?raw={count}",
    name: "Raw {name}.png",
  };
  const view = render(
    <AttachmentImage attachment={attachment} source={attachment.url} />,
  );
  const opener = screen.getByRole("link", { name: "Open image attachment" });
  const pixels = opener.querySelector("img");
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Image attachment" });
  const close = screen.getByRole("button", { name: "Close fullscreen viewer" });
  expect(close).toHaveFocus();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("dialog", {
        name: language === "ko" ? "첨부 이미지" : "Image attachment",
      }),
    ).toBe(dialog);
    expect(
      screen.getByRole("button", {
        name:
          language === "ko" ? "전체 화면 뷰어 닫기" : "Close fullscreen viewer",
      }),
    ).toBe(close);
    expect(close).toHaveFocus();
    expect(opener).toHaveAccessibleName(
      language === "ko" ? "첨부 이미지 열기" : "Open image attachment",
    );
    expect(opener.querySelector("img")).toBe(pixels);
    expect(dialog.querySelector("img")).toHaveAttribute(
      "alt",
      language === "ko" ? "첨부 파일 미리보기" : "Attachment preview",
    );
    expect(opener).toHaveAttribute("href", attachment.url);
    expect(dialog.querySelector("img")).toHaveAttribute("src", attachment.url);
  }
  fireEvent.click(close);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(opener).toHaveFocus());
  expect(view.container.querySelector("a")).toBe(opener);
});

it("preserves provided same-English and empty image labels, counts and raw review data", () => {
  const attachment = {
    kind: "image" as const,
    url: "https://image.test/raw.png",
    name: "Raw 한글 {count}.png",
  };
  const review = vi.fn();
  const view = render(
    <AttachmentImage
      attachment={attachment}
      source={attachment.url}
      label="Open image attachment"
      overlayCount={1000}
      compact
      onOpenReview={review}
    />,
  );
  const opener = screen.getByRole("link", { name: "Open image attachment" });
  expect(opener).toHaveTextContent("+1,000");
  opener.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("link", { name: "Open image attachment" })).toBe(
    opener,
  );
  expect(opener).toHaveFocus();
  expect(review).not.toHaveBeenCalled();
  view.rerender(
    <AttachmentImage
      attachment={attachment}
      source={attachment.url}
      label=""
      overlayCount={1000}
      compact
      onOpenReview={review}
    />,
  );
  expect(opener).toHaveAttribute("aria-label", "");
  fireEvent.click(opener, { ctrlKey: true, shiftKey: true });
  expect(review).toHaveBeenCalledExactlyOnceWith(attachment, 0);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveAttribute("href", attachment.url);
});

it("localizes MediaAttachment defaults without replacing its image or overriding caller descriptions", () => {
  const attachment = {
    kind: "image" as const,
    url: "https://image.test/description.png",
  };
  const media = () => attachment.url;
  const review = vi.fn();
  const view = render(
    <MediaAttachment
      attachment={attachment}
      media={media}
      onOpenReview={review}
    />,
  );
  const opener = screen.getByRole("button", { name: "Open image fullscreen" });
  const image = opener.querySelector("img");
  opener.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "이미지 전체 화면 열기" })).toBe(
    opener,
  );
  expect(opener).toHaveFocus();
  expect(opener.querySelector("img")).toBe(image);
  expect(image).toHaveAttribute("alt", "첨부 파일 미리보기");
  expect(review).not.toHaveBeenCalled();
  view.rerender(
    <MediaAttachment
      attachment={attachment}
      media={media}
      imageDescription="Attachment preview"
      onOpenReview={review}
    />,
  );
  expect(image).toHaveAttribute("alt", "Attachment preview");
  view.rerender(
    <MediaAttachment
      attachment={attachment}
      media={media}
      imageDescription=""
      onOpenReview={review}
    />,
  );
  expect(image).toHaveAttribute("alt", "");
  fireEvent.click(opener);
  expect(review).toHaveBeenCalledExactlyOnceWith(attachment, 0);
});

it.each(["image", "video"] as const)(
  "retains the missing-source %s status across languages",
  (kind) => {
    const attachment = { kind, url: "https://media.test/raw" };
    const media = () => undefined;
    render(<MediaAttachment attachment={attachment} media={media} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      kind === "video" ? "Video unavailable" : "Image unavailable",
    );
    act(() => setLanguage("ko"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(
      kind === "video"
        ? "동영상을 사용할 수 없습니다"
        : "이미지를 사용할 수 없습니다",
    );
    act(() => setLanguage("en"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(
      kind === "video" ? "Video unavailable" : "Image unavailable",
    );
  },
);

it("preserves compact video pixels, paused playback and explicit caller labels across locale", () => {
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => {});
  const attachment = {
    kind: "video" as const,
    url: "https://media.test/raw.mp4",
  };
  const media = () => attachment.url;
  const review = vi.fn();
  const view = render(
    <MediaAttachment
      attachment={attachment}
      media={media}
      compact
      overlayCount={1000}
      onOpenReview={review}
    />,
  );
  const opener = screen.getByRole("link", { name: "Open video fullscreen" });
  const video = opener.querySelector("video");
  const paused = pause.mock.calls.length;
  expect(opener).toHaveTextContent("+1,000");
  opener.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("link", { name: "동영상 전체 화면 열기" })).toBe(
    opener,
  );
  expect(opener).toHaveFocus();
  expect(opener.querySelector("video")).toBe(video);
  expect(pause).toHaveBeenCalledTimes(paused);
  expect(review).not.toHaveBeenCalled();
  view.rerender(
    <MediaAttachment
      attachment={attachment}
      media={media}
      compact
      label="Open video fullscreen"
      onOpenReview={review}
    />,
  );
  expect(opener).toHaveAccessibleName("Open video fullscreen");
  view.rerender(
    <MediaAttachment
      attachment={attachment}
      media={media}
      compact
      label=""
      onOpenReview={review}
    />,
  );
  expect(opener).toHaveAttribute("aria-label", "");
  fireEvent.click(opener);
  expect(review).toHaveBeenCalledExactlyOnceWith(attachment, 0);
});

it("localizes the empty real gallery without inventing a selection or link action", () => {
  const select = vi.fn();
  const open = vi.fn(() => false);
  render(
    <ImageReviewStage
      attachments={[]}
      selectedUrl="raw-selected"
      media={() => undefined}
      select={select}
      onOpenLink={open}
    />,
  );
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Image unavailable");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("이미지를 사용할 수 없습니다");
  expect(select).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});

it("keeps the same unavailable attachment status while changing its owned caption", () => {
  const attachment = {
    kind: "image" as const,
    url: "https://image.test/raw.png",
  };
  const view = render(
    <AttachmentImage attachment={attachment} source={undefined} />,
  );
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Image unavailable");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("이미지를 사용할 수 없습니다");
  act(() => setLanguage("en"));
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("Image unavailable");
  view.rerender(
    <AttachmentImage attachment={attachment} source={undefined} cached />,
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(view.container.firstElementChild).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});
