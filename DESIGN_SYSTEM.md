---
title: AutoScale Shorts Design System
version: "1.0"
lastUpdated: "2025-01-16"
status: "Current"
---

# AutoScale Shorts Design System

## Overview

AutoScale Shorts design language is built on **clarity, precision, and motion**. The system enables rapid iteration and controlled experiments by establishing a single source of truth for color, typography, spacing, components, and patterns.

The design system is **token-first**, validated through Zod schemas, and enforced at the Tailwind layer.

---

## Core Design Principles

### 1. **Evidence Chain Clarity**
Every visual element must support the evidence chain:
```
Product URL → Product Brief → Scraping Engine → TrendWatch Intelligence 
→ Content Experiments → Distribution → Experiment Results → Winner Variants
```

### 2. **Precision Over Decoration**
- No floating UI cruft.
- Every shadow, color, and animation has a purpose.
- Motion signals state change, not just eye candy.

### 3. **Founder Velocity**
- Rapid scanning of growth runs and winner insights.
- Status-at-a-glance with badges and indicators.
- Mobile-first, accessible, and keyboard-navigable.

### 4. **Trust Through Transparency**
- Source data is always traceable.
- AI reasoning and confidence scores are visible.
- Low-confidence warnings are explicit, not hidden.

---

## Color Tokens

### Primary Palette

#### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `0 0% 100%` | Page bg, white |
| `--foreground` | `222 47% 6%` | Body text, dark |
| `--card` | `0 0% 100%` | Card bg, same as background |
| `--card-foreground` | `222 47% 6%` | Card text |
| `--primary` | `158 84% 39%` | Teal (action, links, success) |
| `--primary-foreground` | `0 0% 100%` | Text on primary (white) |
| `--accent` | `158 84% 95%` | Very light teal highlight |
| `--accent-foreground` | `158 84% 25%` | Dark teal on accent |

#### Dark Mode
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `222 47% 4%` | Page bg, near-black |
| `--foreground` | `210 40% 98%` | Body text, nearly white |
| `--card` | `222 47% 6%` | Card bg, dark slate |
| `--card-foreground` | `210 40% 98%` | Card text, light |
| `--primary` | `158 84% 45%` | Brighter teal in dark mode |
| `--primary-foreground` | `222 47% 4%` | Text on primary (dark) |
| `--accent` | `158 84% 14%` | Very dark teal |
| `--accent-foreground` | `158 84% 80%` | Light teal on dark accent |

### Supporting Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--secondary` | `220 14% 96%` | `217 33% 12%` | Secondary surfaces, muted areas |
| `--secondary-foreground` | `222 47% 11%` | `210 40% 98%` | Text on secondary |
| `--muted` | `220 14% 96%` | `217 33% 11%` | Disabled, skeleton states |
| `--muted-foreground` | `220 9% 46%` | `215 20% 65%` | Secondary text, hints |
| `--destructive` | `0 84% 60%` | `0 72% 51%` | Red for errors, deletion |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 100%` | Text on destructive (white) |
| `--success` | `142 71% 45%` | `142 71% 45%` | Green for winners, positive signals |
| `--success-foreground` | `0 0% 100%` | `0 0% 100%` | Text on success (white) |
| `--warning` | `38 92% 50%` | `38 92% 50%` | Yellow/amber for cautions |
| `--warning-foreground` | `0 0% 100%` | `0 0% 0%` | Text on warning |
| `--border` | `220 13% 91%` | `217 33% 14%` | Subtle borders, dividers |
| `--input` | `220 13% 91%` | `217 33% 14%` | Input fields bg |
| `--ring` | `158 84% 39%` | `158 84% 45%` | Focus ring color (primary) |

### Semantic Color Usage

#### Status Indicators
- **Success**: `--success` (green) — winner, positive experiment result
- **Warning**: `--warning` (amber) — low confidence, requires review
- **Destructive**: `--destructive` (red) — error, delete, irreversible action
- **Muted**: `--muted-foreground` — inactive, disabled, historical

#### Surfaces
- **Primary Action**: `--primary` button (teal)
- **Secondary**: `--secondary` for less prominent surfaces
- **Ghost**: Transparent with hover state
- **Outline**: Bordered, minimal fill

---

## Typography

### Font Families

```css
--font-sans: "Inter", system-ui, sans-serif;        /* body, UI */
--font-display: "Inter", system-ui, sans-serif;     /* headings */
--font-mono: "JetBrains Mono", ui-monospace, monospace;  /* code, tokens */
```

### Type Scale (Tailwind defaults + custom)

| Class | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-xs` | 12px | — | 1.5 | Labels, badges, meta |
| `text-sm` | 14px | — | 1.5 | Secondary text, hints |
| `text-base` | 16px | — | 1.5 | Body text default |
| `text-lg` | 18px | 600 | 1.75 | Card titles, section headers |
| `text-xl` | 20px | — | 1.75 | Minor headings |
| `text-2xl` | 24px | 600 | 1.75 | Section headings |
| `text-3xl` | 30px | 600 | 1.75 | Page titles |
| `text-5xl` | 48px | 600 | 1 | Hero headings (landing) |
| `text-7xl` | 56px | 600 | 1 | Large hero (landing) |

