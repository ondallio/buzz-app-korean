import { test, expect } from "./fixture.mjs";
import { open as openConversation } from "./timeline.mjs";
import { openSettings, selectSettingsSection } from "./navigation.mjs";

// Browser ownership: native-select portals, responsive layout, persisted startup
// and actual cross-page StorageEvent delivery cannot be established in jsdom.
// Identities and relay state come only from the existing disposable app fixture.
test("language choice survives reload, reaches another window and fits enlarged narrow Settings", async ({
  page,
  context,
  app,
}, testInfo) => {
  await page.goto(app.origin);
  await openSettings(page);
  await selectSettingsSection(page, "Appearance");
  const language = page.getByTestId("language-setting");
  await language
    .getByRole("combobox", { name: "Language", exact: true })
    .click();
  await page.getByRole("option", { name: "한국어", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(
    page.getByRole("dialog", { name: "설정", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "화면 설정", exact: true }),
  ).toBeVisible();
  await expect(
    language.getByRole("combobox", { name: "언어", exact: true }),
  ).toHaveText("한국어");
  await expect(
    page.getByRole("figure", { name: "화면 설정 미리보기", exact: true }),
  ).toHaveCount(1);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(
    language.getByRole("combobox", { name: "언어", exact: true }),
  ).toHaveText("한국어");

  const other = await context.newPage();
  try {
    await other.goto(app.origin);
    await expect(other.locator("html")).toHaveAttribute("lang", "ko");
    await language.getByRole("combobox", { name: "언어", exact: true }).click();
    await page.getByRole("option", { name: "English", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(other.locator("html")).toHaveAttribute("lang", "en");
    await language
      .getByRole("combobox", { name: "Language", exact: true })
      .click();
    await page.getByRole("option", { name: "한국어", exact: true }).click();
    await expect(other.locator("html")).toHaveAttribute("lang", "ko");
  } finally {
    await other.close();
  }

  await page.setViewportSize({ width: 480, height: 760 });
  const increase = page.getByRole("button", {
    name: "인터페이스 확대",
    exact: true,
  });
  for (let step = 0; step < 10; step++) await increase.click();
  await expect(increase).toBeDisabled();
  await expect(
    language.getByRole("combobox", { name: "언어", exact: true }),
  ).toBeVisible();
  const mode = page.getByRole("combobox", { name: "모드", exact: true });
  for (const option of ["어둡게", "밝게"]) {
    await mode.click();
    await page.getByRole("option", { name: option, exact: true }).click();
    await expect(mode).toHaveText(option);
    await language.scrollIntoViewIfNeeded();
    await expect(
      language.getByRole("combobox", { name: "언어", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    const screenshot = testInfo.outputPath(
      `korean-settings-${option}-480px-200percent.png`,
    );
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`korean-settings-${option}-480px-200percent`, {
      path: screenshot,
      contentType: "image/png",
    });
  }
});

test.describe("Korean conversation", () => {
  test.use({ productionBroker: true });
  // Browser boundary: real editor keyboard events, signed publication and palette
  // navigation across a live language change. This does not simulate native IME.
  test("keeps the draft, sends Korean multiline content and navigates through Korean search", async ({
    page,
    app,
  }) => {
    await openConversation(page, app);
    const input = page
      .locator("form[data-composer-surface]")
      .getByRole("textbox");
    await expect(input).toHaveCount(1);
    await input.fill("한국어 초안 {name}");
    const retained = await input.elementHandle();
    await openSettings(page);
    await selectSettingsSection(page, "Appearance");
    await page
      .getByTestId("language-setting")
      .getByRole("combobox", { name: "Language", exact: true })
      .click();
    await page.getByRole("option", { name: "한국어", exact: true }).click();
    await page
      .getByRole("dialog", { name: "설정", exact: true })
      .getByRole("button", { name: "설정 닫기", exact: true })
      .click();
    await expect(input).toHaveAccessibleName("#Alpha에 메시지 보내기");
    expect(
      await input.evaluate((node, prior) => node === prior, retained),
    ).toBe(true);
    await expect(input).toHaveJSProperty("value", "한국어 초안 {name}");
    const messages = () =>
      app.report.publications.filter(({ event }) => event.kind === 9);
    await input.click();
    await input.press("End");
    await input.press("Shift+Enter");
    await page.keyboard.insertText("둘째 줄 원문");
    await expect(input).toHaveJSProperty(
      "value",
      "한국어 초안 {name}\n둘째 줄 원문",
    );
    expect(messages()).toHaveLength(0);
    await input.press("Enter");
    await expect.poll(() => messages().length).toBe(1);
    const sent = messages()[0].event;
    expect(sent.content).toBe("한국어 초안 {name}\n둘째 줄 원문");
    expect(sent.pubkey).toBe(app.viewer);
    expect(sent.tags).toContainEqual(["h", "alpha"]);
    await expect(input).toHaveJSProperty("value", "");
    await page.getByRole("button", { name: "Buzz 검색", exact: true }).click();
    const palette = page.getByRole("dialog", {
      name: "Buzz 검색",
      exact: true,
    });
    const query = palette.getByRole("combobox", {
      name: "Buzz 검색",
      exact: true,
    });
    await query.fill("Beta");
    const result = palette
      .locator(
        '[role="group"][aria-label="채널"], [role="rowgroup"][aria-label="채널"]',
      )
      .locator("[data-search-result]")
      .filter({ hasText: "Beta" });
    await expect(result).toHaveCount(1);
    await result.click();
    await expect(palette).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "#Beta에 메시지 보내기", exact: true }),
    ).toBeVisible();
  });
});
