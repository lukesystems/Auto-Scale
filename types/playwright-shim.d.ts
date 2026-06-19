declare module "playwright" {
  export const chromium: {
    launch: (options?: { headless?: boolean }) => Promise<{
      newPage: () => Promise<{
        goto: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<void>;
        url: () => string;
        content: () => Promise<string>;
      }>;
      close: () => Promise<void>;
    }>;
  };
}
