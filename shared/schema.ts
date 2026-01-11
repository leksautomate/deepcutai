import { pgTable, text, varchar, integer, jsonb, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Motion effect types for Ken Burns
export const motionEffects = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"] as const;
export type MotionEffect = typeof motionEffects[number];

// Scene transition types
export const transitionEffects = ["none", "fade", "dissolve", "wipe-left", "wipe-right", "wipe-up", "wipe-down"] as const;
export type TransitionEffect = typeof transitionEffects[number];

// Video status
export const videoStatuses = ["draft", "generating", "ready", "error"] as const;
export type VideoStatus = typeof videoStatuses[number];

// Scene schema for manifest
export const sceneSchema = z.object({
  id: z.string(),
  text: z.string(),
  audioFile: z.string().optional(),
  imageFile: z.string().optional(),
  durationInSeconds: z.number(),
  motion: z.enum(motionEffects).optional(),
  transition: z.enum(transitionEffects).optional(),
});

export type Scene = z.infer<typeof sceneSchema>;

// Video manifest schema
export const videoManifestSchema = z.object({
  fps: z.number().default(30),
  width: z.number().default(1920),
  height: z.number().default(1080),
  scenes: z.array(sceneSchema),
  transitionDuration: z.number().default(0.5),
});

export type VideoManifest = z.infer<typeof videoManifestSchema>;

// Chapter schema for video chapters
export const chapterSchema = z.object({
  title: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
});

export type Chapter = z.infer<typeof chapterSchema>;

// Video project table
export const videoProjects = pgTable("video_projects", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  script: text("script").notNull(),
  status: text("status").notNull().default("draft"),
  voiceId: text("voice_id"),
  imageStyle: text("image_style"),
  imageGenerator: text("image_generator").default("seedream"),
  manifest: jsonb("manifest"),
  outputPath: text("output_path"),
  thumbnailPath: text("thumbnail_path"),
  chapters: jsonb("chapters"),
  progress: integer("progress").default(0),
  progressMessage: text("progress_message"),
  errorMessage: text("error_message"),
  totalDuration: real("total_duration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVideoProjectSchema = createInsertSchema(videoProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVideoProject = z.infer<typeof insertVideoProjectSchema>;
export type VideoProject = typeof videoProjects.$inferSelect;

// TTS provider types
export const ttsProviders = ["speechify", "inworld"] as const;
export type TTSProvider = typeof ttsProviders[number];

// Voice options for Speechify TTS
export const voiceOptions = [
  { id: "george", name: "George", gender: "male", accent: "American", provider: "speechify" as TTSProvider },
  { id: "maisie", name: "Maisie", gender: "female", accent: "American", provider: "speechify" as TTSProvider },
  { id: "henry", name: "Henry", gender: "male", accent: "British", provider: "speechify" as TTSProvider },
  { id: "carly", name: "Carly", gender: "female", accent: "British", provider: "speechify" as TTSProvider },
  { id: "oliver", name: "Oliver", gender: "male", accent: "Australian", provider: "speechify" as TTSProvider },
  { id: "simone", name: "Simone", gender: "female", accent: "Australian", provider: "speechify" as TTSProvider },
] as const;

// Voice options for Inworld TTS
export const inworldVoiceOptions = [
  { id: "Dennis", name: "Dennis", gender: "male", provider: "inworld" as TTSProvider },
  { id: "Alex", name: "Alex", gender: "male", provider: "inworld" as TTSProvider },
  { id: "Craig", name: "Craig", gender: "male", provider: "inworld" as TTSProvider },
  { id: "Mark", name: "Mark", gender: "male", provider: "inworld" as TTSProvider },
  { id: "Shaun", name: "Shaun", gender: "male", provider: "inworld" as TTSProvider },
  { id: "Timothy", name: "Timothy", gender: "male", provider: "inworld" as TTSProvider },
  { id: "Ashley", name: "Ashley", gender: "female", provider: "inworld" as TTSProvider },
  { id: "Deborah", name: "Deborah", gender: "female", provider: "inworld" as TTSProvider },
  { id: "Elizabeth", name: "Elizabeth", gender: "female", provider: "inworld" as TTSProvider },
  { id: "Julia", name: "Julia", gender: "female", provider: "inworld" as TTSProvider },
  { id: "Olivia", name: "Olivia", gender: "female", provider: "inworld" as TTSProvider },
  { id: "Sarah", name: "Sarah", gender: "female", provider: "inworld" as TTSProvider },
] as const;

export type VoiceOption = typeof voiceOptions[number];
export type InworldVoiceOption = typeof inworldVoiceOptions[number];

// Image style options
export const imageStyles = [
  { id: "cinematic", name: "Cinematic", description: "High-quality cinematic visuals" },
  { id: "anime", name: "Anime", description: "Japanese animation style" },
  { id: "realistic", name: "Realistic", description: "Photorealistic imagery" },
  { id: "illustration", name: "Illustration", description: "Digital illustration style" },
  { id: "abstract", name: "Abstract", description: "Abstract artistic visuals" },
  { id: "custom", name: "Custom Style", description: "Paste your own style description" },
] as const;

export type ImageStyle = typeof imageStyles[number];

// Video resolution options
export const resolutionOptions = [
  { id: "1080p", width: 1920, height: 1080, label: "1080p (Full HD)" },
  { id: "720p", width: 1280, height: 720, label: "720p (HD)" },
  { id: "4k", width: 3840, height: 2160, label: "4K (Ultra HD)" },
  { id: "vertical", width: 1080, height: 1920, label: "Vertical (9:16)" },
  { id: "square", width: 1080, height: 1080, label: "Square (1:1)" },
] as const;

export type ResolutionOption = typeof resolutionOptions[number];

// Image generator types
export const imageGenerators = ["seedream", "wavespeed", "runpod", "pollinations"] as const;
export type ImageGenerator = typeof imageGenerators[number];

// Pollinations model options (Grand Image All-in-One)
export const pollinationsModels = ["flux", "zimage", "turbo", "gptimage", "gptimage-large", "kontext", "seedream", "seedream-pro", "nanobanana", "nanobanana-pro"] as const;
export type PollinationsModel = typeof pollinationsModels[number];

// API Keys table
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  provider: text("provider").notNull(),
  apiKey: text("api_key").notNull(),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// Script duration options
export const scriptDurations = ["30s", "1min", "2min", "10min"] as const;
export type ScriptDuration = typeof scriptDurations[number];

// API request/response types
export const generateScriptRequestSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  style: z.enum(["educational", "entertaining", "documentary", "storytelling"]).optional(),
  duration: z.enum(["30s", "1min", "2min", "10min"]).optional(),
});

export type GenerateScriptRequest = z.infer<typeof generateScriptRequestSchema>;

export const generateAssetsRequestSchema = z.object({
  projectId: z.string(),
  voiceId: z.string(),
  imageStyle: z.string(),
  resolution: z.string().optional(),
});

export type GenerateAssetsRequest = z.infer<typeof generateAssetsRequestSchema>;

export const renderVideoRequestSchema = z.object({
  projectId: z.string(),
});

export type RenderVideoRequest = z.infer<typeof renderVideoRequestSchema>;

// Image generation request schema
export const generateImageRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  generator: z.enum(imageGenerators),
  width: z.number().min(256).max(1536).default(1024),
  height: z.number().min(256).max(1536).default(576),
  seed: z.number().int().default(-1),
});

