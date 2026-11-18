import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  INSTALLER_HOOKS,
  installerName,
  koreanWindowsConfig,
  releaseAssetName,
  WINDOWS_TARGET,
  windowsTauriArguments,
} from "./build-windows.mjs";

const root = new URL("../../", import.meta.url);
const windowsBase = JSON.parse(
  readFileSync(new URL("src-tauri/tauri.windows.conf.json", root), "utf8"),
);

it("keeps the Windows window chrome and only retitles it", () => {
  const { config, environment } = koreanWindowsConfig({ version: "1.0.5" });
  expect(environment).toEqual({
    BUZZ_DISTRIBUTION_ID: "ai.codepair.buzz-korean",
  });
  expect(config.productName).toBe("Buzz Korean");
  expect(config.identifier).toBe("ai.codepair.buzz-korean");
  expect(config.plugins["deep-link"].desktop.schemes).toEqual([
    "buzz-ai.codepair.buzz-korean",
  ]);
  expect(config.plugins).not.toHaveProperty("updater");
  expect(config.bundle.createUpdaterArtifacts).toBe(false);
  expect(config.app.windows).toEqual(
    windowsBase.app.windows.map((window) => ({
      ...window,
      title: "Buzz Korean 1.0.5",
    })),
  );
  expect(config.app.windows[0].decorations).toBe(false);
  expect(config.app.windows[0]).not.toHaveProperty("titleBarStyle");
});

it("installs with the Korean hooks, which never touch PATH", () => {
  const { config } = koreanWindowsConfig({ root: "/repo", version: "1.0.5" });
  expect(config.bundle.windows.nsis).toEqual({
    installerHooks: `/repo/${INSTALLER_HOOKS}`,
    languages: ["Korean"],
  });
  const hooks = new URL(INSTALLER_HOOKS, root);
  expect(existsSync(hooks)).toBe(true);
  const text = readFileSync(hooks, "utf8");
  // NSIS reads an include without a BOM in the ANSI code page.
  expect([...text].every((c) => c <= "~")).toBe(true);
  const code = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(";"))
    .join("\n");
  expect(code).not.toMatch(/Environment|PATH|powershell|BuzzUserPath/i);
  expect(code).toContain("NSIS_HOOK_POSTINSTALL");
  expect(code).not.toContain("NSIS_HOOK_POSTUNINSTALL");
});

it("names the installer and a space-free release asset", () => {
  const config = { productName: "Buzz Korean", version: "1.0.5" };
  expect(installerName(config)).toBe("Buzz Korean_1.0.5_x64-setup.exe");
  expect(releaseAssetName(config)).toBe("Buzz.Korean_1.0.5_x64-setup.exe");
});

it("builds an unsigned x64 NSIS installer with the locked lockfile", () => {
  const args = windowsTauriArguments("C:\\temp\\release.json");
  expect(args[0]).toBe("build");
  expect(args).toContain("--no-sign");
  expect(
    args.slice(args.indexOf("--bundles"), args.indexOf("--bundles") + 2),
  ).toEqual(["--bundles", "nsis"]);
  expect(args).toContain(WINDOWS_TARGET);
  expect(WINDOWS_TARGET).toBe("x86_64-pc-windows-msvc");
  expect(args.at(-1)).toBe("--locked");
});
