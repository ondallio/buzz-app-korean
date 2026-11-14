import { createContext, useContext, type ReactNode } from "react";

const CloseLabel = createContext("Close");

/** The host supplies accessible copy; modal state stays with Base UI. */
export function DialogLabelsProvider({
  closeLabel,
  children,
}: {
  closeLabel: string;
  children: ReactNode;
}) {
  return <CloseLabel value={closeLabel}>{children}</CloseLabel>;
}

/** An explicit label always takes precedence over the host's generic default. */
export function useDialogCloseLabel(override?: string): string {
  const fallback = useContext(CloseLabel);
  return override ?? fallback;
}
