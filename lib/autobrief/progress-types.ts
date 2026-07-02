export type AutoBriefProgressPhase =
  | "starting"
  | "crawl"
  | "extract"
  | "brief"
  | "done"
  | "failed";

export type AutoBriefProgressEventKind =
  | "phase"
  | "page_fetch"
  | "page_extract"
  | "info"
  | "error";

export interface AutoBriefProgressEvent {
  id: string;
  at: string;
  message: string;
  kind: AutoBriefProgressEventKind;
  url?: string;
  pathname?: string;
  adapter?: string;
  pageType?: string;
  factCount?: number;
  status?: "running" | "success" | "failed";
}

export interface AutoBriefProgressState {
  phase: AutoBriefProgressPhase;
  currentMessage: string;
  events: AutoBriefProgressEvent[];
  pagesDiscovered: number;
  pagesCrawled: number;
  factsFound: number;
}
