import "server-only";

export interface SubtitleCue {
  index: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * Build SRT subtitles from storyboard scene voiceover lines.
 */
export function buildSrtFromScenes(
  scenes: Array<{ voiceover_line: string | null; on_screen_text: string | null; duration_seconds: number }>
): string {
  let cursor = 0;
  const cues: SubtitleCue[] = [];
  scenes.forEach((scene, i) => {
    const text = (scene.on_screen_text || scene.voiceover_line || "").trim();
    if (!text) {
      cursor += Number(scene.duration_seconds);
      return;
    }
    const duration = Math.max(0.5, Number(scene.duration_seconds));
    cues.push({
      index: i + 1,
      startSeconds: cursor,
      endSeconds: cursor + duration,
      text,
    });
    cursor += duration;
  });

  return cues
    .map(
      (c) =>
        `${c.index}\n${formatSrtTime(c.startSeconds)} --> ${formatSrtTime(c.endSeconds)}\n${c.text}\n`
    )
    .join("\n");
}
