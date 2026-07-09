import Link from "next/link";

import { Logo } from "@/components/brand/logo";



export function Footer() {

  return (

    <footer className="border-t border-border/40 py-12">

      <div className="container">

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">

          <div className="space-y-3">

            <Logo />

            <p className="text-sm text-muted-foreground max-w-xs">

              A repeatable short-form video distribution loop for SaaS founders who measure signups, not impressions.

            </p>

          </div>



          <div>

            <h4 className="text-sm font-semibold mb-3">Product</h4>

            <ul className="space-y-2 text-sm text-muted-foreground">

              <li><Link href="#loop" className="hover:text-foreground">Core loop</Link></li>

              <li><Link href="#evidence" className="hover:text-foreground">Evidence chain</Link></li>

              <li><Link href="#modules" className="hover:text-foreground">Engine</Link></li>

              <li><Link href="#compare" className="hover:text-foreground">Compare</Link></li>

              <li><Link href="#pricing" className="hover:text-foreground">Pricing</Link></li>

              <li><Link href="#faq" className="hover:text-foreground">FAQ</Link></li>

            </ul>

          </div>



          <div>

            <h4 className="text-sm font-semibold mb-3">Get started</h4>

            <ul className="space-y-2 text-sm text-muted-foreground">

              <li><Link href="/auth/sign-up" className="hover:text-foreground">Create account</Link></li>

              <li><Link href="/auth/sign-in" className="hover:text-foreground">Sign in</Link></li>

              <li><Link href="/projects" className="hover:text-foreground">Dashboard</Link></li>

            </ul>

          </div>



          <div>

            <h4 className="text-sm font-semibold mb-3">Support & legal</h4>

            <ul className="space-y-2 text-sm text-muted-foreground">

              <li><a href="mailto:support@autoscaleshorts.com" className="hover:text-foreground">Support</a></li>

              {process.env.NEXT_PUBLIC_DISCORD_INVITE && (

                <li><a href={process.env.NEXT_PUBLIC_DISCORD_INVITE} target="_blank" rel="noreferrer" className="hover:text-foreground">Join our Discord</a></li>

              )}

              <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>

              <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>

              <li><Link href="/refunds" className="hover:text-foreground">Refund Policy</Link></li>

            </ul>

          </div>

        </div>



        <div className="mt-12 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">

          <div>© {new Date().getFullYear()} AutoScale Shorts. Built for builders who ship.</div>

          <div className="font-mono">

            Find what works → Ship videos → Track users → Compound winners

          </div>

        </div>

      </div>

    </footer>

  );

}

