import { useLayoutEffect } from "react";
import { useLanguage } from "./language";

/** Updates assistive pronunciation without replacing React's root or its children. */
export function useLanguageDocument(): void {
  const language = useLanguage();
  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
}