export type GenerateImageRequest = z.infer<typeof generateImageRequestSchema>;

// Generation progress tracking
export const generationSteps = ["script", "audio", "images", "manifest", "rendering"] as const;
export type GenerationStep = typeof generationSteps[number];

export const generationProgressSchema = z.object({
  currentStep: z.enum(generationSteps),
  progress: z.number().min(0).max(100),
  message: z.string(),
  error: z.string().optional(),
});

export type GenerationProgress = z.infer<typeof generationProgressSchema>;

// Keep user schema for compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Usage analytics schema
export const usageAnalytics = pgTable("usage_analytics", {
  id: varchar("id").primaryKey(),
  date: text("date").notNull(),
  videosCreated: integer("videos_created").default(0),
  videosRendered: integer("videos_rendered").default(0),
  scriptsGenerated: integer("scripts_generated").default(0),
  imagesGenerated: integer("images_generated").default(0),
  audioGenerated: integer("audio_generated").default(0),
  totalDurationSeconds: real("total_duration_seconds").default(0),
});

export const insertUsageAnalyticsSchema = createInsertSchema(usageAnalytics).omit({
  id: true,
});

export type InsertUsageAnalytics = z.infer<typeof insertUsageAnalyticsSchema>;
export type UsageAnalytics = typeof usageAnalytics.$inferSelect;

// Aggregated usage stats type for frontend
export const usageStatsSchema = z.object({
  totalVideos: z.number(),
  totalRendered: z.number(),
  totalScriptsGenerated: z.number(),
  totalImagesGenerated: z.number(),
  totalAudioGenerated: z.number(),
  totalDurationMinutes: z.number(),
  todayVideos: z.number(),
  todayRendered: z.number(),
});

export type UsageStats = z.infer<typeof usageStatsSchema>;
