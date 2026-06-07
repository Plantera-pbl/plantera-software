"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

const FONT_FAMILY =
  "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";

const lightAppearance = {
  variables: {
    colorPrimary: "#16a34a",
    colorBackground: "#ffffff",
    colorText: "#111827",
    colorTextSecondary: "#6b7280",
    colorInputBackground: "#ffffff",
    colorInputText: "#111827",
    borderRadius: "0.75rem",
    fontFamily: FONT_FAMILY,
  },
  elements: {
    card: "shadow-lg shadow-green-100/50",
    headerTitle: "text-green-900",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButton:
      "border border-gray-200 hover:bg-gray-50 transition",
    dividerLine: "bg-gray-100",
    dividerText: "text-gray-400 text-xs",
    formFieldLabel: "text-sm font-medium text-gray-700",
    formFieldInput:
      "rounded-lg border-gray-200 focus:border-green-400 focus:ring-green-400",
    formButtonPrimary:
      "bg-green-600 hover:bg-green-700 transition rounded-lg text-sm font-medium",
    footerActionLink: "text-green-600 hover:text-green-700 font-medium",
    identityPreviewEditButton: "text-green-600",
    badge: "bg-green-50 text-green-700",
  },
} as const;

const darkAppearance = {
  variables: {
    colorPrimary: "#16a34a",
    colorBackground: "#111827",
    colorText: "#f9fafb",
    colorTextSecondary: "#9ca3af",
    colorInputBackground: "#1f2937",
    colorInputText: "#f9fafb",
    borderRadius: "0.75rem",
    fontFamily: FONT_FAMILY,
  },
  elements: {
    card: "shadow-lg shadow-green-900/20 !bg-gray-900 border border-gray-700",
    headerTitle: "!text-green-400",
    headerSubtitle: "!text-gray-400",
    socialButtonsBlockButton:
      "border border-gray-600 hover:bg-gray-700 transition !text-gray-200",
    dividerLine: "!bg-gray-700",
    dividerText: "!text-gray-500 text-xs",
    formFieldLabel: "text-sm font-medium !text-gray-300",
    formFieldInput:
      "rounded-lg !border-gray-600 !bg-gray-800 !text-gray-100 focus:!border-green-500",
    formButtonPrimary:
      "bg-green-600 hover:bg-green-700 transition rounded-lg text-sm font-medium",
    footerActionLink: "!text-green-400 hover:!text-green-300 font-medium",
    identityPreviewEditButton: "!text-green-400",
    badge: "!bg-green-900/50 !text-green-400",
  },
} as const;

export function ClerkThemeWrapper({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <ClerkProvider appearance={isDark ? darkAppearance : lightAppearance}>
      {children}
    </ClerkProvider>
  );
}
