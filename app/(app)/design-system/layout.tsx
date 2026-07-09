import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Code, Palette, Zap } from "lucide-react";

export default function DesignSystemIndex() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 -z-10 gradient-mesh opacity-30" />
        <div className="container py-16 max-w-6xl relative">
          <Badge variant="outline" className="mb-4">Design System v1.0</Badge>
          <h1 className="text-5xl font-bold text-balance mb-4">
            AutoScale Shorts <span className="text-gradient">Design System</span>
          </h1>
          <p className="text-lg text-muted-foreground text-balance mb-6 max-w-2xl">
            Complete reference for colors, typography, components, and patterns. Built to protect the evidence chain and ensure clarity.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="default" size="lg">
              <Link href="/design-system">View Full System</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#resources">Browse Sections</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-16 max-w-6xl space-y-16">
        {/* Quick Navigation */}
        <section id="resources" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">🎯 Quick Start</h2>
            <p className="text-muted-foreground">Start here based on your role</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* For Developers */}
            <Card className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-primary" />
                    <CardTitle>For Developers</CardTitle>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription>Copy-paste components and quick reference</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  Need a button variant? Want to know the spacing scale? Looking for copy-paste code?
                </p>
                <div className="space-y-2">
                  <Link href="/design-system/components" className="text-sm text-primary hover:underline flex items-center gap-1">
                    Component Library
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link href="../../docs/DESIGN_SYSTEM_QUICKSTART.md" className="text-sm text-primary hover:underline flex items-center gap-1">
                    Quick Start Guide
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* For Designers */}
            <Card className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    <CardTitle>For Designers</CardTitle>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription>Colors, typography, and system rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  What are the exact color values? What's the type scale? When should I use which component?
                </p>
                <div className="space-y-2">
                  <Link href="/design-system/tokens" className="text-sm text-primary hover:underline flex items-center gap-1">
                    All Tokens
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link href="../../DESIGN_SYSTEM.md" className="text-sm text-primary hover:underline flex items-center gap-1">
                    Full Specification
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Main Sections */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">📚 Main Sections</h2>
            <p className="text-muted-foreground">Navigate the full design system</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Design System Home */}
            <Card className="hover:shadow-md transition-shadow group cursor-pointer">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">Design System Gallery</CardTitle>
                <CardDescription>Visual reference & component showcase</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  See all components, colors, and patterns in action with live previews.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/design-system">
                    View Gallery
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Tokens */}
            <Card className="hover:shadow-md transition-shadow group cursor-pointer">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">Design Tokens</CardTitle>
                <CardDescription>Colors, spacing, typography, shadows</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Exact values, CSS custom properties, and semantic usage for all tokens.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/design-system/tokens">
                    View Tokens
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Patterns */}
            <Card className="hover:shadow-md transition-shadow group cursor-pointer">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">Patterns & Best Practices</CardTitle>
                <CardDescription>Common layouts & evidence chain rules</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Proven patterns, accessibility guidelines, and how to protect the evidence chain.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/design-system/patterns">
                    View Patterns
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Component Library */}
            <Card className="hover:shadow-md transition-shadow group cursor-pointer">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">Component Library</CardTitle>
                <CardDescription>Copy-paste ready examples</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Production-ready components with code snippets for instant copy-paste.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/design-system/components">
                    Browse Components
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Full Spec */}
            <Card className="hover:shadow-md transition-shadow group cursor-pointer">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">Full Specification</CardTitle>
                <CardDescription>Complete design system documentation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Comprehensive reference for every aspect of the design system.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="../../DESIGN_SYSTEM.md">
                    Read Full Spec
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Quick Start */}
            <Card className="hover:shadow-md transition-shadow group cursor-pointer">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">Developer Quick Start</CardTitle>
                <CardDescription>Fast reference for common tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Quick answers: colors, components, forms, layouts, animations.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="../../docs/DESIGN_SYSTEM_QUICKSTART.md">
                    Quick Start
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Key Principles */}
        <section className="space-y-6 bg-secondary/50 p-8 rounded-xl">
          <div>
            <h2 className="text-2xl font-bold mb-2">🔐 Core Principles</h2>
            <p className="text-muted-foreground">What makes this design system unique</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Token-First
              </h3>
              <p className="text-sm text-muted-foreground">
                Every visual decision uses CSS custom properties. Single source of truth, automatic dark mode, easy maintenance.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Evidence Chain
              </h3>
              <p className="text-sm text-muted-foreground">
                Every claim is traceable to a source. No disconnected content. Low-confidence warnings explicit.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Production-Ready
              </h3>
              <p className="text-sm text-muted-foreground">
                Accessible, responsive, dark-mode compatible, keyboard-navigable. Ready to ship.
              </p>
            </div>
          </div>
        </section>

        {/* Color Palette Preview */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">🎨 Color Palette Preview</h2>
            <p className="text-muted-foreground">Core colors at a glance</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "Primary", bg: "bg-primary", hex: "#2dd4ad" },
              { name: "Success", bg: "bg-success", hex: "#4f8b4d" },
              { name: "Warning", bg: "bg-warning", hex: "#ffb300" },
              { name: "Destructive", bg: "bg-destructive", hex: "#e63d4f" },
            ].map((color) => (
              <div key={color.name} className="space-y-2">
                <div className={`${color.bg} h-16 rounded-lg shadow-sm`} />
                <div>
                  <p className="font-medium text-sm">{color.name}</p>
                  <code className="text-xs text-muted-foreground font-mono">{color.hex}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Get Started Section */}
        <section className="bg-primary/5 border border-primary/20 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to build?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Start with the component library for copy-paste examples, or dive into the full specification for complete details.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="default" size="lg">
              <Link href="/design-system/components">Browse Components</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="../../DESIGN_SYSTEM.md">Read Full Spec</Link>
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Last updated: January 16, 2025 ·{" "}
            <Link href="../../docs/DESIGN_SYSTEM_README.md" className="text-primary hover:underline">
              View README
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
