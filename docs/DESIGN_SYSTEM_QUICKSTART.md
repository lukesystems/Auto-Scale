# Design System Quick Start Guide

This guide helps developers quickly reference and use the AutoScale Shorts design system.

## Navigation

- **[Design System Home](/design-system)** — Visual component reference & examples
- **[Tokens](/design-system/tokens)** — Color, spacing, typography, shadows, animations
- **[Patterns](/design-system/patterns)** — Common UI patterns & best practices

## Core Concepts

### Token-First Design

Every visual decision uses CSS custom properties (`--primary`, `--border`, etc.). This ensures:
- **Single source of truth** in `globals.css` and `tailwind.config.ts`
- **Dark mode automatic** — no need to write `dark:` variants for most colors
- **Easy maintenance** — change a token once, updates everywhere

### Evidence Chain Protection

Every piece of UI must support the core loop:
```
Source → Insight → Content → Distribution → Experiment → Winner
```

**Never:**
- Show disconnected content without a source link
- State competitor intelligence as fact without evidence
- Mark insights as high-confidence without supporting data

**Always:**
- Link insights back to source (creator, platform, date)
- Mark low-confidence insights explicitly (< 3 sources or low engagement)
- Show source metadata below claims

---

## Quick Reference: Colors

### Primary (Teal)
```tsx
<button className="bg-primary text-primary-foreground">
  Start Growth Run
</button>
```

### Status Colors
```tsx
<Badge variant="success">Winner ✓</Badge>           {/* Green */}
<Badge variant="warning">Low Confidence</Badge>    {/* Amber */}
<Badge variant="destructive">Failed</Badge>        {/* Red */}
<Badge variant="outline">Inactive</Badge>          {/* Gray outline */}
```

### Text Hierarchy
```tsx
<h1 className="text-5xl font-semibold">Hero Title</h1>
<h2 className="text-3xl font-semibold">Section Title</h2>
<h3 className="text-lg font-semibold">Card Title</h3>
<p className="text-base">Body text</p>
<p className="text-sm text-muted-foreground">Secondary text</p>
<p className="text-xs text-muted-foreground uppercase tracking-wider">Meta label</p>
```

---

## Quick Reference: Components

### Buttons

```tsx
import { Button } from "@/components/ui/button";

<Button>Primary Action</Button>                    {/* Teal bg */}
<Button variant="outline">Secondary</Button>       {/* Bordered */}
<Button variant="destructive">Delete</Button>      {/* Red */}
<Button variant="ghost">Minimal</Button>           {/* No bg */}
<Button variant="link">Text Link</Button>          {/* Underlined */}
<Button variant="glow" size="lg">Hero CTA</Button> {/* Glowing */}

{/* Sizes */}
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Plus /></Button>
```

### Cards

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Subtitle or description</CardDescription>
  </CardHeader>
  <CardContent>Main content here</CardContent>
  <CardFooter>Actions or footer</CardFooter>
</Card>

{/* Variants */}
<Card className="border-l-4 border-l-primary">            {/* Accent left border */}
<Card className="glass border border-border/60">        {/* Blur glass effect */}
<Card className="hover:shadow-md transition-shadow">    {/* Elevated on hover */}
```

### Badges

```tsx
import { Badge } from "@/components/ui/badge";

<Badge>Default</Badge>
<Badge variant="success"><Check className="h-3 w-3" />Winner</Badge>
<Badge variant="warning"><AlertCircle className="h-3 w-3" />Caution</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Neutral</Badge>
<Badge variant="secondary">Alternative</Badge>
```

### Forms

```tsx
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

<div className="space-y-2">
  <Label htmlFor="url">Product URL</Label>
  <Input id="url" type="url" placeholder="https://..." />
</div>

<div className="space-y-2">
  <Label htmlFor="desc">Description</Label>
  <Textarea id="desc" placeholder="Tell us..." rows={4} />
</div>

<div className="space-y-2">
  <Label htmlFor="model">AI Model</Label>
  <Select>
    <SelectTrigger id="model">
      <SelectValue placeholder="Choose..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="gpt4">GPT-4o</SelectItem>
      <SelectItem value="claude">Claude 3 Opus</SelectItem>
    </SelectContent>
  </Select>
</div>
```

---

## Quick Reference: Spacing & Layout

### Padding & Gaps

```tsx
{/* Padding */}
<div className="p-2">4px padding</div>
<div className="p-4">16px padding</div>
<div className="p-6">24px padding</div>

