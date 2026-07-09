import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container py-4">
          <Link href="/" className="font-display text-lg font-semibold">
            AutoScale<span className="text-primary">Shorts</span>
          </Link>
        </div>
      </header>
      <main className="container max-w-3xl py-12 text-[15px] leading-relaxed [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1 [&_a]:underline">
        {children}
      </main>
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        Questions? <a className="underline" href="mailto:support@autoscaleshorts.com">support@autoscaleshorts.com</a>
      </footer>
    </div>
  );
}
