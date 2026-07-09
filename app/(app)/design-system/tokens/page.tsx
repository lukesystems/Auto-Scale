export const metadata = { title: "Design Tokens" };

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DesignTokensPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container py-6 max-w-6xl">
          <h1 className="text-3xl font-bold">Design Tokens Reference</h1>
          <p className="mt-2 text-muted-foreground">
            CSS custom properties and their semantic usage throughout AutoScale Shorts.
          </p>
        </div>
      </header>

      <main className="container py-12 max-w-6xl space-y-12">
        {/* Colors */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Color Tokens</h2>

          <div className="space-y-8">
            {/* Primary Colors */}
            <div>
              <h3 className="mb-4 text-lg font-semibold">Primary (Teal)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TokenCard
                  name="--primary"
                  light="158 84% 39%"
                  dark="158 84% 45%"
                  usage="Buttons, links, interactive elements, primary actions"
                  example={
                    <div className="h-12 rounded bg-primary flex items-center justify-center text-primary-foreground font-medium">
                      Primary Action
                    </div>
                  }
                />
                <TokenCard
                  name="--primary-foreground"
                  light="0 0% 100%"
                  dark="222 47% 4%"
                  usage="Text and icons on primary backgrounds"
                  example={
                    <div className="h-12 rounded bg-primary flex items-center justify-center">
                      <span style={{ color: "hsl(var(--primary-foreground))" }} className="font-medium">
                        White text
                      </span>
                    </div>
                  }
                />
              </div>
            </div>

            {/* Accent Colors */}
            <div>
              <h3 className="mb-4 text-lg font-semibold">Accent (Highlight)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TokenCard
                  name="--accent"
                  light="158 84% 95%"
                  dark="158 84% 14%"
                  usage="Highlight backgrounds, light teal emphasis"
                  example={
                    <div className="h-12 rounded bg-accent flex items-center justify-center text-accent-foreground font-medium">
                      Accent bg
                    </div>
                  }
                />
                <TokenCard
                  name="--accent-foreground"
                  light="158 84% 25%"
                  dark="158 84% 80%"
                  usage="Text on accent backgrounds"
                />
              </div>
            </div>

            {/* Semantic Colors */}
            <div>
              <h3 className="mb-4 text-lg font-semibold">Semantic Status Colors</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <TokenCard
                  name="--success"
                  light="142 71% 45%"
                  dark="142 71% 45%"
                  usage="Winners, positive signals, completed states"
                  example={
                    <div className="h-12 rounded bg-success flex items-center justify-center text-success-foreground font-medium">
                      Winner ✓
                    </div>
                  }
                />
                <TokenCard
                  name="--warning"
                  light="38 92% 50%"
                  dark="38 92% 50%"
                  usage="Cautions, low confidence, requires review"
                  example={
                    <div className="h-12 rounded bg-warning flex items-center justify-center text-warning-foreground font-medium">
                      Warning
                    </div>
                  }
                />
                <TokenCard
                  name="--destructive"
                  light="0 84% 60%"
                  dark="0 72% 51%"
                  usage="Errors, delete actions, failures"
                  example={
                    <div className="h-12 rounded bg-destructive flex items-center justify-center text-destructive-foreground font-medium">
                      Delete
                    </div>
                  }
                />
              </div>
            </div>

            {/* Surface Colors */}
            <div>
              <h3 className="mb-4 text-lg font-semibold">Surface & Text Colors</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TokenCard
                  name="--background"
                  light="0 0% 100%"
                  dark="222 47% 4%"
                  usage="Main page background, page bg"
                />
                <TokenCard
                  name="--foreground"
                  light="222 47% 6%"
                  dark="210 40% 98%"
                  usage="Body text, primary text content"
                />
                <TokenCard
                  name="--card"
                  light="0 0% 100%"
                  dark="222 47% 6%"
                  usage="Card backgrounds, elevated surfaces"
                />
                <TokenCard
                  name="--card-foreground"
                  light="222 47% 6%"
                  dark="210 40% 98%"
                  usage="Text on card backgrounds"
                />
                <TokenCard
                  name="--secondary"
                  light="220 14% 96%"
                  dark="217 33% 12%"
                  usage="Secondary surfaces, alternate backgrounds"
                />
                <TokenCard
                  name="--secondary-foreground"
                  light="222 47% 11%"
                  dark="210 40% 98%"
                  usage="Text on secondary surfaces"
                />
              </div>
            </div>

            {/* Utility Colors */}
            <div>
              <h3 className="mb-4 text-lg font-semibold">Utility Colors</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TokenCard
                  name="--muted"
                  light="220 14% 96%"
                  dark="217 33% 11%"
                  usage="Disabled states, skeleton backgrounds"
                />
                <TokenCard
                  name="--muted-foreground"
                  light="220 9% 46%"
                  dark="215 20% 65%"
                  usage="Secondary text, hints, inactive states"
                />
                <TokenCard
                  name="--border"
                  light="220 13% 91%"
                  dark="217 33% 14%"
                  usage="Subtle borders, dividers, card edges"
                />
                <TokenCard
                  name="--input"
                  light="220 13% 91%"
                  dark="217 33% 14%"
                  usage="Input field backgrounds"
                />
                <TokenCard
                  name="--ring"
                  light="158 84% 39%"
                  dark="158 84% 45%"
                  usage="Focus rings, keyboard navigation indicators (primary)"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Spacing Scale</h2>
          <div className="space-y-4">
            {[
              { token: "gap-1", value: "4px", usage: "Icon + text tight spacing" },
              { token: "gap-2", value: "8px", usage: "Component padding, small gaps" },
              { token: "gap-3", value: "12px", usage: "Medium gaps, section padding" },
              { token: "gap-4", value: "16px", usage: "Standard padding, default spacing" },
              { token: "gap-6", value: "24px", usage: "Large padding, section spacing" },
              { token: "gap-8", value: "32px", usage: "XL spacing, major sections" },
              { token: "gap-10", value: "40px", usage: "XXL spacing, page sections" },
            ].map((item) => (
              <div key={item.token} className="flex items-center gap-4 p-4 rounded-lg border border-border">
                <code className="font-mono font-semibold w-24">{item.token}</code>
                <div className="flex-1">
                  <p className="font-medium">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.usage}</p>
                </div>
                <div className="flex-shrink-0 h-8 bg-primary rounded opacity-50" style={{ width: item.value }} />
              </div>
            ))}
          </div>
        </section>

        {/* Border Radius */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Border Radius</h2>
          <div className="space-y-4">
            {[
              { token: "rounded-sm", value: "4px", usage: "Compact components" },
              { token: "rounded-md", value: "8px", usage: "Medium (some inputs, small cards)" },
              { token: "rounded-lg", value: "12px", usage: "Default (buttons, cards, dialogs)" },
              { token: "rounded-xl", value: "16px", usage: "Larger cards, hero sections" },
              { token: "rounded-2xl", value: "20px", usage: "Large UI sections, glass panels" },
              { token: "rounded-full", value: "9999px", usage: "Badges, pill buttons" },
            ].map((item) => (
              <div key={item.token} className="flex items-center gap-4 p-4 rounded-lg border border-border">
                <code className="font-mono font-semibold w-32">{item.token}</code>
                <div className="flex-1">
                  <p className="font-medium">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.usage}</p>
                </div>
                <div
                  className="flex-shrink-0 h-8 w-8 bg-primary"
                  style={{ borderRadius: item.value }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Font Sizes */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Typography Tokens</h2>
          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-lg font-semibold">Font Families</h3>
              <div className="space-y-2">
                <div className="p-4 border border-border rounded-lg">
                  <code className="font-mono">--font-sans</code>
                  <p className="text-sm text-muted-foreground mt-1">Inter, system-ui, sans-serif (body, UI)</p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <code className="font-mono">--font-display</code>
                  <p className="text-sm text-muted-foreground mt-1">Inter, system-ui, sans-serif (headings)</p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <code className="font-mono">--font-mono</code>
                  <p className="text-sm text-muted-foreground mt-1">
                    JetBrains Mono, ui-monospace, monospace (code)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold">Font Sizes</h3>
              <div className="space-y-3">
                {[
                  { size: "text-xs", value: "12px", usage: "Labels, badges, meta" },
                  { size: "text-sm", value: "14px", usage: "Secondary text, hints" },
                  { size: "text-base", value: "16px", usage: "Body text default" },
                  { size: "text-lg", value: "18px", usage: "Card titles, section headers" },
                  { size: "text-2xl", value: "24px", usage: "Section headings" },
                  { size: "text-3xl", value: "30px", usage: "Page titles" },
                  { size: "text-5xl", value: "48px", usage: "Hero headings (landing)" },
                  { size: "text-7xl", value: "56px", usage: "Large hero (landing)" },
                ].map((item) => (
                  <div key={item.size} className={`p-4 border border-border rounded-lg ${item.size}`}>
                    <span className="font-semibold">{item.value}</span>
                    <span className="ml-3 text-muted-foreground">{item.usage}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Shadow System */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Shadow System</h2>
          <div className="space-y-4">
            {[
              { name: "shadow-sm", usage: "Light elevation, subtle depth" },
              { name: "shadow-md", usage: "Card hover state" },
              { name: "shadow-lg", usage: "Modals, popovers" },
              { name: "shadow-xl", usage: "Maximum elevation" },
              { name: "shadow-2xl", usage: "Hero backdrops" },
            ].map((item) => (
              <div key={item.name} className="flex items-end gap-4 p-4 border border-border rounded-lg">
                <div className={`flex-1 h-16 bg-card rounded ${item.name}`} />
                <div className="flex-1">
                  <code className="font-mono font-semibold">{item.name}</code>
                  <p className="text-sm text-muted-foreground">{item.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Animations */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Animation Tokens</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: "fade-in", duration: "0.4s", usage: "Fade in from invisible" },
              { name: "fade-up", duration: "0.6s", usage: "Fade in + slide up (20px)" },
              { name: "slide-in", duration: "0.35s", usage: "Slide in from below (12px)" },
              { name: "scale-in", duration: "0.3s", usage: "Scale up from 0.96" },
              { name: "shimmer", duration: "3s", usage: "Loading skeleton pulse" },
              { name: "pulse-soft", duration: "2s", usage: "Gentle pulse (opacity)" },
              { name: "gradient-shift", duration: "8s", usage: "Animated gradient shift" },
            ].map((item) => (
              <Card key={item.name}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{item.name}</CardTitle>
                  <CardDescription>{item.duration}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{item.usage}</p>
                  <code className="font-mono text-xs">{`animate-${item.name}`}</code>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Breakpoints */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Responsive Breakpoints</h2>
          <div className="space-y-2">
            {[
              { breakpoint: "sm", width: "640px", usage: "Small screens, tablets" },
              { breakpoint: "md", width: "768px", usage: "Medium screens, small laptops" },
              { breakpoint: "lg", width: "1024px", usage: "Large screens, laptops" },
              { breakpoint: "xl", width: "1280px", usage: "Extra large screens" },
              { breakpoint: "2xl", width: "1400px", usage: "Container max-width" },
            ].map((item) => (
              <div key={item.breakpoint} className="flex items-center gap-4 p-3 border border-border rounded-lg">
                <Badge variant="outline" className="font-mono min-w-fit">
                  {item.breakpoint}
                </Badge>
                <div className="flex-1">
                  <p className="font-medium">{item.width}</p>
                  <p className="text-sm text-muted-foreground">{item.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Usage in Code */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Usage in Code</h2>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Using Tailwind Classes</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-secondary p-4 rounded-lg overflow-x-auto text-sm font-mono">
{`// Colors
<button className="bg-primary text-primary-foreground">
<div className="bg-success">Winner</div>
<span className="text-muted-foreground">Secondary text</span>

// Spacing
<div className="p-4 gap-2">
<section className="py-10 mb-8">

// Typography
<h1 className="text-5xl font-semibold">
<p className="text-sm text-muted-foreground">

// Responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// Animation
<div className="animate-fade-in">
<div className="animate-pulse-soft">`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Using CSS Custom Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-secondary p-4 rounded-lg overflow-x-auto text-sm font-mono">
{`/* Direct CSS var access */
const primaryColor = \`hsl(var(--primary))\`;

/* In CSS-in-JS */
style={{
  backgroundColor: \`hsl(var(--primary))\`,
  color: \`hsl(var(--primary-foreground))\`,
}}

/* In global styles */
.my-element {
  color: hsl(var(--foreground));
  background: hsl(var(--primary) / 0.1);
}`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-border pt-12">
          <p className="text-sm text-muted-foreground text-center">
            All tokens are defined in <code className="font-mono">app/globals.css</code> and <code className="font-mono">tailwind.config.ts</code>
          </p>
        </div>
      </main>
    </div>
  );
}

function TokenCard({
  name,
  light,
  dark,
  usage,
  example,
}: {
  name: string;
  light: string;
  dark: string;
  usage: string;
  example?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-mono">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {example && <div>{example}</div>}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Light Mode</p>
          <code className="text-xs font-mono text-foreground">{light}</code>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Dark Mode</p>
          <code className="text-xs font-mono text-foreground">{dark}</code>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Usage</p>
          <p className="text-sm text-muted-foreground">{usage}</p>
        </div>
      </CardContent>
    </Card>
  );
}