{/* Gaps (flex/grid) */}
<div className="flex gap-2">Tight spacing</div>
<div className="flex gap-4">Standard spacing</div>
<div className="flex gap-6">Loose spacing</div>
```

### Responsive Grid

```tsx
{/* Mobile: 1 column, tablet+: 2 columns, desktop+: 3 columns */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</div>
```

### Container

```tsx
{/* Centered, max-width, responsive padding */}
<div className="container py-12 max-w-6xl">
  <h1>Page Content</h1>
</div>
```

---

## Quick Reference: Animations

```tsx
{/* Fade in (0.4s) */}
<div className="animate-fade-in">Content</div>

{/* Fade up (0.6s) */}
<div className="animate-fade-up">Content</div>

{/* Slide in (0.35s) */}
<div className="animate-slide-in">Content</div>

{/* Scale in (0.3s) */}
<div className="animate-scale-in">Content</div>

{/* Loading shimmer (3s loop) */}
<div className="animate-shimmer">Loading...</div>

{/* Soft pulse (2s loop, opacity) */}
<div className="animate-pulse-soft">Status indicator</div>

{/* Gradient text animation (8s loop) */}
<h1 className="text-gradient animate-gradient-shift">
  Animated heading
</h1>
```

---

## Quick Reference: Background Patterns

```tsx
{/* Grid pattern */}
<div className="bg-grid">Content</div>

{/* Dot pattern */}
<div className="bg-dot">Content</div>

{/* Gradient mesh (hero sections) */}
<div className="gradient-mesh">Content</div>

{/* Glass morphism (modals, overlays) */}
<div className="glass">Content</div>

{/* Noise texture */}
<div className="bg-noise">Content</div>

{/* Text gradient */}
<h1 className="text-gradient">Colored text</h1>

{/* Border gradient (card accent) */}
<div className="border-gradient">Content</div>
```

---

## Common Patterns

### Hero Section
```tsx
<section className="relative pt-40 pb-20 overflow-hidden">
  <div className="absolute inset-0 -z-10 gradient-mesh" />
  <div className="container text-center">
    <Badge variant="outline" className="mb-4">AI-powered</Badge>
    <h1 className="mt-6 text-5xl font-semibold text-gradient">
      Find the format that brings users.
    </h1>
    <p className="mt-6 text-muted-foreground">Description</p>
    <Button variant="glow" size="lg" className="mt-10">
      Get Started
    </Button>
  </div>
</section>
```

### Status Card
```tsx
<Card className="border-l-4 border-l-primary">
  <CardHeader>
    <div className="flex justify-between items-start">
      <div>
        <CardTitle>Growth Run #3</CardTitle>
        <CardDescription>Exploration batch</CardDescription>
      </div>
      <Badge variant="success">Winner</Badge>
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-semibold text-primary">+42% CTR</div>
  </CardContent>
</Card>
```

### Empty State
```tsx
<div className="text-center py-12">
  <div className="h-12 w-12 rounded-lg bg-muted mx-auto flex items-center justify-center mb-4">
    <Zap className="h-6 w-6 text-muted-foreground" />
  </div>
  <p className="font-semibold">No growth runs yet</p>
  <p className="text-sm text-muted-foreground mt-1">Create your first project to get started.</p>
  <Button className="mt-4">Create Project</Button>
</div>
```

### Loading Skeleton
```tsx
<div className="space-y-2">
  <div className="h-4 bg-muted rounded w-1/2 animate-shimmer" />
  <div className="h-3 bg-muted rounded w-3/4 animate-shimmer" />
  <div className="h-3 bg-muted rounded w-2/3 animate-shimmer" />
</div>
```

### Error Message
```tsx
<div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 flex gap-3">
  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
  <div>
    <p className="font-semibold text-destructive">Error loading data</p>
    <p className="text-sm text-muted-foreground">Please refresh and try again.</p>
  </div>
</div>
```

---

## Development Tips

### 1. Use the Design System Pages
- Visit `/design-system` for visual reference
- Check `/design-system/tokens` for exact values
- Review `/design-system/patterns` for common layouts

### 2. Dark Mode Just Works
Colors automatically switch in dark mode. No `dark:` prefix needed for most cases:
```tsx
{/* This works in both light and dark modes automatically */}
<div className="bg-primary text-primary-foreground">
  Smart color
</div>
```

### 3. Follow Mobile-First Responsive
Always start with mobile styles, then add breakpoints:
```tsx
{/* NOT: <div className="md:w-full w-1/2"> (mobile-last) */}
<div className="w-full md:w-1/2">  {/* Mobile-first */}
```

### 4. Protect the Evidence Chain
Never show:
- Insights without source links
- Competitor data without evidence
- Confidence claims unsupported by data

Always show:
- Source creator, platform, date
- Low-confidence warnings
- Trust indicators (badge, warning icon)

### 5. Semantic HTML First
```tsx
{/* ✅ Good */}
<button onClick={handleClick}>Create Run</button>
<h1>Page Title</h1>
<nav><Link href="/">Home</Link></nav>

{/* ❌ Avoid */}
<div onClick={handleClick} role="button">Create Run</div>
<div className="text-xl font-bold">Page Title</div>
<div><a href="/">Home</a></div>
```

### 6. Test in Dark Mode
Always verify components in dark mode:
1. Use the theme toggle in settings
2. Check color contrast
3. Verify text is readable
4. Test with system dark mode preference

---

## Color Token Values

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `158 84% 39%` | `158 84% 45%` | Teal, primary action |
| `--success` | `142 71% 45%` | `142 71% 45%` | Green, winner |
| `--warning` | `38 92% 50%` | `38 92% 50%` | Amber, caution |
| `--destructive` | `0 84% 60%` | `0 72% 51%` | Red, error |
| `--foreground` | `222 47% 6%` | `210 40% 98%` | Text |
| `--background` | `0 0% 100%` | `222 47% 4%` | BG |
| `--border` | `220 13% 91%` | `217 33% 14%` | Dividers |
| `--muted-foreground` | `220 9% 46%` | `215 20% 65%` | Secondary text |

---

## Further Reading

- **Full Documentation**: [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md)
- **Component Library**: [components/ui/](../../components/ui/)
- **Global Styles**: [app/globals.css](../../app/globals.css)
- **Config**: [tailwind.config.ts](../../tailwind.config.ts)

---

**Last Updated**: January 16, 2025
