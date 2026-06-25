import { z } from "zod";

export const ReviseHookSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  videoId: z.string().uuid(),
  conceptId: z.string().uuid(),
  newHook: z.string().min(3).max(180),
});

export const ReviseSceneTextSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  sceneId: z.string().uuid(),
  voiceoverText: z.string().max(500).optional(),
  overlayText: z.string().max(200).optional(),
  subtitleText: z.string().max(500).optional(),
});

export const RegenerateVideoSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  videoId: z.string().uuid(),
  conceptId: z.string().uuid(),
});

export const RegenerateSceneSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  videoId: z.string().uuid(),
  conceptId: z.string().uuid(),
  sceneId: z.string().uuid(),
});

export const ReviseCaptionSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  videoId: z.string().uuid(),
  captionId: z.string().uuid(),
  caption: z.string().min(1).max(2200),
});

export type ReviseHookInput = z.infer<typeof ReviseHookSchema>;
export type ReviseSceneTextInput = z.infer<typeof ReviseSceneTextSchema>;
