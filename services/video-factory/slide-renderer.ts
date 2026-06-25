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

/**
 * Render a 9:16 vertical slide with SaaS-style typography and safe zones.
 */
export async function renderSlidePng(input: SlideRenderInput): Promise<Buffer> {
  const dims = DIMENSIONS[input.aspectRatio ?? "9:16"] ?? DIMENSIONS["9:16"];
  const brand = parseBrandColor(input.brandColor);
  const isHook = input.isHook ?? (input.role === "hook" || input.purpose === "hook");
  const isCta = input.isCta ?? (input.role === "cta" || input.purpose === "cta");

  const headline =
    input.overlayText?.trim() ||
    input.onScreenText?.trim() ||
    input.voiceoverLine?.trim() ||
    input.role;

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
  opts?: { aspectRatio?: string; brandColor?: string | null }
): SlideRenderInput {
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
  };
}
