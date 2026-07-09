export const metadata = { title: "Privacy Policy · AutoScale Shorts" };

const LAST_UPDATED = "July 8, 2026";

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <p>
        This policy explains what data AutoScale Shorts (autoscaleshorts.com) collects and how
        it is used.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> email, display name, and authentication data
          (stored with Supabase).
        </li>
        <li>
          <strong>Product inputs:</strong> the website URLs you submit and the public
          website content we crawl from them to build your product brief.
        </li>
        <li>
          <strong>Generated artifacts:</strong> briefs, discovery results, strategies,
          scripts, and rendered videos created for your account.
        </li>
        <li>
          <strong>Billing data:</strong> subscription and payment status from Lemon
          Squeezy. We never see or store full card numbers.
        </li>
        <li>
          <strong>Connected accounts:</strong> tokens/identifiers needed to schedule
          posts to your social accounts via Post Bridge, stored encrypted.
        </li>
      </ul>

      <h2>How we use data</h2>
      <p>
        To operate the Service: generating your briefs and strategies (which involves
        sending your inputs to AI model providers via OpenRouter), discovering public
        market signals (search and social-content providers), rendering videos, and
        scheduling posts you approve. We do not sell your data.
      </p>

      <h2>Processors we rely on</h2>
      <p>
        Supabase (database/auth), Vercel (hosting), OpenRouter (AI models), Firecrawl
        and Apify (public web/social search), Lemon Squeezy (payments, merchant of
        record), Post Bridge (publishing), Cloudflare R2 (media storage), ElevenLabs
        (voiceover).
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Account data and artifacts are retained while your account is active. Email{" "}
        <a href="mailto:support@autoscaleshorts.com">support@autoscaleshorts.com</a> to
        request deletion of your account and associated data.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@autoscaleshorts.com">support@autoscaleshorts.com</a>
      </p>
    </article>
  );
}
