import type { CaptionPage } from "./paging";

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export interface AssExportOptions {
  width?: number;
  height?: number;
  fontName?: string;
  fontSize?: number;
  marginV?: number;
  karaoke?: boolean;
}

/** Scale caption font size relative to a 1080-wide baseline. */
function scaledFontSize(baseSize: number, width: number): number {
  return Math.round(baseSize * (width / 1080));
}

/** Export caption pages as ASS (optional karaoke \\k tags). */
export function formatAssCaptions(
  pages: CaptionPage[],
  opts: AssExportOptions = {}
): string {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1920;
  const fontName = opts.fontName ?? "Arial";
  const fontSize = opts.fontSize ?? scaledFontSize(58, width);
  const marginV = opts.marginV ?? Math.round(height * 0.12);
  const marginSide = Math.round(width * 0.07);
  const outlineWidth = Math.max(2, Math.round(fontSize / 20));

  const header = `[Script Info]
Title: AutoScale Captions
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H96000000,1,0,0,0,100,100,0,0,1,${outlineWidth},1,2,${marginSide},${marginSide},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = pages.map((page) => {
    const start = formatAssTime(page.startSeconds);
    const end = formatAssTime(page.endSeconds);
    let text = page.text.replace(/\n/g, "\\N");

    if (opts.karaoke && page.words.length > 1) {
      text = page.words
        .map((w) => {
          const durCs = Math.max(1, Math.round((w.endSeconds - w.startSeconds) * 100));
          return `{\\k${durCs}}${w.text}`;
        })
        .join(" ");
    }

    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  });

  return `${header}${lines.join("\n")}\n`;
}

/** Convert caption pages to SRT for export / fallback burn-in. */
export function pagesToSrt(pages: CaptionPage[]): string {
  return pages
    .map((page, i) => {
      const start = formatSrtTime(page.startSeconds);
      const end = formatSrtTime(page.endSeconds);
      return `${i + 1}\n${start} --> ${end}\n${page.text}\n`;
    })
    .join("\n");
}

/** @deprecated use formatAssCaptions */
export const buildAssFromPages = formatAssCaptions;
