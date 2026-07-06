export interface RenderWorkerKickTarget {
  url: URL;
  secret: string;
  externalWorker: boolean;
}

export function resolveRenderWorkerBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const externalWorker = env.AUTOSCALE_RENDER_WORKER_URL?.trim();
  if (externalWorker) return externalWorker.replace(/\/$/, "");
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/$/, "");
  if (env.NODE_ENV === "development") return "http://localhost:3000";
  return null;
}

export function resolveRenderWorkerKickSecret(
  externalWorker: boolean,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (externalWorker) {
    return env.AUTOSCALE_RENDER_WORKER_SECRET?.trim() || null;
  }
  return env.AUTOSCALE_CRON_SECRET?.trim() || env.CRON_SECRET?.trim() || null;
}

export function resolveRenderWorkerKickTarget(
  growthRunId?: string,
  env: NodeJS.ProcessEnv = process.env
): RenderWorkerKickTarget | { error: string } {
  const base = resolveRenderWorkerBaseUrl(env);
  const externalWorker = Boolean(env.AUTOSCALE_RENDER_WORKER_URL?.trim());
  const secret = resolveRenderWorkerKickSecret(externalWorker, env);

  if (!base) return { error: "worker URL is not configured" };
  if (!secret) {
    return {
      error: externalWorker
        ? "AUTOSCALE_RENDER_WORKER_SECRET is not configured"
        : "AUTOSCALE_CRON_SECRET or CRON_SECRET is not configured",
    };
  }

  const url = new URL(externalWorker ? "/run" : "/api/cron/render-worker", base);
  if (growthRunId) url.searchParams.set("growthRunId", growthRunId);
  return { url, secret, externalWorker };
}
