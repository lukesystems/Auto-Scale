export const metadata = { title: "Refund Policy · AutoScale" };

const LAST_UPDATED = "July 8, 2026";

export default function RefundsPage() {
  return (
    <article>
      <h1>Refund Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <h2>Subscriptions</h2>
      <p>
        If AutoScale did not work for you, email us within 14 days of your first payment
        and we will refund it in full — no questions beyond what helps us fix the
        problem. Renewal payments are refundable within 72 hours of the charge if no
        credits from the new cycle have been spent.
      </p>

      <h2>Top-up credits</h2>
      <p>
        Unused top-up purchases are refundable within 14 days. Once credits from a pack
        have been spent on runs or video renders, that pack is no longer refundable.
      </p>

      <h2>Cancellation</h2>
      <p>
        Cancel anytime from Settings → Billing (customer portal). You keep access and
        remaining credits until the end of the paid period; no partial-month refunds
        after the windows above.
      </p>

      <h2>How to request</h2>
      <p>
        Email <a href="mailto:support@autoscaleshorts.com">support@autoscaleshorts.com</a>{" "}
        from your account email with the payment date. Refunds are processed through
        Lemon Squeezy to the original payment method.
      </p>
    </article>
  );
}
