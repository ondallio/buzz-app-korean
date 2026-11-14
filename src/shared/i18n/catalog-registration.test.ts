import { expect, it } from "vitest";
import { english, korean, missingTranslations, translate } from "./index";
import { validateCatalogs } from "./messages";

const catalogs = import.meta.glob<{
  en: Record<string, string>;
  ko: Record<string, string>;
}>("./catalogs/*.ts", { eager: true });

it("registers every actual catalog with no duplicate English keys", () => {
  const keys = Object.values(catalogs).flatMap((catalog) =>
    Object.keys(catalog.en),
  );
  expect(new Set(keys).size).toBe(keys.length);
  expect(english).toEqual(
    Object.assign({}, ...Object.values(catalogs).map((catalog) => catalog.en)),
  );
  expect(korean).toEqual(
    Object.assign({}, ...Object.values(catalogs).map((catalog) => catalog.ko)),
  );
  expect(validateCatalogs(english, korean)).toEqual({
    missing: [],
    unexpected: [],
    variables: [],
  });
});

it("renders English for a real missing Korean entry while retaining it in the unfinished list", () => {
  const key = "language.label";
  const original = korean[key];
  if (original === undefined)
    throw new Error("Expected a Korean fixture entry");
  try {
    delete korean[key];
    expect(translate("ko", key)).toBe(english[key]);
    expect(missingTranslations()).toContain(key);
    expect(validateCatalogs(english, korean).missing).toContain(key);
  } finally {
    korean[key] = original;
  }
});
