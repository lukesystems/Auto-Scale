import { AsyncLocalStorage } from "node:async_hooks";

const projectAIContext = new AsyncLocalStorage<{ projectModelSlug: string | null }>();

export function withProjectAIContext<T>(
  projectModelSlug: string | null | undefined,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return projectAIContext.run({ projectModelSlug: projectModelSlug ?? null }, fn);
}

export function getProjectModelFromContext(): string | null {
  return projectAIContext.getStore()?.projectModelSlug ?? null;
}
