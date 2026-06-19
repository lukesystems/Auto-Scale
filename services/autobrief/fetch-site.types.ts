export interface SiteFetchInput {
  url: string;
}

export interface ExtractedPage {
  url: string;
  title: string | null;
  description: string | null;
  headings: string[];
  ctas: string[];
  bodyText: string;
}

export interface SiteFetchOutput {
  ok: boolean;
  url: string;
  finalUrl: string | null;
  title: string | null;
  description: string | null;
  textSnippet: string | null;
  pages: ExtractedPage[];
  crawlId?: string | null;
  factsCount?: number;
  error: string | null;
}
