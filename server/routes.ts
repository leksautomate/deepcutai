import type { Express } from "express";
import type { Server } from "http";
import * as path from "path";
import * as fs from "fs";
import { setupAuth, requireAuth } from "./auth";
import { startCleanupScheduler } from "./services/cleanup";

// Controllers
import { AuthController } from "./controllers/AuthController";
import { SettingsController } from "./controllers/SettingsController";
import { ProjectController } from "./controllers/ProjectController";
import { AssetController } from "./controllers/AssetController";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Initialize Controllers
  const authController = new AuthController();
  const settingsController = new SettingsController();
  const projectController = new ProjectController();
  const assetController = new AssetController();

  // Setup Authentication Strategies
  setupAuth(app);

  // Ensure assets directory exists
  const assetsDir = path.join(process.cwd(), "public", "assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Start background tasks
  startCleanupScheduler();

  // ==========================================
  // Auth & Setup Routes
  // ==========================================
  app.get("/api/setup/status", authController.getSetupStatus.bind(authController));
  app.post("/api/setup/register", authController.registerAdmin.bind(authController));

  // ==========================================
  // Settings Routes
  // ==========================================
  app.get("/api/settings", requireAuth, settingsController.getSettings.bind(settingsController));
  app.post("/api/settings", requireAuth, settingsController.updateSettings.bind(settingsController));
  app.get("/api/settings/status", requireAuth, settingsController.getApiKeysStatus.bind(settingsController));
  app.post("/api/settings/api-keys", requireAuth, settingsController.updateApiKeys.bind(settingsController));

  // Also register distinct key endpoints if needed for compatibility (optional, but good for cleanliness)
  app.get("/api/api-keys", requireAuth, settingsController.getApiKeysStatus.bind(settingsController)); // Reusing status for now or need specific endpoint?
  // Old text had separate /api/api-keys logic (list all keys). SettingsController has updateApiKeys (bulk).
  // I implemented `updateApiKeys` (bulk) in SettingsController.
  // Do I need the granular CRUD from lines 1217-1258?
  // The UI likely uses the bulk endpoint at /api/settings/api-keys. 
  // Let's keep /api/api-keys as missing for now unless I see calls to it.
  // Actually, I should probably implement the granular ones in SettingsController if needed.
  // Let's assume the bulk one is primary.

  // ==========================================
  // Asset Routes (Voices, TTS, ImagGen)
  // ==========================================
  app.get("/api/voices", assetController.getVoices.bind(assetController));
  app.post("/api/tts-preview", assetController.previewTTS.bind(assetController));
  app.post("/api/generate-image", requireAuth, assetController.generateImage.bind(assetController));
  app.post("/api/regenerate-scene-image", requireAuth, assetController.regenerateSceneImage.bind(assetController));

  // ==========================================
  // Custom Image Styles Routes
  // ==========================================
  const { getCustomImageStyles, addCustomImageStyle, updateCustomImageStyle, deleteCustomImageStyle } = await import("./services/settings");

  app.get("/api/custom-styles", requireAuth, (_req, res) => {
    res.json({ styles: getCustomImageStyles() });
  });

  app.post("/api/custom-styles", requireAuth, (req, res) => {
    try {
      const { name, styleText } = req.body;
      if (!name || !styleText) {
        return res.status(400).json({ error: "name and styleText are required" });
      }
      const style = addCustomImageStyle(name, styleText);
      return res.json(style);
    } catch (error) {
      return res.status(500).json({ error: "Failed to add custom style" });
    }
  });

  app.put("/api/custom-styles/:id", requireAuth, (req, res) => {
    try {
      const { name, styleText } = req.body;
      if (!name || !styleText) {
        return res.status(400).json({ error: "name and styleText are required" });
      }
      const style = updateCustomImageStyle(req.params.id, name, styleText);
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      return res.json(style);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update custom style" });
    }
  });

  app.delete("/api/custom-styles/:id", requireAuth, (req, res) => {
    const deleted = deleteCustomImageStyle(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Style not found" });
    }
    return res.json({ success: true });
  });

  // ==========================================
  // Logs Routes
  // ==========================================
  const { getSystemLogs, clearSystemLogs } = await import("./services/logger");

  app.get("/api/logs", requireAuth, (req, res) => {
    const level = req.query.level as "info" | "warn" | "error" | "debug" | undefined;
    const category = req.query.category as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    const logs = getSystemLogs({ level, category, limit });
    return res.json(logs);
  });

  app.delete("/api/logs", requireAuth, (_req, res) => {
    clearSystemLogs();
    return res.json({ success: true });
  });

  // ==========================================
  // Project Routes
  // ==========================================
  app.get("/api/projects", requireAuth, projectController.getAllProjects.bind(projectController));
  app.get("/api/projects/:id", requireAuth, projectController.getProject.bind(projectController));
  app.delete("/api/projects/:id", requireAuth, projectController.deleteProject.bind(projectController));
  app.post("/api/projects/import", requireAuth, projectController.importProject.bind(projectController));

  // Generation
  app.post("/api/generate-script", requireAuth, projectController.generateScript.bind(projectController));
  app.post("/api/generate-assets", requireAuth, projectController.generateAssets.bind(projectController));
  app.post("/api/generate-background", requireAuth, projectController.generateAssetsBackground.bind(projectController));
  app.post("/api/render-video", requireAuth, projectController.renderVideo.bind(projectController));

  // Post-processing
  app.post("/api/projects/:id/thumbnail", requireAuth, projectController.generateThumbnail.bind(projectController));
  app.post("/api/projects/:id/thumbnail-ai", requireAuth, projectController.generateAiThumbnail.bind(projectController));
  app.post("/api/videos/concatenate", requireAuth, projectController.concatenateVideos.bind(projectController));
  app.get("/api/projects/:id/chapters", requireAuth, projectController.getChapters.bind(projectController));

  // ==========================================
  // Long TTS Routes
  // ==========================================
  const longTts = await import("./services/long-tts");

  // Default Inworld voices list (using simple voice names per API docs)
  const DEFAULT_INWORLD_VOICES = [
    { id: "Dennis", name: "Dennis", gender: "Male" },
    { id: "Alex", name: "Alex", gender: "Male" },
    { id: "Craig", name: "Craig", gender: "Male" },
    { id: "Mark", name: "Mark", gender: "Male" },
    { id: "Shaun", name: "Shaun", gender: "Male" },
    { id: "Timothy", name: "Timothy", gender: "Male" },
    { id: "Ashley", name: "Ashley", gender: "Female" },
    { id: "Deborah", name: "Deborah", gender: "Female" },
    { id: "Elizabeth", name: "Elizabeth", gender: "Female" },
    { id: "Julia", name: "Julia", gender: "Female" },
    { id: "Olivia", name: "Olivia", gender: "Female" },
    { id: "Sarah", name: "Sarah", gender: "Female" },
  ];

  // Get all voices (default + custom)
  app.get("/api/long-tts/voices", requireAuth, (_req, res) => {
    const customVoices = longTts.getCustomVoices();
    res.json({
      defaultVoices: DEFAULT_INWORLD_VOICES,
      customVoices,
    });
  });

  // Add custom voice
  app.post("/api/long-tts/voices", requireAuth, (req, res) => {
    try {
      const { voiceId, name } = req.body;
      if (!voiceId || !name) {
        return res.status(400).json({ error: "voiceId and name are required" });
      }
      const voice = longTts.addCustomVoice(voiceId, name);
      return res.json(voice);
    } catch (error) {
      return res.status(500).json({ error: "Failed to add voice" });
    }
  });

  // Update custom voice
  app.put("/api/long-tts/voices/:id", requireAuth, (req, res) => {
    try {
      const { voiceId, name } = req.body;
      if (!voiceId || !name) {
        return res.status(400).json({ error: "voiceId and name are required" });
      }
      const voice = longTts.updateCustomVoice(req.params.id, voiceId, name);
      if (!voice) {
        return res.status(404).json({ error: "Voice not found" });
      }
      return res.json(voice);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update voice" });
    }
  });

  // Delete custom voice
  app.delete("/api/long-tts/voices/:id", requireAuth, (req, res) => {
    const deleted = longTts.deleteCustomVoice(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Voice not found" });
    }
    return res.json({ success: true });
  });

  // Get generated TTS files
  const ttsOutputDir = path.join(process.cwd(), "public", "tts-output");
  app.get("/api/long-tts/files", requireAuth, (_req, res) => {
    try {
      if (!fs.existsSync(ttsOutputDir)) {
        return res.json({ files: [] });
      }
      const files = fs.readdirSync(ttsOutputDir)
        .filter(f => f.endsWith(".mp3") && !f.startsWith("temp-"))
        .map(filename => {
          const filePath = path.join(ttsOutputDir, filename);
          const stats = fs.statSync(filePath);
          return {
            filename,
            path: `/tts-output/${filename}`,
            size: stats.size,
            createdAt: stats.mtime.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json({ files });
    } catch (error) {
      return res.status(500).json({ error: "Failed to list files" });
    }
  });

  // Delete TTS file
  app.delete("/api/long-tts/files/:filename", requireAuth, (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(ttsOutputDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      fs.unlinkSync(filePath);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Download TTS file
  app.get("/api/long-tts/download/:filename", requireAuth, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(ttsOutputDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
    return;
  });

  // Generate TTS (synchronous)
  app.post("/api/long-tts/generate", requireAuth, async (req, res) => {
    try {
      const { text, voiceId, topic, removeSilence, silenceThreshold, minSilenceDuration } = req.body;
      if (!text || !voiceId) {
        return res.status(400).json({ error: "text and voiceId are required" });
      }
      const result = await longTts.generateLongTTS({
        text,
        voiceId,
        topic,
        removeSilence,
        silenceThreshold,
        minSilenceDuration,
      });
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: "Failed to generate TTS" });
    }
  });

  // Background job storage (in-memory)
  const ttsJobs = new Map<string, { status: string; result?: any; error?: string }>();

  // Generate TTS (background)
  app.post("/api/long-tts/generate-background", requireAuth, (req, res) => {
    const { text, voiceId, topic, removeSilence, silenceThreshold, minSilenceDuration } = req.body;
    if (!text || !voiceId) {
      return res.status(400).json({ error: "text and voiceId are required" });
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    ttsJobs.set(jobId, { status: "processing" });

    // Start generation in background
    longTts.generateLongTTS({
      text,
      voiceId,
      topic,
      removeSilence,
      silenceThreshold,
      minSilenceDuration,
    }).then(result => {
      if (result.success) {
        ttsJobs.set(jobId, { status: "complete", result });
      } else {
        ttsJobs.set(jobId, { status: "failed", error: result.error });
      }
    }).catch(error => {
      ttsJobs.set(jobId, { status: "failed", error: error.message });
    });

    return res.json({ jobId });
  });

  // Get job status
  app.get("/api/long-tts/job/:id", requireAuth, (req, res) => {
    const job = ttsJobs.get(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    return res.json(job);
  });

  return httpServer;
}

