export function safeRelativeRedirect(value: string | null | undefined, fallback = "/projects"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://autoscale.local");
    return parsed.origin === "https://autoscale.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}
