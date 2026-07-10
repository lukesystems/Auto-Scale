/**
 * A single "TypeError: fetch failed" from a transient network blip
 * shouldn't discard an expensive upstream LLM/render result. Retry
 * network-level failures (not real constraint/validation errors) a
 * few times with backoff before giving up.
 */
export async function withFetchRetry<T>(
  fn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  label: string,
  attempts = 3
): Promise<T> {
  let lastMessage = "unknown error";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { data, error } = await fn();
    if (!error && data) return data;
    lastMessage = error?.message ?? "no data returned";
    const transient = /fetch failed|ECONNRESET|ETIMEDOUT|522|network/i.test(lastMessage);
    if (!transient || attempt === attempts) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  throw new Error(`${label}: ${lastMessage}`);
}
