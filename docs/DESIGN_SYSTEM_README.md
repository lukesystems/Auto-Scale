# AutoScale Shorts Design System

Complete design system documentation, visual reference, and component library for AutoScale Shorts.

## 📍 Quick Links

| Resource | Path | Purpose |
|----------|------|---------|
| **Design System Home** | `/design-system` | Visual component reference & gallery |
| **Tokens Reference** | `/design-system/tokens` | Colors, spacing, typography, animations |
| **Patterns & Best Practices** | `/design-system/patterns` | Common UI patterns & evidence chain protection |
| **Component Library** | `/design-system/components` | Copy-paste ready component examples |
| **Full Documentation** | `DESIGN_SYSTEM.md` | Complete system specification |
| **Developer Quick Start** | `docs/DESIGN_SYSTEM_QUICKSTART.md` | Fast reference for common tasks |

---

## 🎨 Design Language

### Core Palette
- **Primary (Teal)**: `158 84% 39%` (light), `158 84% 45%` (dark) — Actions, links, success
- **Success (Green)**: `142 71% 45%` — Winners, positive signals
- **Warning (Amber)**: `38 92% 50%` — Cautions, low confidence
- **Destructive (Red)**: `0 84% 60%` (light), `0 72% 51%` (dark) — Errors, deletion
- **Text**: Dark foreground on light, light on dark
- **Surfaces**: White (light), near-black (dark)

### Typography
- **Heading Font**: Inter (bold, tracking-tight)
- **Body Font**: Inter (readable, 16px base)
- **Mono Font**: JetBrains Mono (code, tokens)

### Key Features
- **Dark Mode**: Automatic via CSS custom properties
- **Motion**: Fade-in, fade-up, scale-in, shimmer, pulse animations
- **Patterns**: Grid, dots, gradient mesh, glass morphism
- **Focus**: Keyboard-accessible with visible ring indicators
- **Contrast**: WCAG AAA compliant

---

## 🔗 Evidence Chain Protection

The design system enforces AutoScale's core rule:

> **Protect the evidence chain:** Every claim must be traceable to a source.

### Never:
- ❌ Show disconnected content without a source link
- ❌ State competitor intelligence as fact without evidence
- ❌ Mark insights as high-confidence without supporting data

### Always:
- ✅ Link insights to sources (creator, platform, date)
- ✅ Mark low-confidence insights explicitly (< 3 sources)
- ✅ Show source metadata below claims
- ✅ Use badges to indicate confidence levels

---

## 🚀 Common Workflows

