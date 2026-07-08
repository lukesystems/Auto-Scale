export const metadata = { title: "Terms of Service · AutoScale" };

const LAST_UPDATED = "July 8, 2026";

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of AutoScale
        (autoscaleshorts.com), a short-form video growth intelligence service
        (&quot;the Service&quot;). By creating an account or using the Service you agree
        to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        AutoScale analyzes your product website and public market signals to generate
        content strategy, scripts, and short-form videos, and can schedule publishing to
        connected social accounts. Output quality depends on publicly available
        information about your product and market; results are not guaranteed.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You are responsible for your account credentials and all activity under your
        account. You must provide accurate information and be authorized to act for any
        business you connect.
      </p>

      <h2>3. Subscriptions, credits, and payment</h2>
      <p>
        Paid plans are billed monthly through our payment provider, Lemon Squeezy. Plans
        include a monthly credit allotment that resets each billing cycle; purchased
        top-up credits do not expire. Credits are consumed when starting Growth Runs and
        rendering videos. Unused plan credits are not refundable as cash.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        You may not use the Service to produce unlawful, deceptive, or infringing
        content; to spam platforms; or to violate the terms of the social platforms you
        publish to. We may suspend accounts that abuse the Service or generate abusive
        load.
      </p>

      <h2>5. Your content and data</h2>
      <p>
        You retain ownership of the content generated for your account. You grant us the
        rights needed to operate the Service (processing your inputs, storing outputs,
        publishing on your instruction). See our Privacy Policy for data handling.
      </p>

      <h2>6. Disclaimers and liability</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties. To the maximum
        extent permitted by law, our aggregate liability is limited to the amounts you
        paid in the three months before the claim.
      </p>

      <h2>7. Termination</h2>
      <p>
        You may cancel anytime via the customer portal; access continues to the end of
        the paid period. We may terminate for breach of these Terms.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these Terms; material changes will be announced via email or
        in-app notice. Continued use after changes means acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@autoscaleshorts.com">support@autoscaleshorts.com</a>
      </p>
    </article>
  );
}
