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

/** Convert a `#RRGGBB` hex string to ASS's `&HBBGGRR&` colour format. */
function hexToAssColor(hex: string): string | null {
  const cleaned = hex.trim();
  const match = /^#?([0-9a-fA-F]{6})$/.exec(cleaned);
  if (!match) return null;
  const rr = match[1]!.slice(0, 2);
  const gg = match[1]!.slice(2, 4);
  const bb = match[1]!.slice(4, 6);
  return `&H00${bb}${gg}${rr}&`.toUpperCase();
}

export type CaptionStylePreset = "bold_pop" | "clean_minimal" | "neon";

export interface CaptionStyleConfig {
  /** Base font size at a 1080px-wide baseline (scaled per output width). */
  baseFontSize: number;
  /** Show a semi-opaque box behind the text (BorderStyle 3) vs. plain outline (BorderStyle 1). */
  boxBackground: boolean;
  /** Outline width in px at baseline (scaled with font size like the original behavior). */
  outlineScale: number;
  /** Shadow depth. */
  shadow: number;
  bold: boolean;
  /** Apply per-word emphasis (karaoke color fill + scale pop) when alignment/timing is available. */
  wordEmphasis: boolean;
  /** Peak scale (%) reached mid-word during the pop animation, e.g. 115 = 115%. */
  popScale: number;
  /** Primary (fill) text colour as #RRGGBB. Overridden by brand colour when provided and style allows it. */
  primaryColor: string;
  /** Outline colour as #RRGGBB. */
  outlineColor: string;
  /** Whether this preset's primary text colour should be replaced by the project's brand colour. */
  useBrandForPrimary: boolean;
  /** Whether this preset's outline colour should be replaced by the project's brand colour (neon look). */
  useBrandForOutline: boolean;
}

const BASE_STYLE: CaptionStyleConfig = {
  baseFontSize: 58,
  boxBackground: true,
  outlineScale: 1,
  shadow: 1,
  bold: true,
  wordEmphasis: true,
  popScale: 115,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  useBrandForPrimary: false,
  useBrandForOutline: false,
};

/** Named caption style presets, each derived from BASE_STYLE with targeted overrides. */
export const CAPTION_STYLE_PRESETS: Record<CaptionStylePreset, CaptionStyleConfig> = {
  bold_pop: {
    ...BASE_STYLE,
  },
  clean_minimal: {
    ...BASE_STYLE,
    baseFontSize: 44,
    boxBackground: false,
    outlineScale: 0.6,
    shadow: 0,
    bold: false,
    wordEmphasis: false,
    popScale: 100,
  },
  neon: {
    ...BASE_STYLE,
    boxBackground: false,
    outlineScale: 1.8,
    shadow: 2,
    popScale: 112,
    useBrandForPrimary: true,
    useBrandForOutline: true,
  },
};

const DEFAULT_CAPTION_STYLE: CaptionStylePreset = "bold_pop";

export interface AssExportOptions {
  width?: number;
  height?: number;
  fontName?: string;
  fontSize?: number;
  marginV?: number;
  karaoke?: boolean;
  /** Named visual preset; defaults to "bold_pop" for backward compatibility. */
  captionStyle?: CaptionStylePreset;
  /** Project brand colour as `#RRGGBB`; used by presets that opt into brand colouring. */
  brandColor?: string | null;
}

/** Scale caption font size relative to a 1080-wide baseline. */
function scaledFontSize(baseSize: number, width: number): number {
  return Math.round(baseSize * (width / 1080));
}

/** Resolve the effective style config for a preset, substituting brand colour where the preset opts in. */
function resolveStyleConfig(
  preset: CaptionStylePreset,
  brandColor: string | null | undefined
): CaptionStyleConfig {
  const config = CAPTION_STYLE_PRESETS[preset] ?? CAPTION_STYLE_PRESETS[DEFAULT_CAPTION_STYLE];
  const validBrand = brandColor && /^#?[0-9a-fA-F]{6}$/.test(brandColor.trim()) ? brandColor : null;
  if (!validBrand) return config;
  return {
    ...config,
    primaryColor: config.useBrandForPrimary ? validBrand : config.primaryColor,
    outlineColor: config.useBrandForOutline ? validBrand : config.outlineColor,
  };
}

/** Export caption pages as ASS (optional karaoke \\k tags + word-pop emphasis, brand colour, style presets). */
export function formatAssCaptions(
  pages: CaptionPage[],
  opts: AssExportOptions = {}
): string {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1920;
  const fontName = opts.fontName ?? "Arial";
  const marginV = opts.marginV ?? Math.round(height * 0.12);
  const marginSide = Math.round(width * 0.07);

  const style = resolveStyleConfig(opts.captionStyle ?? DEFAULT_CAPTION_STYLE, opts.brandColor);
  const fontSize = opts.fontSize ?? scaledFontSize(style.baseFontSize, width);
  const outlineWidth = Math.max(2, Math.round((fontSize / 20) * style.outlineScale));

  const primaryAss = hexToAssColor(style.primaryColor) ?? "&H00FFFFFF&";
  const outlineAss = hexToAssColor(style.outlineColor) ?? "&H00000000&";
  const backColorAss = style.boxBackground ? "&H96000000" : "&H00000000";
  const borderStyle = style.boxBackground ? 3 : 1;
  const boldFlag = style.bold ? 1 : 0;

  const header = `[Script Info]
Title: AutoScale Captions
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryAss},&H000000FF,${outlineAss},${backColorAss},${boldFlag},0,0,0,100,100,0,0,${borderStyle},${outlineWidth},${style.shadow},2,${marginSide},${marginSide},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = pages.map((page) => {
    const start = formatAssTime(page.startSeconds);
    const end = formatAssTime(page.endSeconds);
    let text = page.text.replace(/\n/g, "\\N");

    if (opts.karaoke && style.wordEmphasis && page.words.length > 1) {
      const lineStart = page.startSeconds;
      text = page.words
        .map((w) => {
          const durCs = Math.max(1, Math.round((w.endSeconds - w.startSeconds) * 100));
          // Word-relative offsets (ms) into the *line*, for the \t() transform window.
          const wordStartMs = Math.max(0, Math.round((w.startSeconds - lineStart) * 1000));
          const wordEndMs = Math.max(
            wordStartMs + 1,
            Math.round((w.endSeconds - lineStart) * 1000)
          );
          // Pop up to peak scale over the first third of the word, hold, then settle back
          // to 100% by the word's end so it doesn't bleed into the next word's pop.
          const popPoint = wordStartMs + Math.max(1, Math.round((wordEndMs - wordStartMs) / 3));
          const popTag =
            `\\t(${wordStartMs},${popPoint},\\fscx${style.popScale}\\fscy${style.popScale})` +
            `\\t(${popPoint},${wordEndMs},\\fscx100\\fscy100)`;
          return `{\\k${durCs}${popTag}}${w.text}`;
        })
        .join(" ");
    } else if (opts.karaoke && page.words.length > 1) {
      // Style opts out of scale/bold emphasis but karaoke fill timing is still requested.
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
