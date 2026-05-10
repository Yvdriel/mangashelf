"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/contexts/theme";

export function ThemedToaster() {
  const { theme } = useTheme();
  const sonnerTheme = theme === "chalk" ? "light" : "dark";
  return (
    <Toaster richColors position="bottom-center" theme={sonnerTheme} />
  );
}
