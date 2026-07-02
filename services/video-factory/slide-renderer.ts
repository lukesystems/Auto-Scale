import sharp from "sharp";
import type { SceneContract } from "./scene-contract";

export interface SlideRenderInput {
  onScreenText: string;
  voiceoverLine?: string | null;
  role: string;
  purpose?: string;
  aspectRatio?: string;
  overlayText?: string | null;
  subtitleText?: string | null;
  brandColor?: string | null;
  isHook?: boolean;
  isCta?: boolean;
  /** kinetic | metric | motion for quality-first slide variants */
  slideStyle?: "default" | "kinetic" | "metric" | "motion";
  /** myth | reality | them | us for split layouts */
  slideLayout?: "default" | "myth_reality" | "comparison";
  splitLabel?: string;
  splitBody?: string;
}

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

/** TikTok/Reels safe zone — keep text inside central 80% width, away from UI chrome. */
const SAFE = { top: 180, bottom: 280, side: 108, maxTextWidth: 864 };

const DEFAULT_BRAND = "#6366f1";
const BG_DARK = "#0a0a0f";
const BG_ACCENT = "#12121a";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function parseBrandColor(hex: string | null | undefined): string {
  if (!hex) return DEFAULT_BRAND;
  const cleaned = hex.trim();
  return /^#[0-9a-fA-F]{6}$/.test(cleaned) ? cleaned : DEFAULT_BRAND;
}

/** Truncate headline to maxWords, adding ellipsis if needed. */
function capHeadline(text: string, maxWords = 8): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + "…";
}

/**
 * Render a 9:16 vertical slide with SaaS-style typography and safe zones.
 */
export async function renderSlidePng(input: SlideRenderInput): Promise<Buffer> {
  const split = parseSplitOverlay(input.overlayText);
  const layout =
    input.slideLayout ??
    (split?.kind === "myth" || split?.kind === "reality"
      ? "myth_reality"
      : split?.kind === "them" || split?.kind === "us"
        ? "comparison"
        : "default");

  if (layout === "myth_reality" && split) {
    return renderMythRealitySlide({ ...input, splitLabel: split.label, splitBody: split.body });
  }
  if (layout === "comparison" && split) {
    return renderComparisonSlide({ ...input, splitLabel: split.label, splitBody: split.body });
  }

  if (input.slideStyle === "kinetic") {
    return renderKineticSlide(input);
  }
  if (input.slideStyle === "metric") {
    return renderMetricSlide(input);
  }
  if (input.slideStyle === "motion") {
    return renderMotionSlide(input);
  }

  return renderDefaultSlide(input);
}

function parseSplitOverlay(
  overlay?: string | null
): { kind: "myth" | "reality" | "them" | "us"; label: string; body: string } | null {
  if (!overlay?.includes("|")) return null;
  const [label, ...rest] = overlay.split("|");
  const body = rest.join("|").trim();
  const key = label.trim().toUpperCase();
  if (key === "MYTH") return { kind: "myth", label: "MYTH", body };
  if (key === "REALITY") return { kind: "reality", label: "REALITY", body };
  if (key === "THEM") return { kind: "them", label: "THEM", body };
  if (key === "US") return { kind: "us", label: "US", body };
  return null;
}

