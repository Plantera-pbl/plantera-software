import "@/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "Plantera - Smart Plant Care with Arduino & AI",
  description:
    "Track your plants' health and growth with IoT sensors and AI-powered insights. Plantera helps you nurture your green friends.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Plantera",
  },
  formatDetection: {
    telephone: false,
  },
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/icons/icon-192x192.png" },
  ],
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#16a34a",
          colorBackground: "#ffffff",
          colorText: "#111827",
          colorTextSecondary: "#6b7280",
          colorInputBackground: "#ffffff",
          colorInputText: "#111827",
          borderRadius: "0.75rem",
          fontFamily:
            "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
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
      }}
    >
      <html lang="en" className={`${geist.variable}`}>
        <body>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
