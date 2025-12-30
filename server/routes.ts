import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { generateScript } from "./services/gemini";
import { generateImagePromptWithGroq, generateScriptWithGroq } from "./services/groq";
import { generateTTS } from "./services/speechify";
import { generateImageWithSeestream } from "./services/freepik";
import type { generationProgressSchema } from "@shared/schema";
import { renderVideo, generateThumbnail, concatenateVideos, generateChapters } from "./services/ffmpeg";
import { logInfo, logError, getRecentLogs } from "./services/logger";
import { cleanupOldAssets, getStorageStats, startCleanupScheduler } from "./services/cleanup";
import { addToQueue, addScriptToQueue, getQueueStatus } from "./services/queue";
import { generateScriptRequestSchema, resolutionOptions, motionEffects, transitionEffects, type VideoManifest, type Scene } from "@shared/schema";
import { getAppSettings, updateAppSettings, splitScriptIntoScenes } from "./services/settings";
import { z } from "zod";

// Schema for validating settings updates
const customVoiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  voiceId: z.string(),
  provider: z.enum(["speechify", "inworld"]),
});

const settingsUpdateSchema = z.object({
  customVoices: z.array(customVoiceSchema).optional(),
  sceneSettings: z.object({
    targetWords: z.number().min(1).max(200),
    maxWords: z.number().min(1).max(300),
    minDuration: z.number().min(1).max(60),
    maxDuration: z.number().min(1).max(120),
  }).optional(),
  imageStyleSettings: z.object({
    art_style: z.string(),
    composition: z.string(),
    color_style: z.string(),
    fine_details: z.string(),
  }).optional(),
  transitionSettings: z.object({
    defaultTransition: z.string(),
    transitionDuration: z.number().min(0.1).max(2),
  }).optional(),
  scriptProvider: z.enum(["gemini", "groq"]).optional(),
});
import { randomUUID } from "crypto";
import * as path from "path";
import * as fs from "fs";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  setupAuth(app);
  
  const assetsDir = path.join(process.cwd(), "public", "assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  app.get("/api/settings", (req, res) => {
    res.json(getAppSettings());
  });

  app.post("/api/settings", (req, res) => {
    try {
      const result = settingsUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid settings data", 
          details: result.error.issues 
        });
      }
      
      const { customVoices, sceneSettings, imageStyleSettings, transitionSettings, scriptProvider } = result.data;
      updateAppSettings({ customVoices, sceneSettings, imageStyleSettings, transitionSettings, scriptProvider });
      res.json(getAppSettings());
    } catch (error) {
      console.error("Settings update error:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.get("/api/settings/status", async (req, res) => {
    try {
      // Check both process.env and database for keys
      const userId = (req.user as any)?.id;
      const apiKeysData = userId ? await storage.getAllApiKeys(userId) : [];
      
      const hasKey = (provider: string, envVar: string) => {
        return !!process.env[envVar] || apiKeysData.some(k => k.provider === provider && k.isActive === 1);
      };

      res.json({
        gemini: hasKey("gemini", "GEMINI_API_KEY"),
        groq: hasKey("groq", "GROQ_API_KEY"),
        speechify: hasKey("speechify", "SPEECHIFY_API_KEY"),
        freepik: hasKey("seedream", "FREEPIK_API_KEY") || hasKey("freepik", "FREEPIK_API_KEY"),
        wavespeed: hasKey("wavespeed", "WAVESPEED_API_KEY"),
        runpod: hasKey("runpod", "RUNPOD_API_KEY"),
        inworld: hasKey("inworld", "INWORLD_API_KEY"),
      });
    } catch (error) {
      logError("API", "Failed to get API status", error);
      res.status(500).json({ error: "Failed to get API status" });
    }
  });

  app.post("/api/settings/api-keys", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const { gemini, groq, speechify, freepik, wavespeed, runpod, inworld } = req.body;
      
      // Helper to save API key to database (upsert)
      const saveKeyToDb = async (provider: string, apiKey: string | undefined) => {
        if (!apiKey?.trim()) return;
        const existing = await storage.getApiKey(userId, provider);
        if (existing) {
          await storage.updateApiKey(existing.id, { apiKey: apiKey.trim() });
        } else {
          await storage.createApiKey({ provider, apiKey: apiKey.trim(), userId });
        }
      };
      
      // Save to database (persistent storage)
      await Promise.all([
        saveKeyToDb("gemini", gemini),
        saveKeyToDb("groq", groq),
        saveKeyToDb("speechify", speechify),
        saveKeyToDb("seedream", freepik), // Use "seedream" as canonical name, aliased with "freepik"
        saveKeyToDb("wavespeed", wavespeed),
        saveKeyToDb("runpod", runpod),
        saveKeyToDb("inworld", inworld),
      ]);
      
      // Also set in process.env for immediate use (runtime only)
      if (gemini?.trim()) process.env.GEMINI_API_KEY = gemini.trim();
      if (groq?.trim()) process.env.GROQ_API_KEY = groq.trim();
      if (speechify?.trim()) process.env.SPEECHIFY_API_KEY = speechify.trim();
      if (freepik?.trim()) process.env.FREEPIK_API_KEY = freepik.trim();
      if (wavespeed?.trim()) process.env.WAVESPEED_API_KEY = wavespeed.trim();
      if (runpod?.trim()) process.env.RUNPOD_API_KEY = runpod.trim();
      if (inworld?.trim()) process.env.INWORLD_API_KEY = inworld.trim();
      
      logInfo("API", "API keys saved to database", {
        userId,
        gemini: !!gemini?.trim(),
        groq: !!groq?.trim(),
        speechify: !!speechify?.trim(),
        freepik: !!freepik?.trim(),
        wavespeed: !!wavespeed?.trim(),
        runpod: !!runpod?.trim(),
        inworld: !!inworld?.trim(),
      });

      // Get updated status
      const apiKeysData = await storage.getAllApiKeys(userId);
      const hasKey = (provider: string, envVar: string) => {
        return !!process.env[envVar] || apiKeysData.some(k => k.provider === provider && k.isActive === 1);
      };

      res.json({
        success: true,
        status: {
          gemini: hasKey("gemini", "GEMINI_API_KEY"),
          groq: hasKey("groq", "GROQ_API_KEY"),
          speechify: hasKey("speechify", "SPEECHIFY_API_KEY"),
          freepik: hasKey("seedream", "FREEPIK_API_KEY"),
          wavespeed: hasKey("wavespeed", "WAVESPEED_API_KEY"),
          runpod: hasKey("runpod", "RUNPOD_API_KEY"),
          inworld: hasKey("inworld", "INWORLD_API_KEY"),
        },
      });
    } catch (error) {
      logError("API", "Failed to update API keys", error);
      res.status(500).json({ error: "Failed to update API keys" });
    }
  });

  app.post("/api/projects/import", async (req, res) => {
    try {
      const { folderPath, title } = req.body;
      
      if (!folderPath) {
        return res.status(400).json({ error: "Folder path is required" });
      }

      const sanitizedPath = path.basename(folderPath);
      if (sanitizedPath !== folderPath || folderPath.includes("..") || folderPath.includes("/") || folderPath.includes("\\")) {
        return res.status(400).json({ error: "Invalid folder path - only folder names within assets are allowed" });
      }

      const fullPath = path.join(assetsDir, sanitizedPath);
      const resolvedPath = path.resolve(fullPath);
      const resolvedAssetsDir = path.resolve(assetsDir);
      
      if (!resolvedPath.startsWith(resolvedAssetsDir)) {
        return res.status(400).json({ error: "Invalid folder path" });
      }
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "Folder not found" });
      }

      const manifestPath = path.join(fullPath, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return res.status(400).json({ error: "No manifest.json found in folder" });
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as VideoManifest;
      
      const folderId = path.basename(fullPath);
      
      const videoFiles = fs.readdirSync(fullPath).filter(f => f.endsWith(".mp4"));
      const outputPath = videoFiles.length > 0 ? `/assets/${folderId}/${videoFiles[0]}` : null;
      
      const thumbnailFiles = fs.readdirSync(fullPath).filter(f => 
        f.includes("thumbnail") && (f.endsWith(".jpg") || f.endsWith(".png"))
      );
      const thumbnailPath = thumbnailFiles.length > 0 ? `/assets/${folderId}/${thumbnailFiles[0]}` : null;

      const scriptText = manifest.scenes?.map(s => s.text).join("\n\n") || "";

      const project = await storage.createVideoProject({
        title: title || `Imported: ${folderId.slice(0, 8)}`,
        script: scriptText,
        status: outputPath ? "ready" : "draft",
        voiceId: null,
        imageStyle: null,
        manifest: manifest as any,
        outputPath,
        thumbnailPath,
      });

      logInfo("API", `Project imported: ${project.id}`, { folderId, sceneCount: manifest.scenes?.length });

      res.json({
        success: true,
        project,
      });
    } catch (error) {
      logError("API", "Failed to import project", error);
      res.status(500).json({ error: "Failed to import project" });
    }
  });

  app.get("/api/voices", async (req, res) => {
    const { inworldDefaultVoices } = await import("./services/inworld-tts");
    
    const speechifyVoices = [
      { id: "george", name: "George", voiceId: "george", gender: "male", accent: "American" },
      { id: "maisie", name: "Maisie", voiceId: "maisie", gender: "female", accent: "British" },
      { id: "henry", name: "Henry", voiceId: "henry", gender: "male", accent: "British" },
      { id: "carly", name: "Carly", voiceId: "carly", gender: "female", accent: "British" },
      { id: "oliver", name: "Oliver", voiceId: "oliver", gender: "male", accent: "Australian" },
      { id: "simone", name: "Simone", voiceId: "simone", gender: "female", accent: "Australian" },
    ];
    
    const inworldVoices = inworldDefaultVoices.map(v => ({
      id: v.id,
      name: v.name,
      voiceId: v.id,
      gender: v.gender,
      accent: "Standard",
    }));
    
    res.json({
      defaultVoices: speechifyVoices,
      inworldVoices,
      customVoices: getAppSettings().customVoices,
    });
  });

  app.post("/api/tts-preview", async (req, res) => {
    try {
      const { voiceId, ttsProvider } = req.body;
      if (!voiceId) {
        return res.status(400).json({ error: "Voice ID is required" });
      }

      let resolvedVoiceId = voiceId;
      const customVoice = getAppSettings().customVoices.find(
        v => v.id === voiceId || v.name.toLowerCase() === (voiceId || "").toLowerCase() || v.voiceId === voiceId
      );
      if (customVoice) {
        resolvedVoiceId = customVoice.voiceId;
      }

      const previewText = "Hello! This is a sample of my voice. I hope you enjoy listening to me narrate your videos.";
      const previewId = `preview-${Date.now()}`;
      const previewDir = path.join(assetsDir, "previews");
      
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
      }

      const audioPath = path.join(previewDir, `${previewId}.mp3`);
      let ttsResult;
      
      if (ttsProvider === "inworld") {
        const { generateInworldTTS } = await import("./services/inworld-tts");
        ttsResult = await generateInworldTTS({
          text: previewText,
          voiceId: resolvedVoiceId,
          outputPath: audioPath,
        });
      } else {
        ttsResult = await generateTTS({
          text: previewText,
          voiceId: resolvedVoiceId,
          outputPath: audioPath,
        });
      }

      if (!ttsResult.success) {
        const provider = ttsProvider === "inworld" ? "Inworld" : "Speechify";
        return res.status(500).json({ error: `Failed to generate voice preview. Make sure your ${provider} API key is configured.` });
      }

      res.json({
        audioUrl: `/assets/previews/${previewId}.mp3`,
        duration: ttsResult.durationSeconds,
      });
    } catch (error) {
      console.error("Voice preview error:", error);
      res.status(500).json({ error: "Failed to generate voice preview" });
    }
  });

  app.post("/api/generate-script", async (req, res) => {
    try {
      const parsed = generateScriptRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const userId = (req.user as any)?.id;
      const settings = getAppSettings();
      const primaryProvider = settings.scriptProvider || "gemini";
      const fallbackProvider = primaryProvider === "gemini" ? "groq" : "gemini";
      
      let result;
      let usedProvider = primaryProvider;
      
      try {
        if (primaryProvider === "groq") {
          result = await generateScriptWithGroq({ ...parsed.data, userId });
        } else {
          result = await generateScript({ ...parsed.data, userId });
        }
      } catch (primaryError: any) {
        console.log(`Primary provider (${primaryProvider}) failed, trying fallback (${fallbackProvider})...`);
        
        try {
          if (fallbackProvider === "groq") {
            result = await generateScriptWithGroq({ ...parsed.data, userId });
          } else {
            result = await generateScript({ ...parsed.data, userId });
          }
          usedProvider = fallbackProvider;
        } catch (fallbackError: any) {
          console.error("Both providers failed:", { primary: primaryError.message, fallback: fallbackError.message });
          const message = primaryError.message?.includes("API key not configured") 
            ? `${primaryProvider === "gemini" ? "Gemini" : "Groq"} API key not configured. Please add it in Settings or configure ${fallbackProvider === "gemini" ? "Gemini" : "Groq"} as a fallback.`
            : "Failed to generate script. Please check your API keys in Settings.";
          return res.status(500).json({ error: message });
        }
      }
      
      res.json({
        title: result.title,
        script: result.script,
        scenes: result.scenes,
        provider: usedProvider,
      });
    } catch (error: any) {
      console.error("Script generation error:", error);
      const message = error.message?.includes("API key not configured") 
        ? error.message 
        : "Failed to generate script";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/generate-assets", async (req, res) => {
    try {
      const { script, voiceId, imageStyle, resolution, motionEffect, imageGenerator = "seedream", ttsProvider = "speechify", sceneSettings } = req.body;

      if (!script || typeof script !== "string") {
        return res.status(400).json({ error: "Script is required" });
      }

      // Use per-project scene settings if provided, otherwise fall back to global settings
      const effectiveSceneSettings = sceneSettings && typeof sceneSettings === 'object' 
        ? {
            ...getAppSettings().sceneSettings,
            targetWords: sceneSettings.targetWords || getAppSettings().sceneSettings.targetWords,
            maxWords: sceneSettings.maxWords || getAppSettings().sceneSettings.maxWords,
          }
        : getAppSettings().sceneSettings;

      const scenes = splitScriptIntoScenes(script, effectiveSceneSettings);
      if (scenes.length === 0) {
        return res.status(400).json({ error: "No valid scenes found in script" });
      }
      logInfo("ASSETS", `Script split into ${scenes.length} scenes`, { 
        targetWords: effectiveSceneSettings.targetWords, 
        maxWords: effectiveSceneSettings.maxWords 
      });

      // Resolve voice ID - check if it matches a custom voice from settings
      let resolvedVoiceId = voiceId || (ttsProvider === "inworld" ? "Dennis" : "george");
      const customVoice = getAppSettings().customVoices.find(
        v => v.id === voiceId || v.name.toLowerCase() === (voiceId || "").toLowerCase() || v.voiceId === voiceId
      );
      if (customVoice) {
        resolvedVoiceId = customVoice.voiceId;
        logInfo("ASSETS", `Using custom voice: ${customVoice.name}`, { voiceId: customVoice.voiceId, ttsProvider });
      } else {
        logInfo("ASSETS", `Using voice: ${resolvedVoiceId}`, { ttsProvider });
      }

      const resConfig = resolutionOptions.find(r => r.id === resolution) || resolutionOptions[0];
      // Use the selected resolution's dimensions - calculate image size based on aspect ratio
      let imageWidth: number;
      let imageHeight: number;
      
      // Calculate proper dimensions for each aspect ratio (capped at reasonable image gen limits)
      const aspectRatio = resConfig.width / resConfig.height;
      if (aspectRatio > 1) {
        // Landscape (16:9 or similar)
        imageWidth = 1024;
        imageHeight = Math.round(1024 / aspectRatio);
      } else if (aspectRatio < 1) {
        // Portrait/Vertical (9:16 or similar)
        imageHeight = 1024;
        imageWidth = Math.round(1024 * aspectRatio);
      } else {
        // Square (1:1)
        imageWidth = 1024;
        imageHeight = 1024;
      }
      
      logInfo("ASSETS", `Using resolution: ${resConfig.id}`, { imageWidth, imageHeight, aspectRatio: aspectRatio.toFixed(2) });
      
      const projectId = randomUUID();
      const projectDir = path.join(assetsDir, projectId);
      
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const generatedScenes: Scene[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const sceneText = scenes[i].trim();
        const sceneId = `scene-${i + 1}`;

        const audioPath = path.join(projectDir, `${sceneId}.mp3`);
        let ttsResult;
        
        if (ttsProvider === "inworld") {
          const { generateInworldTTS } = await import("./services/inworld-tts");
          ttsResult = await generateInworldTTS({
            text: sceneText,
            voiceId: resolvedVoiceId,
            outputPath: audioPath,
          });
        } else {
          ttsResult = await generateTTS({
            text: sceneText,
            voiceId: resolvedVoiceId,
            outputPath: audioPath,
          });
        }

        const imagePrompt = await generateImagePromptWithGroq({
          sceneText,
          imageStyle: imageStyle || "historical",
          customStyle: getAppSettings().imageStyleSettings,
        });
        logInfo("ASSETS", `Scene ${i + 1} image prompt generated with ${imageGenerator}`, { promptPreview: imagePrompt.slice(0, 100) });
        
        const imagePath = path.join(projectDir, `${sceneId}.png`);
        
        // Use selected image generator
        let imageResult: any;
        const userId = (req.user as any)?.id;
        
        // Import centralized API key resolver
        const { getResolvedApiKey } = await import("./services/api-keys");
        
        if (imageGenerator === "wavespeed" || imageGenerator === "runpod") {
          const { generateImageWithWaveSpeed, generateImageWithRunPod } = await import("./services/image-generators");
          try {
            const apiKey = await getResolvedApiKey(imageGenerator, userId);
            
            if (!apiKey) {
              throw new Error(`${imageGenerator} API key not configured. Please add your API key in Settings.`);
            }
            
            const imageUrl = imageGenerator === "wavespeed"
              ? await generateImageWithWaveSpeed(imagePrompt, apiKey, imageWidth, imageHeight)
              : await generateImageWithRunPod(imagePrompt, apiKey, imageWidth, imageHeight);
            
            // Download the image to local path
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
               throw new Error(`Failed to download image from ${imageUrl}: ${imageResponse.statusText}`);
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            fs.writeFileSync(imagePath, imageBuffer);
            
            imageResult = { success: true };
          } catch (error: any) {
            logError("ASSETS", `${imageGenerator} generation error`, error);
            imageResult = { success: false, error: String(error.message || error) };
            throw new Error(`Failed to generate image for scene ${i + 1}: ${error.message || error}`);
          }
        } else {
          // Default to Seedream/Freepik
          const apiKey = await getResolvedApiKey("seedream", userId);

          imageResult = await generateImageWithSeestream({
            prompt: imagePrompt,
            outputPath: imagePath,
            width: imageWidth,
            height: imageHeight,
            style: imageStyle || "historical",
            apiKey: apiKey || undefined
          });
          
          if (!imageResult.success) {
            throw new Error(`Failed to generate image for scene ${i + 1}: ${imageResult.error}`);
          }
        }

        const motionOptions = motionEffects;
        const selectedMotion = motionEffect || motionOptions[i % motionOptions.length];

        generatedScenes.push({
          id: sceneId,
          text: sceneText,
          audioFile: ttsResult.audioPath ? `/assets/${projectId}/${sceneId}.mp3` : undefined,
          imageFile: imageResult.success ? `/assets/${projectId}/${sceneId}.png` : undefined,
          durationInSeconds: ttsResult.durationSeconds,
          motion: selectedMotion as any,
          transition: getAppSettings().transitionSettings.defaultTransition as any,
        });
      }

      const manifest: VideoManifest = {
        fps: 30,
        width: resConfig.width,
        height: resConfig.height,
        scenes: generatedScenes,
        transitionDuration: getAppSettings().transitionSettings.transitionDuration,
      };

      const manifestPath = path.join(projectDir, "manifest.json");
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const project = await storage.createVideoProject({
        title: `Video ${projectId.slice(0, 8)}`,
        script,
        status: "ready",
        voiceId,
        imageStyle,
        manifest: manifest as any,
        outputPath: null,
      });

      await storage.updateVideoProject(project.id, {
        manifest: manifest as any,
      });

      res.json({
        projectId: project.id,
        manifest,
        assetsGenerated: {
          audio: generatedScenes.filter(s => s.audioFile).length,
          images: generatedScenes.filter(s => s.imageFile).length,
          total: generatedScenes.length,
        },
      });
    } catch (error) {
      logError("ASSETS", "Asset generation failed", error);
      res.status(500).json({ error: "Failed to generate assets" });
    }
  });

  app.post("/api/render-video", async (req, res) => {
    try {
      const { manifest, projectId } = req.body;

      if (!manifest || !manifest.scenes) {
        return res.status(400).json({ error: "Valid manifest is required" });
      }

      const outputId = projectId || randomUUID().slice(0, 8);
      const outputFilename = `video-${outputId}.mp4`;
      const outputPath = `/assets/${outputId}/${outputFilename}`;
      
      const outputDir = path.join(assetsDir, outputId);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (projectId) {
        await storage.updateVideoProject(projectId, {
          status: "generating",
        });
      }

      logInfo("RENDER", "Starting video render with FFmpeg", { projectId: outputId, outputPath });
      const renderResult = await renderVideo({
        manifest,
        outputPath,
        projectDir: outputDir,
      });

      if (!renderResult.success) {
        logError("RENDER", "Video rendering failed", new Error(renderResult.error || "Unknown error"), { projectId: outputId });
        if (projectId) {
          await storage.updateVideoProject(projectId, {
            status: "error",
          });
        }
        return res.status(500).json({ 
          error: "Video rendering failed", 
          details: renderResult.error 
        });
      }

      if (projectId) {
        await storage.updateVideoProject(projectId, {
          outputPath,
          status: "ready",
        });
      }

      res.json({
        success: true,
        outputUrl: outputPath,
        projectId: outputId,
        manifest,
        message: "Video rendered successfully with FFmpeg.",
      });
      logInfo("RENDER", "Video rendered successfully", { projectId: outputId, outputPath });
    } catch (error) {
      logError("RENDER", "Render endpoint error", error);
      res.status(500).json({ error: "Failed to render video" });
    }
  });

  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllVideoProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getVideoProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVideoProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const { title, script, voiceId, imageStyle, status, manifest } = req.body;
      const project = await storage.getVideoProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const updated = await storage.updateVideoProject(req.params.id, {
        ...(title !== undefined && { title }),
        ...(script !== undefined && { script }),
        ...(voiceId !== undefined && { voiceId }),
        ...(imageStyle !== undefined && { imageStyle }),
        ...(status !== undefined && { status }),
        ...(manifest !== undefined && { manifest }),
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.get("/api/logs", (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = getRecentLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/storage/stats", (req, res) => {
    try {
      const stats = getStorageStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching storage stats:", error);
      res.status(500).json({ error: "Failed to fetch storage stats" });
    }
  });

  app.get("/api/usage/stats", async (req, res) => {
    try {
      const stats = await storage.getUsageStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ error: "Failed to fetch usage stats" });
    }
  });

  app.post("/api/storage/cleanup", async (req, res) => {
    try {
      logInfo("API", "Manual cleanup triggered");
      const result = await cleanupOldAssets();
      res.json(result);
    } catch (error) {
      logError("API", "Manual cleanup failed", error);
      res.status(500).json({ error: "Failed to run cleanup" });
    }
  });

  app.delete("/api/database/clear", async (req, res) => {
    try {
      logInfo("API", "Database clear requested");
      
      const assetsDir = path.join(process.cwd(), "public", "assets");
      let filesDeleted = 0;
      
      if (fs.existsSync(assetsDir)) {
        const deleteRecursive = (dir: string) => {
          if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach((file) => {
              const curPath = path.join(dir, file);
              if (fs.lstatSync(curPath).isDirectory()) {
                deleteRecursive(curPath);
              } else {
                fs.unlinkSync(curPath);
                filesDeleted++;
              }
            });
            if (dir !== assetsDir) {
              fs.rmdirSync(dir);
            }
          }
        };
        deleteRecursive(assetsDir);
      }
      
      const dbResult = await storage.clearAllData();
      
      logInfo("API", `Database cleared: ${dbResult.projectsDeleted} projects, ${dbResult.analyticsDeleted} analytics, ${filesDeleted} files`);
      
      res.json({
        success: true,
        projectsDeleted: dbResult.projectsDeleted,
        analyticsDeleted: dbResult.analyticsDeleted,
        filesDeleted,
      });
    } catch (error) {
      logError("API", "Database clear failed", error);
      res.status(500).json({ error: "Failed to clear database" });
    }
  });

  app.post("/api/queue/add", async (req, res) => {
    try {
      const { topic, style, duration, voiceId, imageStyle, resolution, transition, imageGenerator, ttsProvider } = req.body;
      
      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      const projectId = await addToQueue({
        topic,
        style: style || "documentary",
        duration: duration || "medium",
        voiceId: voiceId || "george",
        imageStyle: imageStyle || "cinematic",
        resolution: resolution || "1080p",
        transition: transition || getAppSettings().transitionSettings.defaultTransition,
        imageGenerator: imageGenerator || "seedream",
        ttsProvider: ttsProvider || "speechify",
      });

      res.json({ projectId, message: "Project added to queue" });
    } catch (error) {
      logError("API", "Failed to add project to queue", error);
      res.status(500).json({ error: "Failed to add project to queue" });
    }
  });

  app.post("/api/generate-background", async (req, res) => {
    try {
      const { script, title, voiceId, imageStyle, resolution, transition, imageGenerator, ttsProvider } = req.body;
      
      if (!script || typeof script !== "string" || script.trim().length === 0) {
        return res.status(400).json({ error: "Script is required" });
      }

      let resolvedVoiceId = voiceId || "george";
      const customVoice = getAppSettings().customVoices.find(
        v => v.id === voiceId || v.name.toLowerCase() === (voiceId || "").toLowerCase() || v.voiceId === voiceId
      );
      if (customVoice) {
        resolvedVoiceId = customVoice.voiceId;
      }

      const projectId = await addScriptToQueue({
        script: script.trim(),
        title: title || `Video ${Date.now().toString(36)}`,
        voiceId: resolvedVoiceId,
        imageStyle: imageStyle || "cinematic",
        resolution: resolution || "1080p",
        transition: transition || getAppSettings().transitionSettings.defaultTransition,
        imageGenerator: imageGenerator || "seedream",
        ttsProvider: ttsProvider || "speechify",
      });

      logInfo("API", `Background generation started: ${projectId}`, { title });
      res.json({ projectId, message: "Video generation started in background" });
    } catch (error) {
      logError("API", "Failed to start background generation", error);
      res.status(500).json({ error: "Failed to start background generation" });
    }
  });

  app.get("/api/queue/status", (req, res) => {
    try {
      const status = getQueueStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get queue status" });
    }
  });

  app.get("/api/transitions", (req, res) => {
    res.json(transitionEffects);
  });

  app.post("/api/projects/:id/thumbnail", async (req, res) => {
    try {
      const project = await storage.getVideoProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.outputPath) {
        return res.status(400).json({ error: "Project has no video to generate thumbnail from" });
      }

      const timestamp = req.body.timestamp || 1;
      const thumbnailPath = `/assets/${req.params.id}/thumbnail.jpg`;
      
      const result = await generateThumbnail(project.outputPath, thumbnailPath, timestamp);
      
      if (result.success) {
        await storage.updateVideoProject(req.params.id, { thumbnailPath });
        res.json({ success: true, thumbnailPath });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      logError("API", "Thumbnail generation failed", error);
      res.status(500).json({ error: "Failed to generate thumbnail" });
    }
  });

  app.post("/api/projects/:id/thumbnail-ai", async (req, res) => {
    try {
      const project = await storage.getVideoProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const { style = "cinematic", customPrompt } = req.body;
      
      const basePrompt = customPrompt || `YouTube video thumbnail for: ${project.title}. ${project.script?.slice(0, 200) || ""}`;
      const thumbnailPrompt = `${basePrompt}, eye-catching thumbnail design, bold vibrant colors, dramatic lighting, high contrast, professional YouTube thumbnail style, 16:9 aspect ratio`;
      
      const thumbnailFilename = `thumbnail-ai-${Date.now()}.png`;
      const thumbnailDir = path.join(assetsDir, req.params.id);
      
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
      }
      
      const thumbnailFilePath = path.join(thumbnailDir, thumbnailFilename);
      
      logInfo("THUMBNAIL", "Generating AI thumbnail", { projectId: req.params.id, style });
      
      const imageResult = await generateImageWithSeestream({
        prompt: thumbnailPrompt,
        outputPath: thumbnailFilePath,
        width: 1280,
        height: 720,
        style: style,
      });
      
      if (imageResult.success) {
        const thumbnailPath = `/assets/${req.params.id}/${thumbnailFilename}`;
        await storage.updateVideoProject(req.params.id, { thumbnailPath });
        logInfo("THUMBNAIL", "AI thumbnail generated", { projectId: req.params.id, path: thumbnailPath });
        res.json({ success: true, thumbnailPath });
      } else {
        res.status(500).json({ error: imageResult.error || "Failed to generate thumbnail" });
      }
    } catch (error) {
      logError("API", "AI thumbnail generation failed", error);
      res.status(500).json({ error: "Failed to generate AI thumbnail" });
    }
  });

  app.post("/api/videos/concatenate", async (req, res) => {
    try {
      const { videoPaths, outputName } = req.body;
      
      if (!videoPaths || !Array.isArray(videoPaths) || videoPaths.length < 2) {
        return res.status(400).json({ error: "At least 2 video paths are required" });
      }

      const outputId = randomUUID().slice(0, 8);
      const outputPath = `/assets/${outputId}/${outputName || "combined.mp4"}`;
      
      const result = await concatenateVideos(videoPaths, outputPath);
      
      if (result.success) {
        res.json({ success: true, outputPath: result.outputPath });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      logError("API", "Video concatenation failed", error);
      res.status(500).json({ error: "Failed to concatenate videos" });
    }
  });

  app.get("/api/projects/:id/chapters", async (req, res) => {
    try {
      const project = await storage.getVideoProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (project.chapters) {
        return res.json(project.chapters);
      }

      const manifest = project.manifest as VideoManifest | null;
      if (!manifest?.scenes) {
        return res.status(400).json({ error: "Project has no manifest" });
      }

      const sceneDurations = manifest.scenes.map(s => s.durationInSeconds || 5);
      const chapters = generateChapters(manifest.scenes, sceneDurations);
      
      await storage.updateVideoProject(req.params.id, { chapters: chapters as any });
      res.json(chapters);
    } catch (error) {
      logError("API", "Chapter generation failed", error);
      res.status(500).json({ error: "Failed to get chapters" });
    }
  });

  // API Keys management endpoints
  app.get("/api/api-keys", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const apiKeys = await storage.getAllApiKeys(req.user.id);
      res.json(apiKeys.map(k => ({
        ...k,
        apiKey: k.apiKey.substring(0, 10) + "..." + k.apiKey.substring(k.apiKey.length - 10)
      })));
    } catch (error) {
      logError("API", "Failed to get API keys", error);
      res.status(500).json({ error: "Failed to get API keys" });
    }
  });

  app.post("/api/api-keys", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { provider, apiKey } = req.body;
      const result = await storage.createApiKey({ provider, apiKey, userId: req.user.id });
      res.json(result);
    } catch (error) {
      logError("API", "Failed to create API key", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  app.delete("/api/api-keys/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      await storage.deleteApiKey(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logError("API", "Failed to delete API key", error);
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });

  // Image generation endpoint
  app.post("/api/generate-image", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { prompt, generator, width, height, seed } = req.body;
      
      // Helper to get API key from database or env
      const getResolvedApiKey = async (provider: string): Promise<string | null> => {
        // Check database first with provider aliases
        const providerAliases: Record<string, string[]> = {
          seedream: ["seedream", "freepik"],
          wavespeed: ["wavespeed"],
          runpod: ["runpod"],
        };
        
        const aliases = providerAliases[provider] || [provider];
        for (const alias of aliases) {
          const dbKey = await storage.getApiKey(req.user!.id, alias);
          if (dbKey?.apiKey) return dbKey.apiKey;
        }
        
        // Fallback to environment variables
        const envKeys: Record<string, string | undefined> = {
          seedream: process.env.FREEPIK_API_KEY,
          wavespeed: process.env.WAVESPEED_API_KEY,
          runpod: process.env.RUNPOD_API_KEY,
        };
        
        return envKeys[provider] || null;
      };

      const apiKey = await getResolvedApiKey(generator);

      if (!apiKey) {
        return res.status(400).json({ error: `No API key configured for ${generator}. Please add your API key in Settings.` });
      }

      let imageUrl: string;

      if (generator === "seedream") {
        // Actually generate with Seedream/Freepik
        const tempPath = `/tmp/gen-${Date.now()}.png`;
        const result = await generateImageWithSeestream({
          prompt,
          outputPath: tempPath,
          width: width || 1024,
          height: height || 576,
          apiKey,
        });
        if (!result.success) {
          throw new Error(result.error || "Seedream generation failed");
        }
        // Read the file and return as base64 data URL
        const imageBuffer = fs.readFileSync(tempPath);
        imageUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        // Clean up temp file
        fs.unlinkSync(tempPath);
      } else if (generator === "wavespeed") {
        const { generateImageWithWaveSpeed } = await import("./services/image-generators");
        imageUrl = await generateImageWithWaveSpeed(prompt, apiKey, width || 1024, height || 576, seed);
      } else if (generator === "runpod") {
        const { generateImageWithRunPod } = await import("./services/image-generators");
        imageUrl = await generateImageWithRunPod(prompt, apiKey, width || 1024, height || 576, seed);
      } else {
        return res.status(400).json({ error: "Unknown generator" });
      }

      await storage.incrementUsage("image", 1);
      res.json({ imageUrl });
    } catch (error) {
      logError("API", "Image generation failed", error);
      res.status(500).json({ error: `Image generation failed: ${error}` });
    }
  });

  startCleanupScheduler(1);
  logInfo("SERVER", "DeepCut AI server started with cleanup scheduler");

  return httpServer;
}
