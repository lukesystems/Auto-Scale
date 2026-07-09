export const metadata = { title: "Design System" };
export const dynamic = "force-dynamic";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, TrendingUp, Check, X, AlertCircle } from "lucide-react";

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container py-6 max-w-6xl">
          <h1 className="text-3xl font-bold text-balance">AutoScale Shorts Design System</h1>
          <p className="mt-2 text-muted-foreground">
            Complete reference for colors, typography, components, and patterns.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            See <Link href="/design-system/tokens" className="text-primary hover:underline">tokens</Link> and <Link href="/design-system/patterns" className="text-primary hover:underline">patterns</Link> for detailed breakdowns.
          </p>
        </div>
      </header>

      <main className="container py-12 max-w-6xl space-y-16">
        {/* Color Palette */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Color Palette</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Light Mode */}
            <div>
              <h3 className="mb-3 font-semibold text-sm uppercase tracking-wider text-muted-foreground">Light Mode</h3>
              <div className="space-y-2">
                <ColorSwatch name="Background" hex="ffffff" />
                <ColorSwatch name="Foreground" hex="0f1318" />
                <ColorSwatch name="Primary (Teal)" hex="2dd4ad" />
                <ColorSwatch name="Primary Foreground" hex="ffffff" />
                <ColorSwatch name="Accent" hex="f0fdf9" />
                <ColorSwatch name="Secondary" hex="f7f7f9" />
                <ColorSwatch name="Muted" hex="f7f7f9" />
                <ColorSwatch name="Muted Foreground" hex="75777e" />
                <ColorSwatch name="Success" hex="4f8b4d" />
                <ColorSwatch name="Destructive" hex="e63d4f" />
                <ColorSwatch name="Warning" hex="ffb300" />
                <ColorSwatch name="Border" hex="e7e8eb" />
              </div>
            </div>

            {/* Dark Mode */}
            <div>
              <h3 className="mb-3 font-semibold text-sm uppercase tracking-wider text-muted-foreground">Dark Mode</h3>
              <div className="space-y-2 p-4 rounded-lg bg-secondary">
                <ColorSwatch name="Background" hex="0a0f0d" isDark />
                <ColorSwatch name="Foreground" hex="faf9f7" isDark />
                <ColorSwatch name="Primary (Teal)" hex="3ddd9d" isDark />
                <ColorSwatch name="Primary Foreground" hex="0a0f0d" isDark />
                <ColorSwatch name="Accent" hex="0f2420" isDark />
                <ColorSwatch name="Secondary" hex="1c1f23" isDark />
                <ColorSwatch name="Muted" hex="1b1e22" isDark />
                <ColorSwatch name="Muted Foreground" hex="a6aca8" isDark />
                <ColorSwatch name="Success" hex="4f8b4d" isDark />
                <ColorSwatch name="Destructive" hex="d13858" isDark />
                <ColorSwatch name="Warning" hex="ffb300" isDark />
                <ColorSwatch name="Border" hex "2a2e32" isDark />
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Typography</h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Hero / Display (56px, semibold)</p>
              <h1 className="text-7xl font-semibold tracking-tight">Find the format that brings users</h1>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Heading 1 (48px, semibold)</p>
              <h2 className="text-5xl font-semibold tracking-tight">Growth Run Dashboard</h2>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Heading 2 (30px, semibold)</p>
              <h3 className="text-3xl font-semibold tracking-tight">Your Winners</h3>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Heading 3 (18px, semibold)</p>
              <h4 className="text-lg font-semibold tracking-tight">Product Brief</h4>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Body (16px, regular)</p>
              <p className="text-base">
                Paste your product URL. AutoScale Shorts discovers what&apos;s working in your niche, ships controlled
                video experiments, and compounds the winners.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Small / Secondary (14px, regular)</p>
              <p className="text-sm text-muted-foreground">
                Use this for secondary information, hints, and descriptions.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Label / Meta (12px, regular)</p>
              <p className="text-xs text-muted-foreground">VIDEOS SHIPPED · FORMATS TESTED · WINNERS COMPOUNDED</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Monospace (Code)</p>
              <code className="font-mono text-sm bg-secondary px-2 py-1 rounded">
                const token = "--primary": 158 84% 39%
              </code>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Buttons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Default (Primary)</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="default" size="sm">
                    Small
                  </Button>
                  <Button variant="default">Default</Button>
                  <Button variant="default" size="lg">
                    Large
                  </Button>
                  <Button variant="default" size="xl">
                    Extra Large
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Outline</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm">
                    Small
                  </Button>
                  <Button variant="outline">Default</Button>
                  <Button variant="outline" size="lg">
                    Large
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Destructive</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" size="sm">
                    Delete
                  </Button>
                  <Button variant="destructive">Remove</Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Secondary</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm">
                    Small
                  </Button>
                  <Button variant="secondary">Default</Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Ghost</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm">
                    Small
                  </Button>
                  <Button variant="ghost">Default</Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Link</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="link" size="sm">
                    Small Link
                  </Button>
                  <Button variant="link">Default Link</Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Glow (Hero)</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="glow" size="sm">
                    Small
                  </Button>
                  <Button variant="glow">Default</Button>
                  <Button variant="glow" size="lg">
                    Large
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Icon</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="default" size="icon">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <TrendingUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Badges</h2>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Variants</p>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="success">
                  <Check className="h-3 w-3" />
                  Success
                </Badge>
                <Badge variant="warning">
                  <AlertCircle className="h-3 w-3" />
                  Warning
                </Badge>
                <Badge variant="destructive">
                  <X className="h-3 w-3" />
                  Destructive
                </Badge>
                <Badge variant="dot">Dot</Badge>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Status Use Cases</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="success">
                    <Check className="h-3 w-3" />
                    Winner
                  </Badge>
                  <span className="text-sm text-muted-foreground">Positive signal, experiment won</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <TrendingUp className="h-3 w-3" />
                    Promising
                  </Badge>
                  <span className="text-sm text-muted-foreground">Good early signals</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Low Confidence</Badge>
                  <span className="text-sm text-muted-foreground">Requires human review</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Failed</Badge>
                  <span className="text-sm text-muted-foreground">Experiment did not convert</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Standard Card</CardTitle>
                <CardDescription>With header, title, and description</CardDescription>
              </CardHeader>
              <CardContent>This is the main content area of the card.</CardContent>
              <CardFooter>
                <Button>Action</Button>
              </CardFooter>
            </Card>

            <Card className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Growth Run #3</CardTitle>
                    <CardDescription>Exploitation batch</CardDescription>
                  </div>
                  <Badge variant="success">
                    <Check className="h-3 w-3" />
                    Winner
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-primary">+42% CTR</div>
                <p className="text-xs text-muted-foreground mt-1">Compared to previous batch</p>
              </CardContent>
            </Card>

            <Card className="glass border border-border/60">
              <CardHeader>
                <CardTitle>Glass Card</CardTitle>
                <CardDescription>With backdrop blur effect</CardDescription>
              </CardHeader>
              <CardContent>This card uses the glass morphism style for overlays.</CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>Elevated on Hover</CardTitle>
                <CardDescription>Shadow increases on hover</CardDescription>
              </CardHeader>
              <CardContent>Interactive card with subtle depth change.</CardContent>
            </Card>
          </div>
        </section>

        {/* Form Components */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Form Components</h2>
          <Card>
            <CardHeader>
              <CardTitle>Contact & Input Examples</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="url">Product URL</Label>
                <Input id="url" type="url" placeholder="https://your-product.com" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Tell us about your product..." rows={4} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <Select>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select a model..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt4">GPT-4o</SelectItem>
                    <SelectItem value="claude3">Claude 3 Opus</SelectItem>
                    <SelectItem value="claude35">Claude 3.5 Sonnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>States</Label>
                <Input disabled placeholder="Disabled input" />
                <Input value="Read-only value" readOnly />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Background Patterns */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Background Patterns</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative h-48 rounded-lg border border-border bg-grid overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <p className="text-sm font-medium">Grid Pattern</p>
              </div>
            </div>

            <div className="relative h-48 rounded-lg border border-border bg-dot overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <p className="text-sm font-medium">Dot Pattern</p>
              </div>
            </div>

            <div className="relative h-48 rounded-lg border border-border gradient-mesh overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <p className="text-sm font-medium">Gradient Mesh</p>
              </div>
            </div>

            <div className="relative h-48 rounded-lg border border-border glass overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm font-medium">Glass Morphism</p>
              </div>
            </div>
          </div>
        </section>

        {/* Text Utilities */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Text Utilities</h2>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Text Gradient</p>
              <h3 className="text-3xl font-semibold text-gradient">
                Bring users to your product.
              </h3>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Text Balance</p>
              <p className="text-lg text-balance">
                This text will automatically wrap and break at word boundaries to balance line lengths and improve
                readability.
              </p>
            </div>
          </div>
        </section>

        {/* Real-World Examples */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Real-World Sections</h2>

          {/* Hero Section */}
          <div className="mb-8 relative rounded-2xl border border-border bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden p-8 md:p-16">
            <div className="absolute inset-0 -z-10 gradient-mesh opacity-40" />
            <div className="relative text-center max-w-2xl mx-auto">
              <Badge variant="outline" className="mb-4 justify-center w-full sm:w-auto">
                <Sparkles className="h-3 w-3" />
                AI growth intelligence
              </Badge>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance mt-4">
                <span className="text-gradient">Find the format</span> that brings users.
              </h2>
              <p className="mt-6 text-muted-foreground text-lg text-balance">
                Paste your product URL. We discover what&apos;s working, ship experiments, and compound winners.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="glow" size="lg">
                  Get Started
                </Button>
                <Button variant="outline" size="lg">
                  Learn More
                </Button>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Run Status Dashboard</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Videos Shipped", value: "9", color: "text-primary" },
                { label: "Formats Tested", value: "3", color: "text-foreground" },
                { label: "Winners Compounded", value: "2", color: "text-success" },
              ].map((stat) => (
                <Card key={stat.label} className="text-center">
                  <CardContent className="pt-6">
                    <div className={`text-3xl font-semibold ${stat.color}`}>{stat.value}</div>
                    <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Animation Examples */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Animations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fade-In</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="animate-fade-in text-center py-8 text-muted-foreground">
                  This element fades in over 0.4s
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fade-Up</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="animate-fade-up text-center py-8 text-muted-foreground">
                  This element fades in and slides up over 0.6s
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Scale-In</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center py-8">
                  <div className="animate-scale-in h-8 w-8 rounded-full bg-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pulse-Soft</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center py-8">
                  <div className="h-3 w-3 rounded-full bg-primary animate-pulse-soft" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-border pt-12">
          <p className="text-sm text-muted-foreground text-center">
            For detailed documentation, see <code className="font-mono">DESIGN_SYSTEM.md</code>
          </p>
        </div>
      </main>
    </div>
  );
}

function ColorSwatch({ name, hex, isDark = false }: { name: string; hex: string; isDark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-md border border-border shadow-sm"
        style={{ backgroundColor: `#${hex}` }}
      />
      <div className={`text-sm ${isDark ? "text-foreground/80" : ""}`}>
        <p className="font-medium">{name}</p>
        <p className={`text-xs font-mono ${isDark ? "text-foreground/50" : "text-muted-foreground"}`}>#{hex}</p>
      </div>
    </div>
  );
}