### Starting a New Component

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default">Action</Button>
        <Badge variant="success">Status</Badge>
      </CardContent>
    </Card>
  );
}
```

### Using Responsive Layouts

```tsx
{/* Mobile first, then expand */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</div>
```

### Showing Status Indicators

```tsx
// Winners
<Badge variant="success"><Check className="h-3 w-3" />Winner</Badge>

// Low confidence
<Badge variant="warning"><AlertCircle className="h-3 w-3" />Low Confidence</Badge>

// Errors
<Badge variant="destructive">Failed</Badge>

// Neutral
<Badge variant="outline">Inactive</Badge>
```

### Evidence Chain Example

```tsx
<Card className="border-l-4 border-l-primary">
  <CardHeader>
    <CardTitle>Trend Insight</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Founders are tweeting about feature shipping speed</p>
    
    {/* Always show the source */}
    <div className="text-xs text-muted-foreground mt-3">
      ↳ Source: <span className="font-mono text-primary">@paulg</span> (Twitter, Nov 2024)
      <Badge variant="outline" className="ml-2">High Confidence</Badge>
    </div>
  </CardContent>
</Card>
```

---

## 🎯 Component Checklist

### Buttons ✓
- [x] Default (primary teal)
- [x] Outline (bordered)
- [x] Destructive (red)
- [x] Secondary (gray)
- [x] Ghost (transparent)
- [x] Link (text with underline)
- [x] Glow (hero CTA)
- [x] All sizes (sm, default, lg, xl, icon)

### Badges ✓
- [x] Default (teal highlight)
- [x] Success (green)
- [x] Warning (amber)
- [x] Destructive (red)
- [x] Outline (gray border)
- [x] Secondary (gray)
- [x] Dot (minimal)

### Cards ✓
- [x] Card container
- [x] CardHeader / CardTitle / CardDescription
- [x] CardContent / CardFooter
- [x] Accent left border variant
- [x] Glass morphism variant
- [x] Hover elevation variant

### Forms ✓
- [x] Input (text, email, url, etc.)
- [x] Textarea (multiline)
- [x] Select (dropdown)
- [x] Label
- [x] Focus states
- [x] Disabled states

### Layouts ✓
- [x] Hero sections (with gradient mesh)
- [x] Container grid
- [x] Responsive two-column
- [x] Flex rows
- [x] Sticky headers

### States ✓
- [x] Loading (shimmer skeleton)
- [x] Empty state (with icon + CTA)
- [x] Error (red border + icon)
- [x] Success (green highlight)
- [x] Disabled

### Patterns ✓
- [x] Background grid
- [x] Dot pattern
- [x] Gradient mesh
- [x] Glass morphism
- [x] Text gradient
- [x] Border gradient

### Animations ✓
- [x] Fade-in (0.4s)
- [x] Fade-up (0.6s)
- [x] Slide-in (0.35s)
- [x] Scale-in (0.3s)
- [x] Shimmer (3s)
- [x] Pulse-soft (2s)
- [x] Gradient-shift (8s)

---

## 📱 Responsive Breakpoints

```
Mobile (< 640px)  →  sm: 640px  →  md: 768px  →  lg: 1024px  →  xl: 1280px  →  2xl: 1400px (container max)
```

**Mobile-first pattern:**
```tsx
{/* Default on mobile, then override at breakpoints */}
<div className="w-full md:w-1/2 lg:w-1/3">
  Responsive width
</div>
```

---

## 🌙 Dark Mode

Dark mode **automatically works** — no `dark:` prefix needed for most cases. CSS custom properties in `:root` and `.dark` selector handle it.

### How it works:
```css
:root {
  --primary: 158 84% 39%;  /* Light: Teal */
}
.dark {
  --primary: 158 84% 45%;  /* Dark: Brighter teal */
}
```

### In React:
```tsx
{/* Automatically uses correct color in both modes */}
<div className="bg-primary text-primary-foreground">
  Smart colors
</div>
```

---

## 🛡️ Accessibility

### Keyboard Navigation
- All interactive elements are keyboard-accessible
- Focus indicators always visible (ring with offset)
- Tab order follows visual flow

### Color Contrast
- All text meets WCAG AAA minimum (7:1+ ratio)
- Never rely on color alone to convey meaning
- Status communicated with icons + badges

### Screen Readers
- Semantic HTML (`<button>`, `<h1>`, `<nav>`)
- ARIA labels when needed (`aria-live`, `role`)
- Descriptive button text (not "Click Here")

### Motion
- Animations are smooth and brief (< 1 second typical)
- Respects `prefers-reduced-motion` setting
- Focus indicators never depend on animation

---

## 📂 File Structure

```
AutoScale/
├── app/
│   ├── globals.css                      # Token definitions
│   └── (app)/
│       └── design-system/               # Design system UI
│           ├── page.tsx                 # Home / Gallery
│           ├── tokens/page.tsx          # Token reference
│           ├── patterns/page.tsx        # Patterns guide
│           └── components/page.tsx      # Component library
├── components/
│   ├── ui/                              # Base components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── select.tsx
│   │   └── ...
│   └── ...
├── tailwind.config.ts                   # Tailwind configuration
├── DESIGN_SYSTEM.md                     # Full specification
└── docs/
    └── DESIGN_SYSTEM_QUICKSTART.md      # Quick start guide
```

---

## 🔄 Updating the Design System

When making changes:

1. **Update token** in `app/globals.css` (light + dark mode)
2. **Update Tailwind config** in `tailwind.config.ts` if needed
3. **Update component** if specific styling changed
4. **Run typecheck**: `npm run typecheck` (Tailwind IntelliSense)
5. **Test in both modes**: Toggle dark mode, verify contrast
6. **Update this documentation** if user-visible
7. **Verify in all viewports**: Mobile, tablet, desktop

---

## 🎓 Learning Resources

- **Official Docs**: See `DESIGN_SYSTEM.md` for complete spec
- **Interactive Pages**: Visit `/design-system` to see live components
- **Quick Start**: See `docs/DESIGN_SYSTEM_QUICKSTART.md` for common patterns
- **Tailwind CSS**: https://tailwindcss.com
- **Radix UI**: https://radix-ui.com
- **Class Variance Authority**: https://cva.style

---

## ✅ Quality Checklist

Before shipping any UI:

- [ ] Follows mobile-first responsive pattern
- [ ] Dark mode verified (contrast, visibility)
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] All colors from token palette
- [ ] Evidence chain protected (sources linked when needed)
- [ ] Empty, loading, and error states present
- [ ] Low-confidence warnings explicit
- [ ] Semantic HTML used
- [ ] No disconnected content
- [ ] Animations smooth and purposeful
- [ ] Tests pass: `npm run typecheck`, `npm run lint`

---

## 🚀 Getting Started

### For Developers:
1. Visit `/design-system` to see the visual gallery
2. Reference `/design-system/tokens` for exact values
3. Copy components from `/design-system/components`
4. Follow patterns from `/design-system/patterns`
5. Use `docs/DESIGN_SYSTEM_QUICKSTART.md` for quick answers

### For Designers:
1. Review `DESIGN_SYSTEM.md` for complete spec
2. Reference color values and breakpoints
3. Check typography scale and spacing
4. Verify animations and motion specs

### For PMs:
1. Understand the evidence chain rules in patterns guide
2. Review quality checklist for launch readiness
3. Check accessibility requirements

---

## 📝 Changelog

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2025-01-16 | Initial design system release |

---

**Last Updated**: January 16, 2025  
**Maintainers**: AutoScale Shorts Design & Engineering Team  
**Status**: Active & Current
