import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "AutoScale — Crack distribution with videos that compound",
    template: "%s · AutoScale",
  },
  description:
    "AutoScale finds proven short-form video patterns, turns them into videos for your product, tracks what brings users, and compounds the winners.",
  keywords: [
    "startup distribution",
    "short-form video growth",
    "video trend research",
    "growth runs",
    "indie hacker",
    "saas marketing",
    "trend-backed videos",
    "founder growth",
    "ai marketing",
  ],
  authors: [{ name: "AutoScale" }],
  openGraph: {
    title: "AutoScale — Crack distribution with videos that compound",
    description:
      "Find proven short-form video patterns, turn them into videos for your product, track what brings users, and compound the winners.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AutoScale — Videos that compound",
    description:
      "Crack distribution with videos that compound.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <TooltipProvider delayDuration={200}>
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