### Font Features

```css
font-feature-settings: "cv02", "cv03", "cv04", "cv11";
```

Enables stylistic variants for more refined Inter rendering.

### Type Examples

**Heading 1** (`text-5xl font-semibold`)
```
Find the video format that brings users.
```

**Heading 3** (`text-lg font-semibold`)
```
Product Brief
```

**Body** (`text-base text-muted-foreground`)
```
Paste your product URL. AutoScale Shorts discovers what's working in your niche.
```

**Meta** (`text-xs uppercase tracking-wider text-muted-foreground`)
```
VIDEOS SHIPPED
```

---

## Spacing & Layout

### Spacing Scale (Tailwind default)

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` | 4px | Tight spacing (icon + text) |
| `gap-2` | 8px | Component padding, small gaps |
| `gap-3` | 12px | Medium gaps, section padding |
| `gap-4` | 16px | Standard padding |
| `gap-6` | 24px | Large padding, section spacing |
| `gap-8` | 32px | XL spacing, major sections |
| `gap-10` | 40px | XXL spacing, page sections |

### Container & Breakpoints

```tsx
container: {
  center: true,
  padding: "1.5rem",
  screens: { "2xl": "1400px" },
}
```

| Breakpoint | Width |
|------------|-------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1400px |

---

## Border & Radius

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.75rem` (12px) | Default (cards, buttons, inputs) |
| `rounded-sm` | `calc(var(--radius) - 8px)` = 4px | Compact components |
| `rounded-md` | `calc(var(--radius) - 4px)` = 8px | Medium (some inputs, small cards) |
| `rounded-lg` | `var(--radius)` = 12px | Default (buttons, cards, dialogs) |
| `rounded-xl` | 16px (Tailwind default) | Larger cards, hero sections |
| `rounded-2xl` | 20px | Large UI sections, glass panels |
| `rounded-full` | 9999px | Badges, pill buttons |

### Border Style

```css
.border-border: hsl(var(--border)) /* Subtle dividers, card borders */
.border-primary/30: Primary color at 30% opacity (subtle accent lines)
```

---

## Shadow System

### Depth Levels

| Name | CSS | Usage |
|------|-----|-------|
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Light elevation |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1)` | Card hover |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1)` | Modals, popovers |
| `shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1)` | Maximum elevation |
| `shadow-2xl` | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | Hero backdrops |

### Custom Shadows (AutoScale)

```css
/* Button primary — vibrant glow */
shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_-2px_hsl(var(--primary)/0.4)]

/* Button primary hover */
shadow-[0_2px_4px_rgba(0,0,0,0.06),0_8px_20px_-4px_hsl(var(--primary)/0.5)]

/* Glow button */
shadow-[0_0_20px_hsl(var(--primary)/0.4)]

/* Glow button hover */
shadow-[0_0_30px_hsl(var(--primary)/0.6)]

/* Card container */
shadow-2xl shadow-primary/5
```

---

## Components

### Buttons

#### Variants

**Default (Primary)**
- Background: `--primary` (teal)
- Text: `--primary-foreground` (white)
- State: Hover increases brightness + amplifies shadow
- Active: 98% scale (tactile feedback)

```tsx
<Button variant="default">Start Growth Run</Button>
```