async function renderMythRealitySlide(
  input: SlideRenderInput & { splitLabel: string; splitBody: string }
): Promise<Buffer> {
  const dims = DIMENSIONS[input.aspectRatio ?? "9:16"] ?? DIMENSIONS["9:16"];
  const brand = parseBrandColor(input.brandColor);
  const isMyth = input.splitLabel === "MYTH";
  const accent = isMyth ? "#64748b" : brand;
  const bg = isMyth ? "#1e293b" : "#12121a";
  const lines = wrapLines(input.splitBody, 22);

  const tspans = lines
    .map((line, i) => {
      const y = dims.height / 2 - 40 + i * 62;
      return `<tspan x="${dims.width / 2}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${dims.width}" height="${dims.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG_DARK}"/>
  <rect x="${SAFE.side}" y="${SAFE.top + 80}" width="${dims.width - SAFE.side * 2}" height="${dims.height - SAFE.top - SAFE.bottom - 120}" rx="20" fill="${bg}" stroke="${accent}" stroke-width="3"/>
  <text x="${dims.width / 2}" y="${SAFE.top + 140}" text-anchor="middle" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" letter-spacing="4">${escapeXml(input.splitLabel)}</text>
  <text text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700">${tspans}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderComparisonSlide(
  input: SlideRenderInput & { splitLabel: string; splitBody: string }
): Promise<Buffer> {
  const dims = DIMENSIONS[input.aspectRatio ?? "9:16"] ?? DIMENSIONS["9:16"];
  const brand = parseBrandColor(input.brandColor);
  const isThem = input.splitLabel === "THEM";
  const colW = (dims.width - SAFE.side * 2 - 24) / 2;
  const leftX = SAFE.side;
  const rightX = SAFE.side + colW + 24;
  const activeX = isThem ? leftX : rightX;
  const activeColor = isThem ? "#64748b" : brand;
  const lines = wrapLines(input.splitBody, 16);
  const tspans = lines
    .map((line, i) => {
      const y = dims.height / 2 + i * 56;
      return `<tspan x="${activeX + colW / 2}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${dims.width}" height="${dims.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG_DARK}"/>
  <rect x="${leftX}" y="${SAFE.top + 100}" width="${colW}" height="${dims.height - SAFE.top - SAFE.bottom - 140}" rx="16" fill="#1e293b" stroke="${isThem ? activeColor : "#334155"}" stroke-width="${isThem ? 4 : 2}"/>
  <rect x="${rightX}" y="${SAFE.top + 100}" width="${colW}" height="${dims.height - SAFE.top - SAFE.bottom - 140}" rx="16" fill="#12121a" stroke="${!isThem ? activeColor : "#334155"}" stroke-width="${!isThem ? 4 : 2}"/>
  <text x="${leftX + colW / 2}" y="${SAFE.top + 150}" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="24" font-weight="700">THEM</text>
  <text x="${rightX + colW / 2}" y="${SAFE.top + 150}" text-anchor="middle" fill="${brand}" font-family="Arial" font-size="24" font-weight="700">US</text>
  <text text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700">${tspans}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function slideHeadline(input: SlideRenderInput): { headline: string; lines: string[]; isHook: boolean; isCta: boolean } {
  const isHook = input.isHook ?? (input.role === "hook" || input.purpose === "hook");
  const isCta = input.isCta ?? (input.role === "cta" || input.purpose === "cta");
  const rawHeadline =
    input.overlayText?.trim() ||
    input.onScreenText?.trim() ||
    input.voiceoverLine?.trim() ||
    input.role;
  const headline = capHeadline(rawHeadline, isHook ? 6 : 8);
  const maxChars = isHook ? 18 : isCta ? 24 : 28;
  const lines = wrapLines(headline, maxChars);
  return { headline, lines, isHook, isCta };
}

async function renderKineticSlide(input: SlideRenderInput): Promise<Buffer> {
  const dims = DIMENSIONS[input.aspectRatio ?? "9:16"] ?? DIMENSIONS["9:16"];
  const brand = parseBrandColor(input.brandColor);
  const { lines, isHook } = slideHeadline(input);
  const fontSize = isHook ? 76 : 58;
  const lineHeight = isHook ? 88 : 68;
  const textBlockHeight = (lines.length - 1) * lineHeight;
  const centerY = dims.height / 2;
  const startY = centerY - textBlockHeight / 2;
  const tspans = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<tspan x="${dims.width / 2}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");
  const streaks = `
    <line x1="${SAFE.side}" y1="${SAFE.top + 40}" x2="${dims.width - SAFE.side}" y2="${SAFE.top + 120}" stroke="${brand}" stroke-width="4" opacity="0.35"/>
    <line x1="${SAFE.side + 40}" y1="${dims.height - SAFE.bottom - 60}" x2="${dims.width - SAFE.side - 40}" y2="${dims.height - SAFE.bottom - 140}" stroke="${brand}" stroke-width="3" opacity="0.25"/>`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${dims.width}" height="${dims.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG_DARK}"/>
  <rect x="0" y="0" width="100%" height="42%" fill="${brand}" opacity="0.12"/>
  ${streaks}
  <text text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="-1">${tspans}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderMetricSlide(input: SlideRenderInput): Promise<Buffer> {
  const dims = DIMENSIONS[input.aspectRatio ?? "9:16"] ?? DIMENSIONS["9:16"];
  const brand = parseBrandColor(input.brandColor);
  const { lines } = slideHeadline(input);
  const metricLine = lines[0] ?? "Proof";
  const support = lines.slice(1).join(" ");
  const cardY = dims.height / 2 - 120;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${dims.width}" height="${dims.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG_DARK}"/>
  <rect x="${SAFE.side}" y="${cardY}" width="${dims.width - SAFE.side * 2}" height="280" rx="24" fill="#12121a" stroke="${brand}" stroke-width="3"/>
  <text x="${dims.width / 2}" y="${cardY + 110}" text-anchor="middle" fill="${brand}" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="800">${escapeXml(metricLine.slice(0, 12))}</text>
  <text x="${dims.width / 2}" y="${cardY + 190}" text-anchor="middle" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600">${escapeXml(support.slice(0, 60))}</text>
  <text x="${SAFE.side + 24}" y="${SAFE.top + 8}" fill="#94a3b8" font-family="Arial" font-size="22" font-weight="700" letter-spacing="3">PROOF</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderMotionSlide(input: SlideRenderInput): Promise<Buffer> {
  const dims = DIMENSIONS[input.aspectRatio ?? "9:16"] ?? DIMENSIONS["9:16"];
  const brand = parseBrandColor(input.brandColor);
  const { lines } = slideHeadline({ ...input, isCta: true });
  const fontSize = 56;
  const lineHeight = 66;
  const textBlockHeight = (lines.length - 1) * lineHeight;
  const centerY = dims.height / 2 - 40;
  const startY = centerY - textBlockHeight / 2;
  const tspans = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<tspan x="${dims.width / 2}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");
  const btnY = startY + textBlockHeight + 56;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${dims.width}" height="${dims.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG_DARK}"/>
  <circle cx="${dims.width * 0.85}" cy="${SAFE.top + 80}" r="120" fill="${brand}" opacity="0.18"/>
  <circle cx="${dims.width * 0.12}" cy="${dims.height - SAFE.bottom}" r="90" fill="${brand}" opacity="0.12"/>
  <text text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800">${tspans}</text>
  <rect x="${dims.width / 2 - 200}" y="${btnY}" width="400" height="80" rx="40" fill="${brand}"/>
  <text x="${dims.width / 2}" y="${btnY + 52}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">Take action</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderDefaultSlide(input: SlideRenderInput): Promise<Buffer> {
  const dims = DIMENSIONS[input.aspectRatio ?? "9:16"] ?? DIMENSIONS["9:16"];
  const brand = parseBrandColor(input.brandColor);
  const isHook = input.isHook ?? (input.role === "hook" || input.purpose === "hook");
  const isCta = input.isCta ?? (input.role === "cta" || input.purpose === "cta");

  const rawHeadline =
    input.overlayText?.trim() ||
    input.onScreenText?.trim() ||
    input.voiceoverLine?.trim() ||
    input.role;
  const headline = capHeadline(rawHeadline, 8);

  const maxChars = isHook ? 22 : 28;
  const lines = wrapLines(headline, maxChars);
  const fontSize = isHook ? 64 : isCta ? 52 : 48;
  const lineHeight = isHook ? 78 : 62;
  const textBlockHeight = (lines.length - 1) * lineHeight;
  const centerY = dims.height / 2;
  const startY = centerY - textBlockHeight / 2;

  const tspans = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<tspan x="${dims.width / 2}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const subtitle = input.subtitleText?.trim();
  const subtitleBlock = subtitle
    ? `<text x="${dims.width / 2}" y="${dims.height - SAFE.bottom + 40}" text-anchor="middle" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="500">${escapeXml(subtitle.slice(0, 80))}</text>`
    : "";

  const roleLabel = escapeXml((input.purpose ?? input.role).toUpperCase().replace(/_/g, " "));
  const accentBar = isHook
    ? `<rect x="${SAFE.side}" y="${SAFE.top - 20}" width="8" height="56" rx="4" fill="${brand}"/>`
    : "";
  const ctaButton = isCta
    ? `<rect x="${dims.width / 2 - 160}" y="${startY + textBlockHeight + 48}" width="320" height="72" rx="36" fill="${brand}"/>
       <text x="${dims.width / 2}" y="${startY + textBlockHeight + 94}" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">Learn more</text>`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${dims.width}" height="${dims.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG_DARK}"/>
      <stop offset="100%" stop-color="${BG_ACCENT}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${brand}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${brand}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="100%" height="35%" fill="url(#accent)"/>
  ${accentBar}
  <text x="${SAFE.side + 24}" y="${SAFE.top + 8}" fill="${brand}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="3">${roleLabel}</text>
  <text text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800">${tspans}</text>
  ${ctaButton}
  ${subtitleBlock}
  <rect x="${SAFE.side}" y="${SAFE.top}" width="${dims.width - SAFE.side * 2}" height="${dims.height - SAFE.top - SAFE.bottom}" fill="none" stroke="none"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export function sceneToSlideInput(
  scene: Pick<
    SceneContract,
    "purpose" | "voiceover_text" | "subtitle_text" | "overlay_text" | "visual_prompt"
  > & { role?: string },
  opts?: { aspectRatio?: string; brandColor?: string | null; slideStyle?: SlideRenderInput["slideStyle"] }
): SlideRenderInput {
  const split = parseSplitOverlay(scene.overlay_text);
  return {
    onScreenText: scene.overlay_text || scene.visual_prompt || scene.voiceover_text,
    voiceoverLine: scene.voiceover_text,
    role: scene.role ?? scene.purpose,
    purpose: scene.purpose,
    aspectRatio: opts?.aspectRatio ?? "9:16",
    overlayText: scene.overlay_text,
    subtitleText: scene.subtitle_text,
    brandColor: opts?.brandColor,
    isHook: scene.purpose === "hook",
    isCta: scene.purpose === "cta",
    slideStyle: opts?.slideStyle ?? "default",
    slideLayout: split
      ? split.kind === "myth" || split.kind === "reality"
        ? "myth_reality"
        : "comparison"
      : "default",
    splitLabel: split?.label,
    splitBody: split?.body,
  };
}
