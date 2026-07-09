export const metadata = { title: "Design Patterns" };

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, TrendingUp, Zap } from "lucide-react";

export default function DesignPatternsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container py-6 max-w-6xl">
          <h1 className="text-3xl font-bold">Design Patterns & Best Practices</h1>
          <p className="mt-2 text-muted-foreground">
            Proven patterns for common UI tasks in AutoScale Shorts, enforcing the evidence chain and clarity.
          </p>
        </div>
      </header>

      <main className="container py-12 max-w-6xl space-y-12">
        {/* Status Badges */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Status Indicators & Badges</h2>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Winner / Success</CardTitle>
                <CardDescription>Positive signal: experiment won, or target achieved</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="success">
                    <Check className="h-3 w-3" />
                    Winner
                  </Badge>
                  <span className="text-sm text-muted-foreground">+42% CTR vs baseline</span>
                </div>
                <pre className="bg-secondary p-3 rounded text-xs font-mono overflow-x-auto">{`<Badge variant="success">
  <Check className="h-3 w-3" />
  Winner
</Badge>`}</pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Promising / Trending</CardTitle>
                <CardDescription>Good early signals, worth monitoring</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <TrendingUp className="h-3 w-3" />
                    Trending
                  </Badge>
                  <span className="text-sm text-muted-foreground">5% day-over-day growth</span>
                </div>
                <pre className="bg-secondary p-3 rounded text-xs font-mono overflow-x-auto">{`<Badge variant="outline">
  <TrendingUp className="h-3 w-3" />
  Trending
</Badge>`}</pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Low Confidence / Warning</CardTitle>
                <CardDescription>Requires human review or more data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">
                    <AlertCircle className="h-3 w-3" />
                    Low Confidence
                  </Badge>
                  <span className="text-sm text-muted-foreground">Sample size &lt; 30</span>
                </div>
                <pre className="bg-secondary p-3 rounded text-xs font-mono overflow-x-auto">{`<Badge variant="warning">
  <AlertCircle className="h-3 w-3" />
  Low Confidence
</Badge>`}</pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Failed / Destructive</CardTitle>
                <CardDescription>Experiment failed, no signal, or error state</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Failed</Badge>
                  <span className="text-sm text-muted-foreground">No conversion increase</span>
                </div>
                <pre className="bg-secondary p-3 rounded text-xs font-mono overflow-x-auto">{`<Badge variant="destructive">
  Failed
</Badge>`}</pre>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Evidence Chain Patterns */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Evidence Chain Patterns</h2>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linking Source to Insight</CardTitle>
              <CardDescription>Every TrendWatch insight must be tied to a source</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">When displaying a TrendWatch insight or content concept:</p>
              <div className="bg-secondary p-4 rounded-lg space-y-2 text-sm">
                <div>
                  <p className="font-semibold">Trend Insight</p>
                  <p className="text-muted-foreground">"Founders are tweeting about feature shipping speed"</p>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  ↳ Source: <span className="text-primary font-mono">@paulg</span> (Twitter, Nov 2024)
                </div>
              </div>
              <p className="text-sm mt-4">
                <strong>Rule:</strong> Always show source metadata (creator, platform, date) below the insight.
              </p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Confidence & Low-Confidence Warning</CardTitle>
              <CardDescription>Mark claims that lack strong source evidence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-secondary p-4 rounded-lg space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Low-Confidence Insight</p>
                    <p className="text-muted-foreground text-xs">
                      This insight has fewer than 3 supporting sources or low engagement signals.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm mt-4">
                <strong>Rule:</strong> Always explicitly mark low-confidence insights. Never state them as fact.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Form Patterns */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Form & Input Patterns</h2>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">URL Input (Product Discovery)</CardTitle>
                <CardDescription>Secure, validated URL input for product setup</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product URL</label>
                  <input
                    type="url"
                    placeholder="https://your-product.com"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll crawl your site to extract product, features, and target audience.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Multi-Step Form Layout</CardTitle>
                <CardDescription>Onboarding or setup flows with progress</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Project Setup</p>
                      <p className="text-xs text-muted-foreground">Product URL & name</p>
                    </div>
                    <Check className="ml-auto h-5 w-5 text-success" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground text-xs font-semibold">
                      2
                    </div>
                    <div>
                      <p className="font-medium">AutoBrief</p>
                      <p className="text-xs text-muted-foreground">Refine product positioning</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground text-xs font-semibold">
                      3
                    </div>
                    <div>
                      <p className="font-medium">First Growth Run</p>
                      <p className="text-xs text-muted-foreground">Discover & ship experiments</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Card Patterns */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Card Patterns</h2>

          <div className="space-y-6">
            <Card className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">Growth Run Summary Card</CardTitle>
                    <CardDescription>Status, metrics, and quick actions</CardDescription>
                  </div>
                  <Badge variant="success">Winner</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Videos</p>
                    <p className="text-2xl font-semibold">9</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Formats</p>
                    <p className="text-2xl font-semibold">3</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Winners</p>
                    <p className="text-2xl font-semibold text-primary">2</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Exploration batch · Started Jan 15</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Floating Action Card</CardTitle>
                <CardDescription>Glass morphism for modals or overlays</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Use this pattern for modals, popovers, or floating panels.</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-base">Interactive Card (Hover State)</CardTitle>
                <CardDescription>Shadow increases on hover for tactile feedback</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Hover to see the shadow elevate.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Layout Patterns */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Layout Patterns</h2>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hero Section with Gradient</CardTitle>
                <CardDescription>Landing page or section opener</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative rounded-lg overflow-hidden p-8 md:p-16 bg-gradient-to-br from-background via-background to-primary/5 border border-primary/20">
                  <div className="absolute inset-0 -z-10 gradient-mesh opacity-40" />
                  <div className="relative text-center">
                    <h3 className="text-3xl font-semibold text-balance">
                      Find the format that <span className="text-primary">brings users</span>
                    </h3>
                    <p className="mt-4 text-muted-foreground text-balance">
                      Paste your product URL and let AutoScale discover what&apos;s working.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Two-Column Grid (Responsive)</CardTitle>
                <CardDescription>Features, cards, or content pairs</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Use <code className="font-mono">grid-cols-1 md:grid-cols-2</code> for mobile-first responsive layouts:
                </p>
                <pre className="bg-secondary p-3 rounded text-xs font-mono overflow-x-auto">{`<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <Card>Left column</Card>
  <Card>Right column</Card>
</div>`}</pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Container Constraints</CardTitle>
                <CardDescription>Max-width for content readability</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Always use <code className="font-mono">container max-w-6xl</code> for app pages:
                </p>
                <pre className="bg-secondary p-3 rounded text-xs font-mono overflow-x-auto">{`<div className="container py-12 max-w-6xl">
  {/* Content auto-centers and respects responsive padding */}
</div>`}</pre>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* State Patterns */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">State & Feedback Patterns</h2>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Loading State (Skeleton)</CardTitle>
                <CardDescription>Placeholder while content is fetching</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2 animate-shimmer" />
                  <div className="h-3 bg-muted rounded w-3/4 animate-shimmer" />
                  <div className="h-3 bg-muted rounded w-2/3 animate-shimmer" />
                </div>
                <p className="text-xs text-muted-foreground">Use animate-shimmer for skeleton screens.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Empty State</CardTitle>
                <CardDescription>No data, user action needed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 py-8 text-center">
                <div className="h-12 w-12 rounded-lg bg-muted mx-auto flex items-center justify-center">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">No growth runs yet</p>
                  <p className="text-sm text-muted-foreground">Create your first project to get started.</p>
                </div>
                <Button variant="default">Create Project</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Error State</CardTitle>
                <CardDescription>Something went wrong</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive">Error fetching data</p>
                    <p className="text-sm text-muted-foreground">
                      Failed to load growth run. Please refresh or try again.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3">
                      Retry
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Success / Toast Feedback</CardTitle>
                <CardDescription>Confirmation or completion message</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 rounded-lg bg-success/5 border border-success/20">
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-success">Growth run scheduled</p>
                    <p className="text-sm text-muted-foreground">Your exploration batch will start in 2 hours.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Accessibility Patterns */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Accessibility Patterns</h2>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Focus States</CardTitle>
                <CardDescription>Keyboard navigation & screen readers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm mb-2">All interactive elements should be keyboard-accessible:</p>
                    <Button className="ring-2 ring-ring ring-offset-2 focus:outline-none">
                      Tab to focus me
                    </Button>
                  </div>
                  <pre className="bg-secondary p-3 rounded text-xs font-mono overflow-x-auto">{`/* Button focus ring classes */
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2`}</pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Color Contrast</CardTitle>
                <CardDescription>Sufficient contrast for readability (WCAG AA)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="p-3 bg-primary text-primary-foreground rounded">
                    <p className="font-semibold">White on Teal: 7.2:1 ratio (AAA)</p>
                  </div>
                  <div className="p-3 bg-background text-foreground border border-border rounded">
                    <p className="font-semibold">Dark on White: 12.6:1 ratio (AAA)</p>
                  </div>
                  <div className="p-3 bg-secondary text-muted-foreground rounded">
                    <p className="font-semibold">Secondary text: 5.8:1 ratio (AA)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Semantic HTML & ARIA</CardTitle>
                <CardDescription>Proper structure for screen readers</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-secondary p-3 rounded text-xs font-mono overflow-x-auto">{`/* Use semantic elements */
<button> instead of <div onclick="">
<h1>, <h2>, <h3> for headings (don't skip levels)
<label htmlFor="input"> with form inputs
<nav>, <main>, <section>, <article>

/* Add ARIA when needed */
<div role="status" aria-live="polite">
  Loading your growth run...
</div>

/* Descriptive button text */
<button>Create Project</button>
{/* NOT: <button>Click Here</button> */}`}</pre>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Dark Mode Patterns */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Dark Mode Patterns</h2>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Automatic Dark Mode Support</CardTitle>
              <CardDescription>Tailwind handles dark variant classes automatically</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                Colors defined in <code className="font-mono">globals.css</code> automatically adapt:
              </p>
              <pre className="bg-secondary p-3 rounded text-xs font-mono overflow-x-auto">{`/* Light mode (default) */
:root {
  --primary: 158 84% 39%;  /* Teal */
}

/* Dark mode (applied by <html class="dark">) */
.dark {
  --primary: 158 84% 45%;  /* Brighter teal */
}

/* Components automatically use the right token */
<div className="bg-primary text-primary-foreground">
  Works in both light and dark modes
</div>`}</pre>
              <p className="text-sm">
                <strong>No need to write</strong> <code className="font-mono">dark:bg-primary</code> — colors are already smart.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <div className="border-t border-border pt-12">
          <p className="text-sm text-muted-foreground text-center">
            These patterns enforce the evidence chain and protect against disconnected content. Always link claims to sources.
          </p>
        </div>
      </main>
    </div>
  );
}