**Destructive**
- Background: `--destructive` (red)
- Text: white
- Use: Delete, reset, irreversible actions

```tsx
<Button variant="destructive">Delete Project</Button>
```

**Outline**
- Border: `--border`
- Background: Transparent, hover to secondary
- Use: Secondary actions, less prominent CTAs

```tsx
<Button variant="outline">Learn More</Button>
```

**Secondary**
- Background: `--secondary`
- Text: `--secondary-foreground`
- Use: Tertiary actions, less emphasis

```tsx
<Button variant="secondary">Cancel</Button>
```

**Ghost**
- Background: Transparent
- Hover: `--secondary` bg
- Use: Icon buttons, minimal actions

```tsx
<Button variant="ghost" size="icon"><X /></Button>
```

**Link**
- Text: `--primary` (teal)
- Underline: offset 4px
- Use: Inline navigation, text links

```tsx
<Button variant="link" asChild><Link href="/help">Help</Link></Button>
```

**Glow** (Special)
- Background: Gradient teal
- Shadow: Primary glow
- Use: Hero CTAs, emphasis

```tsx
<Button variant="glow">Create Project</Button>
```

#### Sizes

| Size | Height | Padding | Font | Usage |
|------|--------|---------|------|-------|
| `sm` | 36px | px-3 | xs | Compact UI, tables |
| `default` | 40px | px-4 | sm | Standard buttons |
| `lg` | 48px | px-6 | base | Dialog actions, hero |
| `xl` | 56px | px-8 | base | Page-level CTAs |
| `icon` | 40px | square | — | Icon-only buttons |

#### Examples

```tsx
import { Button } from "@/components/ui/button";

<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="destructive">Delete</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Sparkles /></Button>
<Button variant="glow" size="lg">Hero CTA</Button>
```

---

### Cards

#### Structure

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Brief Summary</CardTitle>
    <CardDescription>Your product in 200 words</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

#### Styling

- **Border**: 1px `--border` (subtle)
- **Background**: `--card` (white in light, dark slate in dark)
- **Border Radius**: `rounded-xl` (16px)
- **Padding**: `p-6` (24px)
- **Shadow**: `shadow-sm` (gentle elevation)
- **Transition**: Smooth on shadow (hover effects)

#### Variants (via className override)

**Elevated / Hover**
```tsx
<Card className="hover:shadow-md transition-shadow">
```

**Glass / Backdrop Blur**
```tsx
<Card className="glass border border-border/60">
```

**Accent Border**
```tsx
<Card className="border-l-4 border-l-primary">
```

---

### Badges

#### Variants

| Variant | Background | Text | Border | Usage |
|---------|------------|------|--------|-------|
| `default` | primary/10 (light teal) | primary (teal) | transparent | Tags, status (default) |
| `secondary` | secondary | secondary-foreground | transparent | Alternative tags |
| `outline` | transparent | foreground | border (light gray) | Neutral, unselected |
| `destructive` | destructive/10 (light red) | destructive (red) | transparent | Error, removal |
| `success` | success/10 (light green) | success (green) | transparent | Winner, positive |
| `warning` | warning/10 (light amber) | warning (amber) | transparent | Caution, low confidence |
| `dot` | background | foreground | border | Minimal, inline |

#### Examples

```tsx
import { Badge } from "@/components/ui/badge";

<Badge>Growth Run</Badge>
<Badge variant="success">Winner ✓</Badge>
<Badge variant="warning">Low Confidence</Badge>
<Badge variant="destructive">Failed</Badge>
<Badge variant="outline">Inactive</Badge>

// With icon
<Badge variant="success">
  <Check className="h-3 w-3" />
  Winner
</Badge>
```

#### Size

- Height: 24px
- Padding: `px-2.5 py-0.5`
- Font: xs, font-medium
- Border Radius: `rounded-full`

---

### Inputs & Selects

#### Input

- **Height**: 40px
- **Padding**: `px-3 py-2`
- **Border**: 1px `--border`
- **Border Radius**: `rounded-md`
- **Focus**: `ring-2 ring-primary ring-offset-2`
- **Background**: `--input` (light gray in light, dark in dark)
- **Disabled**: `opacity-50 cursor-not-allowed`

