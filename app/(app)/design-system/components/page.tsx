export const metadata = { title: "Component Library" };

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Check, TrendingUp, Sparkles, Zap, Copy } from "lucide-react";

export default function ComponentLibraryPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container py-4 max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Component Library</h1>
              <p className="text-sm text-muted-foreground">
                Copy-paste ready components for AutoScale Shorts
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Current
            </Badge>
          </div>
        </div>
      </header>

      <main className="container py-12 max-w-6xl space-y-12">
        {/* Buttons */}
        <ComponentSection
          title="Button Variants"
          description="All button styles and sizes available"
          preview={
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Primary Buttons</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="xl">Extra Large</Button>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Variants</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="default">Default</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                  <Button variant="glow">Glow</Button>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Icon Buttons</p>
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
          }
          code={`import { Button } from "@/components/ui/button";

<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="destructive">Destructive</Button>
<Button size="lg">Large</Button>
<Button variant="glow" size="lg">Glow</Button>
<Button variant="ghost" size="icon">
  <Icon />
</Button>`}
        />

        {/* Badges */}
        <ComponentSection
          title="Badge Variants"
          description="Status indicators and tags"
          preview={
            <div className="space-y-4">
              <div>
                <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Status Badges</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">
                    <Check className="h-3 w-3" />
                    Winner
                  </Badge>
                  <Badge variant="warning">
                    <AlertCircle className="h-3 w-3" />
                    Warning
                  </Badge>
                  <Badge variant="destructive">Error</Badge>
                  <Badge variant="outline">Inactive</Badge>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Regular Badges</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="dot">Dot</Badge>
                </div>
              </div>
            </div>
          }
          code={`import { Badge } from "@/components/ui/badge";

<Badge>Default</Badge>
<Badge variant="success">
  <Check className="h-3 w-3" />
  Winner
</Badge>
<Badge variant="warning">Low Confidence</Badge>
<Badge variant="destructive">Failed</Badge>
<Badge variant="outline">Inactive</Badge>`}
        />

        {/* Cards */}
        <ComponentSection
          title="Card Layouts"
          description="Card structure and composition patterns"
          preview={
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Standard Card</CardTitle>
                  <CardDescription>With header, title, and content</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">This is the main content area.</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Accent Border Card</CardTitle>
                      <CardDescription>Left teal accent border</CardDescription>
                    </div>
                    <Badge variant="success">
                      <Check className="h-3 w-3" />
                      Winner
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold text-primary">+42%</div>
                  <p className="text-xs text-muted-foreground mt-1">Improvement</p>
                </CardContent>
              </Card>

              <Card className="glass border border-border/60">
                <CardHeader>
                  <CardTitle>Glass Card</CardTitle>
                  <CardDescription>Backdrop blur effect</CardDescription>
                </CardHeader>
                <CardContent>Use for modals or floating panels</CardContent>
              </Card>
            </div>
          }
          code={`import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
</Card>

{/* With accent border */}
<Card className="border-l-4 border-l-primary">
  <CardHeader>
    <div className="flex justify-between">
      <div>
        <CardTitle>Title</CardTitle>
      </div>
      <Badge variant="success">Winner</Badge>
    </div>
  </CardHeader>
</Card>

{/* Glass effect */}
<Card className="glass border border-border/60">
  Content
</Card>`}
        />

        {/* Form Components */}
        <ComponentSection
          title="Form Components"
          description="Input fields, selects, and form layouts"
          preview={
            <div className="space-y-6 max-w-md">
              <div>
                <label className="text-sm font-medium block mb-2">Product URL</label>
                <Input type="url" placeholder="https://your-product.com" />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Description</label>
                <Textarea placeholder="Tell us about your product..." rows={4} />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">AI Model</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a model..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt4">GPT-4o</SelectItem>
                    <SelectItem value="claude">Claude 3 Opus</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Disabled Input</label>
                <Input disabled placeholder="This is disabled" />
              </div>
            </div>
          }
          code={`import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

<div className="space-y-2">
  <Label htmlFor="url">Product URL</Label>
  <Input id="url" type="url" placeholder="https://..." />
</div>

<div className="space-y-2">
  <Label htmlFor="desc">Description</Label>
  <Textarea id="desc" placeholder="..." rows={4} />
</div>

<div className="space-y-2">
  <Label htmlFor="model">Model</Label>
  <Select>
    <SelectTrigger id="model">
      <SelectValue placeholder="Choose..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="gpt4">GPT-4o</SelectItem>
    </SelectContent>
  </Select>
</div>`}
        />

        {/* State Examples */}
        <ComponentSection
          title="Common States"
          description="Loading, empty, error, and success states"
          preview={
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-semibold mb-2">Loading State (Skeleton)</p>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2 animate-shimmer" />
                  <div className="h-3 bg-muted rounded w-3/4 animate-shimmer" />
                </div>
              </div>

              <div className="p-6 rounded-lg border border-border text-center py-10">
                <div className="h-12 w-12 rounded-lg bg-muted mx-auto flex items-center justify-center mb-3">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-semibold">Empty State</p>
                <p className="text-sm text-muted-foreground">No data available</p>
                <Button size="sm" className="mt-3">
                  Create
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-success/5 border border-success/20 flex gap-3">
                <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-success">Success</p>
                  <p className="text-xs text-muted-foreground">Your action completed</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">Error</p>
                  <p className="text-xs text-muted-foreground">Something went wrong</p>
                </div>
              </div>
            </div>
          }
          code={`{/* Loading Skeleton */}
<div className="space-y-2">
  <div className="h-4 bg-muted rounded w-1/2 animate-shimmer" />
  <div className="h-3 bg-muted rounded w-3/4 animate-shimmer" />
</div>

{/* Empty State */}
<div className="text-center py-10">
  <div className="h-12 w-12 rounded-lg bg-muted mx-auto flex items-center justify-center mb-3">
    <Zap className="h-6 w-6 text-muted-foreground" />
  </div>
  <p className="font-semibold">Empty State</p>
  <Button className="mt-3">Action</Button>
</div>

{/* Success */}
<div className="p-4 rounded-lg bg-success/5 border border-success/20 flex gap-3">
  <Check className="h-5 w-5 text-success" />
  <div>
    <p className="font-semibold text-success">Success</p>
    <p className="text-sm text-muted-foreground">Message</p>
  </div>
</div>

{/* Error */}
<div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 flex gap-3">
  <AlertCircle className="h-5 w-5 text-destructive" />
  <div>
    <p className="font-semibold text-destructive">Error</p>
    <p className="text-sm text-muted-foreground">Message</p>
  </div>
</div>`}
        />

        {/* Layout Examples */}
        <ComponentSection
          title="Page Layouts"
          description="Common page structure patterns"
          preview={
            <div className="space-y-4">
              <Card>
                <CardHeader className="bg-secondary/50">
                  <CardTitle className="text-base">Container Layout</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">{`<div className="container py-12 max-w-6xl">
  <h1>Page content</h1>
</div>`}</pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    Auto-centered, responsive padding, max-width 1400px
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-secondary/50">
                  <CardTitle className="text-base">Two-Column Grid</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">{`<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <Card>Left</Card>
  <Card>Right</Card>
</div>`}</pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    Mobile: 1 column, tablet+: 2 columns
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="bg-secondary/50">
                  <CardTitle className="text-base">Flex Row (Responsive)</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">{`<div className="flex flex-col sm:flex-row gap-4">
  <Button>Button 1</Button>
  <Button>Button 2</Button>
</div>`}</pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    Mobile: stacked, small screens+: horizontal
                  </p>
                </CardContent>
              </Card>
            </div>
          }
          code=""
        />

        {/* Hero Section */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Hero Section Example</h2>
          <div className="relative rounded-lg border border-border bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden p-8 md:p-16">
            <div className="absolute inset-0 -z-10 gradient-mesh opacity-40" />
            <div className="relative text-center max-w-2xl mx-auto">
              <Badge variant="outline" className="mb-4 justify-center w-full sm:w-auto">
                <Sparkles className="h-3 w-3" />
                AI-powered growth
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

          <Card className="mt-6">
            <CardHeader className="bg-secondary/50">
              <CardTitle className="text-base">Code</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">{`<section className="relative pt-40 pb-20 overflow-hidden">
  <div className="absolute inset-0 -z-10 gradient-mesh" />
  <div className="container text-center">
    <Badge variant="outline" className="mb-4">
      <Sparkles className="h-3 w-3" />
      AI-powered growth
    </Badge>
    <h1 className="mt-6 text-5xl font-semibold text-gradient">
      Find the format that brings users.
    </h1>
    <p className="mt-6 text-muted-foreground text-lg">Description</p>
    <Button variant="glow" size="lg" className="mt-8">
      Get Started
    </Button>
  </div>
</section>`}</pre>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <div className="border-t border-border pt-12">
          <p className="text-sm text-muted-foreground text-center">
            All components are production-ready. Import from <code className="font-mono">@/components/ui/</code>
          </p>
        </div>
      </main>
    </div>
  );
}

function ComponentSection({
  title,
  description,
  preview,
  code,
}: {
  title: string;
  description: string;
  preview: React.ReactNode;
  code: string;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="bg-secondary/50">
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">{preview}</CardContent>
        </Card>

        {code && (
          <Card>
            <CardHeader className="bg-secondary/50 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Code</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Copy className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <pre className="bg-muted p-4 rounded-b-lg text-xs font-mono overflow-x-auto max-h-96">
                {code}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
