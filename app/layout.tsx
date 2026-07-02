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
    default: "AutoScale — Autonomous Video Growth Engine for Founders",
    template: "%s · AutoScale",
  },
  description:
    "Paste your product URL. AutoScale reads your site, hops viral short-form trends on TikTok, Reels, and YouTube Shorts, ships an exploration batch of video experiments, and compounds the winners into variants.",
  keywords: [
    "video growth engine",
    "short-form video for founders",
    "TikTok growth for SaaS",
    "Instagram Reels for startups",
    "YouTube Shorts for founders",
    "trend hopping",
    "growth runs",
    "indie hacker distribution",
    "autonomous video marketing",
  ],
  authors: [{ name: "AutoScale" }],
  openGraph: {
    title: "AutoScale — Autonomous Video Growth Engine for Founders",
    description:
      "Paste your URL. Hop viral trends. Ship an exploration batch of short-form videos. Compound the winners into variants.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AutoScale — Autonomous video growth for founders",
    description:
      "Ship the short-form videos that actually bring users. Trend hop, experiment, compound winners.",
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
