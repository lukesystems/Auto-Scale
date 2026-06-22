import sharp from "sharp";

export interface SlideRenderInput {
  onScreenText: string;
  voiceoverLine?: string | null;
  role: string;
  aspectRatio?: string;
}

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLines(text: string, maxChars = 28): string[] {
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
  return lines.slice(0, 6);
}

/**
 * Render a storyboard slide scene to PNG via SVG → sharp.
 * Slide-first volume engine for SaaS short-form video.
 */
export async function renderSlidePng(input: SlideRenderInput): Promise<Buffer> {
  const dims = DIMENSIONS[input.aspectRatio ?? "9:16"] ?? DIMENSIONS["9:16"];
  const headline = input.onScreenText?.trim() || input.voiceoverLine?.trim() || input.role;
  const lines = wrapLines(headline);
  const lineHeight = 72;
  const startY = dims.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<tspan x="${dims.width / 2}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const roleLabel = escapeXml(input.role.toUpperCase());
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${dims.width}" height="${dims.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <text x="${dims.width / 2}" y="120" text-anchor="middle" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="600" letter-spacing="4">${roleLabel}</text>
  <text text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700">${tspans}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
