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
    default: "AutoScale — Growth infrastructure for technical founders",
    template: "%s · AutoScale",
  },
  description:
    "AutoScale is the AI growth operating system for technical founders. Reverse-engineer your niche, generate content experiments, schedule distribution, measure results, and compound winners.",
  keywords: [
    "startup distribution",
    "content marketing",
    "trendwatch",
    "growth engine",
    "indie hacker",
    "saas marketing",
    "viral content",
    "founder growth",
    "ai marketing",
  ],
  authors: [{ name: "AutoScale" }],
  openGraph: {
    title: "AutoScale — Scale distribution, not servers",
    description:
      "The AI growth operating system for technical founders. Find what already works, generate content experiments, schedule, measure, and compound winners.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AutoScale — Scale distribution, not servers",
    description:
      "The AI growth operating system for technical founders.",
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