```tsx
import { Input } from "@/components/ui/input";

<Input type="text" placeholder="Project name..." />
<Input type="url" placeholder="https://your-product.com" />
```

#### Textarea

- Same as Input but multiline
- Min height: 100px
- Resize: vertical

```tsx
import { Textarea } from "@/components/ui/textarea";

<Textarea placeholder="Product description..." rows={5} />
```

#### Select

- Radix UI powered
- Styling matches Input
- Animated dropdown

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Choose model..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="gpt4">GPT-4o</SelectItem>
    <SelectItem value="claude3">Claude 3</SelectItem>
  </SelectContent>
</Select>
```

---

## Motion & Animation

### Keyframes

| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
| `fade-in` | 0.4s | ease-out | Fade in from invisible |
| `fade-up` | 0.6s | ease-out | Fade in + slide up (20px) |
| `slide-in` | 0.35s | ease-out | Slide in from below (12px) |
| `scale-in` | 0.3s | ease-out | Scale up from 0.96 |
| `shimmer` | 3s | linear | Loading skeleton pulse |
| `pulse-soft` | 2s | ease-in-out | Gentle pulse (opacity) |
| `gradient-shift` | 8s | ease | Animated gradient bg shift |
| `accordion-down` | 0.2s | ease-out | Accordion expand |
| `accordion-up` | 0.2s | ease-out | Accordion collapse |

### Usage Examples

```tsx
// Page entry
<div className="animate-fade-up">
  <h1>Growth Run Dashboard</h1>
</div>

// Status indicator
<div className="h-3 w-3 rounded-full bg-primary animate-pulse-soft" />

// Skeleton loading
<div className="animate-shimmer" />

// Hero gradient text
<span className="text-gradient animate-gradient-shift">
  Compound the winners.
