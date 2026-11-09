import { useLanguage } from "./language";
import { resolveMessage, type DisplayMessage } from "./deferred-message";

/** Live app-owned text for notices that outlive their originating component. */
export function TranslatedMessage({ value }: { value: DisplayMessage }) {
  useLanguage();
  return resolveMessage(value);
}
