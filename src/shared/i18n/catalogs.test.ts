import { expect, it } from "vitest";
import { english, korean } from "./index";
import { validateCatalogs } from "./messages";

it("registers every catalog and rejects missing translations, duplicate keys and different variables", () => {
  const catalogs = import.meta.glob<{
    en: Record<string, string>;
    ko: Record<string, string>;
  }>("./catalogs/*.ts", { eager: true });
  const allEnglish: Record<string, string> = {};
  const allKorean: Record<string, string> = {};
  for (const { en, ko } of Object.values(catalogs)) {
    for (const key of Object.keys(en))
      expect(Object.hasOwn(allEnglish, key), key).toBe(false);
    Object.assign(allEnglish, en);
    Object.assign(allKorean, ko);
  }
  expect(english).toEqual(allEnglish);
  expect(korean).toEqual(allKorean);
  expect(validateCatalogs(english, korean)).toEqual({
    missing: [],
    unexpected: [],
    variables: [],
  });
});