</span>
```

---

## Background Patterns

### Grid

```css
.bg-grid {
  background-image:
    linear-gradient(to right, hsl(var(--border) / 0.4) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border) / 0.4) 1px, transparent 1px);
  background-size: 64px 64px;
}
```

Use: Hero sections, landing pages

### Dot

```css
.bg-dot {
  background-image: radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

Use: Subtle backgrounds, feature sections

### Noise

```css
.bg-noise {
  background-image: url("data:image/svg+xml,%3Csvg ... %3C/svg%3E");
}
```

Use: Adds film-grain texture to backgrounds

### Gradient Mesh

```css
.gradient-mesh {
  background:
    radial-gradient(at 20% 10%, hsl(var(--primary) / 0.15) 0px, transparent 50%),
    radial-gradient(at 80% 0%, hsl(280 80% 60% / 0.12) 0px, transparent 50%),
    radial-gradient(at 0% 90%, hsl(200 80% 60% / 0.10) 0px, transparent 50%),
    radial-gradient(at 80% 80%, hsl(var(--primary) / 0.08) 0px, transparent 50%);
}
```

Use: Hero hero sections, page backdrops

---

## Glass Morphism

```css
.glass {
  @apply bg-background/60 backdrop-blur-xl backdrop-saturate-150;
}
```

Use: Overlays, floating panels, modal backdrops

---

## Gradient Text

```css
.text-gradient {
  background: linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 50%, hsl(var(--foreground)) 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

Use: Emphasis on headings, hero text

---

## Accessibility

### Focus States

```css
focus-visible:outline-none 
focus-visible:ring-2 
focus-visible:ring-ring 
focus-visible:ring-offset-2
```

- Keyboard navigation always visible
- Ring offset ensures visibility on dark backgrounds

### Color Contrast

- Text on primary: White (AAA contrast)
- Text on secondary: Dark foreground (AAA contrast)
- Text on muted: Sufficient contrast for secondary text
- All badges meet WCAG AA minimum

### Motion

- Animations respect `prefers-reduced-motion`
- Focus indicators never depend on color alone
- Spinner animations are not seizure-inducing

---

## Dark Mode

### Implementation

```html
<html class="dark">
```

Tailwind's built-in dark mode automatically applies `.dark` variant styles:

```tsx
<div className="bg-background dark:bg-[#0a0f0d]">
```

### Color Adjustments

- Primary hue is **brighter** in dark mode (+6% lightness)
- Backgrounds are **darker** (near-black)
- Borders have **more contrast** (higher saturation)
- All contrast ratios maintained

---

## Component Checklist

### Buttons ✓
- [ ] Default (primary)
- [ ] Outline
- [ ] Destructive
- [ ] Secondary
- [ ] Ghost
- [ ] Link
- [ ] Glow
- [ ] All sizes (sm, default, lg, xl, icon)
- [ ] Loading states
- [ ] Disabled states
- [ ] Keyboard navigation

### Cards ✓
- [ ] Card container
- [ ] CardHeader / CardTitle / CardDescription
- [ ] CardContent
- [ ] CardFooter
- [ ] Hover effects
- [ ] Glass variant

### Badges ✓
- [ ] All variants (default, success, destructive, warning, outline, dot)
- [ ] Icon support
- [ ] Responsive sizing

### Inputs ✓
- [ ] Text input
- [ ] Email, URL, number types
- [ ] Focus states
- [ ] Placeholder text
- [ ] Disabled state

### Dialogs
- [ ] Modal structure
- [ ] Close button
- [ ] Overlay
- [ ] Focus management

### Other
- [ ] Tooltips (Radix)
- [ ] Dropdowns (Radix)
- [ ] Tabs (Radix)
- [ ] Select (Radix)
- [ ] Toast notifications
- [ ] Skeleton loaders

---

## Responsive Design

### Breakpoint Strategy

**Mobile-First**
```tsx
<div className="text-base md:text-lg lg:text-xl">
  Responsive text
</div>
```

**Grid Layouts**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards */}
</div>
```

**Navigation**
```tsx
<nav className="hidden md:flex gap-6">
  {/* Desktop nav */}
</nav>
```

### Touch Targets

- Minimum 44px × 44px for all interactive elements
- Padding of `gap-2` to `gap-3` between adjacent targets

---

## Token Abstraction

All tokens are CSS custom properties:

```css
:root {
  --primary: 158 84% 39%;
  --border: 220 13% 91%;
  /* ... */
}
```

Usage in React:
```tsx
// Automatic via Tailwind config
<button className="bg-primary text-primary-foreground">

// Or direct CSS var
<div style={{ backgroundColor: `hsl(var(--primary))` }}>
```

---

## Usage Examples

### Hero Section
```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

<section className="relative pt-40 pb-20 overflow-hidden">
  <div className="absolute inset-0 -z-10 gradient-mesh" />
  <div className="container text-center">
    <Badge variant="outline">
      AI short-form growth agent
    </Badge>
    <h1 className="mt-6 text-5xl font-semibold text-gradient">
      Find the video format that brings users.
    </h1>
    <Button variant="glow" size="lg" className="mt-10">
      Get Started
    </Button>
  </div>
</section>
```

### Status Card
```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

<Card className="border-l-4 border-l-primary">
  <CardContent className="pt-6">
    <div className="flex items-start justify-between">
      <div>
        <h4 className="font-semibold">Growth Run #3</h4>
        <p className="text-sm text-muted-foreground">Exploitation batch</p>
      </div>
      <Badge variant="success">Winner ✓</Badge>
    </div>
  </CardContent>
</Card>
```

### Form Layout
```tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

<div className="space-y-4">
  <div>
    <Label htmlFor="url">Product URL</Label>
    <Input id="url" type="url" placeholder="https://..." />
  </div>
  <Button>Continue</Button>
</div>
```

---

## Migration Checklist

When updating or deprecating components:

1. Update token definitions in `globals.css`
2. Update Tailwind config `tailwind.config.ts`
3. Run `npm run typecheck` for Tailwind IntelliSense
4. Test in light and dark modes
5. Verify all component variants
6. Check responsive breakpoints
7. Validate keyboard navigation and focus states
8. Update this document

---

## Resources

- **Tailwind CSS**: https://tailwindcss.com
- **Radix UI**: https://radix-ui.com
- **CVA (Class Variance Authority)**: https://cva.style
- **Lucide Icons**: https://lucide.dev
- **Next.js**: https://nextjs.org

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-16 | Initial design system documentation |

---

**Last Updated**: January 16, 2025
**Maintainers**: AutoScale Shorts Design & Engineering
