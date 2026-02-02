import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { BaseController } from './BaseController';
import { storage } from '../storage';
import { logError, logInfo } from '../services/logger';
import { generateScript } from '../services/gemini';
import { generateScriptWithGroq } from '../services/groq';
import { getAppSettings } from '../services/settings';
import { splitScriptIntoScenes } from '../services/settings';
import { generateTTS } from '../services/speechify';
import { generateImagePromptWithGroq } from '../services/groq';
import { generateImageWithSeestream } from '../services/freepik';
import { renderVideo, generateThumbnail, concatenateVideos, generateChapters } from '../services/ffmpeg';
import { getResolvedApiKey } from '../services/api-keys';
import {
    generateScriptRequestSchema,
    resolutionOptions,
    motionEffects,
    type VideoManifest,
    type Scene
} from '@shared/schema';

// Helper for assets directory
const ASSETS_DIR = path.join(process.cwd(), "public", "assets");

// Helper to generate title from script if not provided
function generateTitleFromScript(script: string, maxLength: number = 50): string {
    const words = script.trim().split(/\s+/).slice(0, 8).join(' ');
    const sanitized = words.replace(/[^\w\s-]/g, '').trim();
    return sanitized.length > maxLength ? sanitized.slice(0, maxLength).trim() : sanitized;
}

// Validation schemas (migrated from routes.ts)
const generateAssetsSchema = z.object({
    script: z.string().min(1, "Script is required").max(100000),
    title: z.string().optional(),
    topic: z.string().optional(),
    voiceId: z.string().optional(),
    imageStyle: z.string().optional(),
    customStyleText: z.string().optional(),
    savedStyleId: z.string().optional(),
    resolution: z.string().optional(),
    motionEffect: z.enum(motionEffects).optional(),
    imageGenerator: z.enum(["seedream", "wavespeed", "runpod", "pollinations", "whisk"]).optional(),
    pollinationsModel: z.string().optional(),
    ttsProvider: z.enum(["speechify", "inworld"]).optional(),
    sceneSettings: z.object({
        targetWords: z.number().optional(),
        maxWords: z.number().optional(),
        minDuration: z.number().optional(),
        maxDuration: z.number().optional(),
    }).optional(),
});

const renderVideoSchema = z.object({
    manifest: z.object({
        fps: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        scenes: z.array(z.any()).min(1, "At least one scene is required"),
        transitionDuration: z.number().optional(),
    }),
    projectId: z.string().optional(),
    exportQuality: z.enum(["720p", "1080p", "4k"]).optional(),
});

export class ProjectController extends BaseController {

    // ==========================================
    // Project Management (CRUD)
    // ==========================================

    async generateAssetsBackground(req: Request, res: Response) {
        try {
            // Validate input
            const body = this.validateBody(generateAssetsSchema, req.body);

            // Generate title from topic, title field, or first words of script
            const projectTitle = body.topic || body.title || generateTitleFromScript(body.script) || `Video ${randomUUID().slice(0, 8)}`;

            // Create project immediately
            const project = await storage.createVideoProject({
                title: projectTitle,
                script: body.script,
                status: "generating",
                voiceId: body.voiceId,
                imageStyle: body.imageStyle,
                customStyleText: body.customStyleText,
                outputPath: null,
            });

            // Start generation in background (fire and forget)
            this.runBackgroundGeneration(project.id, body, this.getUserId(req)).catch(async (err) => {
                logError("BG_GEN", `Background generation failed for project ${project.id}`, err);
                // Only set error message if not already set by scene-specific error handling
                const existingProject = await storage.getVideoProject(project.id);
                if (!existingProject?.errorMessage) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    await storage.updateVideoProject(project.id, { 
                        status: "error", 
                        errorMessage: errorMsg || "Unknown error during generation"
                    });
                }
            });

            return res.json({
                success: true,
                message: "Background generation started",
                projectId: project.id
            });
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.generateAssetsBackground');
        }
    }

    private async runBackgroundGeneration(projectId: string, body: any, userId: string) {
        const { script, voiceId, imageStyle, customStyleText, resolution, motionEffect, imageGenerator, pollinationsModel, ttsProvider, sceneSettings } = body;

        // Log configuration
        logInfo("BG_GEN", "Starting background generation", {
            projectId,
            settings: { imageGenerator, pollinationsModel, ttsProvider }
        });

        // 1. Script Processing
        let finalScript = script;

        // 2. Split Scenes
        const appSettings = getAppSettings();
        // Use provided sceneSettings or fall back to global app settings
        const splitSettings = sceneSettings || appSettings.sceneSettings;
        const scenesText = await splitScriptIntoScenes(finalScript, splitSettings);

        // Resolve resolution - normalize to 1024-based sizing for consistent image generation
        const resOption = resolutionOptions.find(r => r.id === resolution);
        const resWidth = resOption?.width || 1280;
        const resHeight = resOption?.height || 720;
        
        const aspectRatio = resWidth / resHeight;
        let width: number, height: number;
        if (aspectRatio > 1) {
            width = 1024;
            height = Math.round(1024 / aspectRatio);
        } else if (aspectRatio < 1) {
            height = 1024;
            width = Math.round(1024 * aspectRatio);
        } else {
            width = 1024;
            height = 1024;
        }

        // 3. Generate Assets per Scene
        const generatedScenes: any[] = [];
        const projectDir = path.join(ASSETS_DIR, projectId);
        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

        // Iterate
        for (let i = 0; i < scenesText.length; i++) {
            const sceneText = scenesText[i];
            const sceneId = `scene-${i + 1}`;

            try {
                // Report progress - Step 1: Voiceover
                await storage.updateVideoProject(projectId, {
                    progress: Math.round(((i * 2) / (scenesText.length * 2)) * 100),
                    progressMessage: `Scene ${i + 1}/${scenesText.length}: Creating voiceover...`
                });

                // TTS - Use the correct provider based on ttsProvider setting
                const ttsPath = path.join(projectDir, `${sceneId}.mp3`);
                let ttsResult;
                
                const effectiveTtsProvider = ttsProvider || "inworld";
                if (effectiveTtsProvider === "inworld") {
                    const { generateInworldTTS } = await import("../services/inworld-tts");
                    ttsResult = await generateInworldTTS({
                        text: sceneText,
                        voiceId: voiceId || "Dennis",
                        outputPath: ttsPath,
                    });
                } else {
                    ttsResult = await generateTTS({
                        text: sceneText,
                        voiceId: voiceId || "george",
                        outputPath: ttsPath,
                    });
                }

                if (!ttsResult.success) {
                    logError("BG_GEN", `TTS failed for scene ${i + 1}`, undefined, { projectId, provider: effectiveTtsProvider });
                }

                // Report progress - Step 2: Image
                await storage.updateVideoProject(projectId, {
                    progress: Math.round(((i * 2 + 1) / (scenesText.length * 2)) * 100),
                    progressMessage: `Scene ${i + 1}/${scenesText.length}: Generating image...`
                });

                // Image - Always use Groq for consistent prompt generation
                let customStyleForPrompt = undefined;
                if (imageStyle === "custom" && customStyleText) {
                    customStyleForPrompt = {
                        art_style: customStyleText,
                        composition: "",
                        color_style: "",
                        fine_details: "",
                    };
                }
                
                const imagePrompt = await generateImagePromptWithGroq({
                    sceneText,
                    imageStyle: imageStyle || "cinematic",
                    customStyle: customStyleForPrompt,
                });

                const imagePath = path.join(projectDir, `${sceneId}.png`);
                let imageSuccess = false;

                // Use the specified image generator (support all generators)
                const selectedGenerator = imageGenerator || "wavespeed";
                
                if (selectedGenerator === "pollinations") {
                    const { generateImageWithPollinations } = await import("../services/image-generators");
                    try {
                        const apiKey = await getResolvedApiKey("pollinations", userId);
                        const result = await generateImageWithPollinations(
                            imagePrompt,
                            apiKey,
                            width,
                            height,
                            pollinationsModel
                        );
                        fs.writeFileSync(imagePath, result.imageBuffer);
                        imageSuccess = true;
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        throw new Error(`Failed to generate image for scene ${i + 1}: ${message}`);
                    }
                } else if (selectedGenerator === "wavespeed" || selectedGenerator === "runpod") {
                    const { generateImageWithWaveSpeed, generateImageWithRunPod } = await import("../services/image-generators");
                    try {
                        const apiKey = await getResolvedApiKey(selectedGenerator, userId);
                        if (!apiKey) {
                            throw new Error(`${selectedGenerator} API key not configured. Please add your API key in Settings.`);
                        }
                        const imageUrl = selectedGenerator === "wavespeed"
                            ? await generateImageWithWaveSpeed(imagePrompt, apiKey, width, height)
                            : await generateImageWithRunPod(imagePrompt, apiKey, width, height);

                        const imageResponse = await fetch(imageUrl);
                        if (!imageResponse.ok) throw new Error(`Failed to download image from ${imageUrl}`);
                        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                        fs.writeFileSync(imagePath, imageBuffer);
                        imageSuccess = true;
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        throw new Error(`Failed to generate image for scene ${i + 1}: ${message}`);
                    }
                } else if (selectedGenerator === "whisk") {
                    const { generateImageWithWhisk } = await import("../services/image-generators");
                    try {
                        const cookie = await getResolvedApiKey("whisk", userId);
                        if (!cookie) {
                            throw new Error("Google Whisk cookie not configured. Please add your Google cookie in Settings.");
                        }
                        const imageUrl = await generateImageWithWhisk(imagePrompt, cookie, width, height);

                        const imageResponse = await fetch(imageUrl);
                        if (!imageResponse.ok) throw new Error(`Failed to download image from Whisk`);
                        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                        fs.writeFileSync(imagePath, imageBuffer);
                        imageSuccess = true;
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        throw new Error(`Failed to generate image for scene ${i + 1}: ${message}`);
                    }
                } else {
                    // Default to seedream
                    const apiKey = await getResolvedApiKey("seedream", userId);
                    const imageResult = await generateImageWithSeestream({
                        prompt: imagePrompt,
                        outputPath: imagePath,
                        width,
                        height,
                        style: imageStyle || "cinematic",
                        apiKey: apiKey || undefined
                    });
                    if (!imageResult.success) {
                        throw new Error(`Failed to generate image for scene ${i + 1}: ${imageResult.error}`);
                    }
                    imageSuccess = true;
                }

                generatedScenes.push({
                    id: sceneId,
                    text: sceneText,
                    audioFile: ttsResult.success ? `/assets/${projectId}/${sceneId}.mp3` : undefined,
                    imageFile: imageSuccess ? `/assets/${projectId}/${sceneId}.png` : undefined,
                    durationInSeconds: ttsResult.durationSeconds || 5,
                    motion: motionEffect || "zoom-in",
                    transition: "fade"
                });
            } catch (sceneError) {
                const errorMsg = sceneError instanceof Error ? sceneError.message : String(sceneError);
                logError("BG_GEN", `Scene ${i + 1} generation failed: ${errorMsg}`, sceneError as Error, { projectId });
                await storage.updateVideoProject(projectId, {
                    status: "error",
                    errorMessage: `Scene ${i + 1} failed: ${errorMsg}`
                });
                throw sceneError;
            }
        }

        // 4. Update Manifest
        const manifest: VideoManifest = {
            fps: 30,
            width: resWidth,
            height: resHeight,
            scenes: generatedScenes,
            transitionDuration: 0.5
        };
        const manifestPath = path.join(projectDir, "manifest.json");
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        // 5. Render video
        await storage.updateVideoProject(projectId, {
            manifest,
            progress: 90,
            progressMessage: "Rendering final video..."
        });

        const outputVideoPath = `/assets/${projectId}/video-${projectId}.mp4`;
        const renderResult = await renderVideo({
            manifest,
            outputPath: outputVideoPath,
            projectDir,
        });

        if (!renderResult.success) {
            logError("BG_GEN", `Video rendering failed: ${renderResult.error}`, undefined, { projectId });
            await storage.updateVideoProject(projectId, {
                manifest,
                status: "error",
                errorMessage: `Video rendering failed: ${renderResult.error}`
            });
            return;
        }

        // 6. Generate thumbnail
        await storage.updateVideoProject(projectId, {
            progress: 95,
            progressMessage: "Generating thumbnail..."
        });

        let thumbnailPath: string | null = null;
        try {
            const thumbnailOutputPath = `/assets/${projectId}/thumbnail.jpg`;
            const thumbResult = await generateThumbnail(outputVideoPath, thumbnailOutputPath, 1);
            if (thumbResult.success && thumbResult.thumbnailPath) {
                thumbnailPath = thumbResult.thumbnailPath;
            }
        } catch (err) {
            logError("BG_GEN", `Thumbnail generation failed`, err as Error, { projectId });
        }

        // 7. Complete - only now set to "ready"
        await storage.updateVideoProject(projectId, {
            manifest,
            status: "ready",
            progress: 100,
            progressMessage: "Ready",
            outputPath: outputVideoPath,
            thumbnailPath
        });

        logInfo("BG_GEN", `Background generation completed successfully`, { projectId, outputVideoPath });
    }

    async getAllProjects(_req: Request, res: Response) {
        try {
            // TODO: Filter by userId if we want multi-user isolation
            const projects = await storage.getAllVideoProjects();
            return res.json(projects);
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.getAllProjects');
        }
    }

    async getProject(req: Request, res: Response) {
        try {
            const project = await storage.getVideoProject(req.params.id);
            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }
            return res.json(project);
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.getProject');
        }
    }

    async deleteProject(req: Request, res: Response) {
        try {
            const deleted = await storage.deleteVideoProject(req.params.id);
            if (!deleted) {
                return res.status(404).json({ error: "Project not found" });
            }

            // Cleanup files
            const projectDir = path.join(ASSETS_DIR, req.params.id);
            if (fs.existsSync(projectDir)) {
                fs.rmSync(projectDir, { recursive: true, force: true });
            }

            return res.json({ success: true });
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.deleteProject');
        }
    }

    /**
     * Import a project from an existing folder
     */
    async importProject(req: Request, res: Response) {
        try {
            const { folderPath, title } = req.body;

            if (!folderPath) {
                return res.status(400).json({ error: "Folder path is required" });
            }

            const sanitizedPath = path.basename(folderPath);
            if (sanitizedPath !== folderPath || folderPath.includes("..") || folderPath.includes("/") || folderPath.includes("\\")) {
                return res.status(400).json({ error: "Invalid folder path - only folder names within assets are allowed" });
            }

            const fullPath = path.join(ASSETS_DIR, sanitizedPath);

            if (!fs.existsSync(fullPath)) {
                return res.status(404).json({ error: "Folder not found" });
            }

            const manifestPath = path.join(fullPath, "manifest.json");
            if (!fs.existsSync(manifestPath)) {
                return res.status(400).json({ error: "No manifest.json found in folder" });
            }

            let manifest: VideoManifest;
            try {
                manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as VideoManifest;
            } catch (parseError) {
                return res.status(400).json({ error: "Invalid manifest.json format" });
            }

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
                manifest: manifest,
                outputPath,
                thumbnailPath,
            });

            this.logInfo("API", `Project imported: ${project.id}`, { folderId, sceneCount: manifest.scenes?.length });

            return res.json({
                success: true,
                project,
            });
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.importProject');
        }
    }

    // ==========================================
    // AI Generation
    // ==========================================

    /**
     * Generate a video script using AI
     */
    async generateScript(req: Request, res: Response) {
        try {
            const parsed = this.validateBody(generateScriptRequestSchema, req.body);

            const userId = this.getUserId(req);
            const settings = getAppSettings();
            const primaryProvider = settings.scriptProvider || "gemini";
            const fallbackProvider = primaryProvider === "gemini" ? "groq" : "gemini";

            let result;
            let usedProvider = primaryProvider;

            try {
                if (primaryProvider === "groq") {
                    result = await generateScriptWithGroq({ ...parsed, userId });
                } else {
                    result = await generateScript({ ...parsed, userId });
                }
            } catch (primaryError) {
                this.logInfo("API", `Primary provider (${primaryProvider}) failed, trying fallback (${fallbackProvider})...`);

                try {
                    if (fallbackProvider === "groq") {
                        result = await generateScriptWithGroq({ ...parsed, userId });
                    } else {
                        result = await generateScript({ ...parsed, userId });
                    }
                    usedProvider = fallbackProvider;
                } catch (fallbackError) {
                    const error = primaryError as Error;
                    const message = error.message?.includes("API key not configured")
                        ? `${primaryProvider === "gemini" ? "Gemini" : "Groq"} API key not configured. Please add it in Settings or configure ${fallbackProvider === "gemini" ? "Gemini" : "Groq"} as a fallback.`
                        : "Failed to generate script. Please check your API keys in Settings.";

                    return res.status(500).json({ error: message });
                }
            }

            return res.json({
                title: result.title,
                script: result.script,
                scenes: result.scenes,
                provider: usedProvider,
            });
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.generateScript');
        }
    }

    /**
     * Generate assets from script (Scene Splitting, TTS, Image Gen)
     */
    async generateAssets(req: Request, res: Response) {
        try {
            const validation = this.validateBody(generateAssetsSchema, req.body);
            const {
                script,
                title,
                topic,
                voiceId,
                imageStyle,
                customStyleText,
                resolution,
                motionEffect,
                imageGenerator = "wavespeed",
                pollinationsModel = "flux",
                ttsProvider = "inworld",
                sceneSettings
            } = validation;

            // Generate project title from topic, title field, or first words of script
            const projectTitle = topic || title || generateTitleFromScript(script) || `Video ${randomUUID().slice(0, 8)}`;

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

            let resolvedVoiceId = voiceId || (ttsProvider === "inworld" ? "Dennis" : "george");
            const customVoice = getAppSettings().customVoices.find(
                v => v.id === voiceId || v.name.toLowerCase() === (voiceId || "").toLowerCase() || v.voiceId === voiceId
            );
            if (customVoice) {
                resolvedVoiceId = customVoice.voiceId;
            }

            const resConfig = resolutionOptions.find(r => r.id === resolution) || resolutionOptions[0];
            const aspectRatio = resConfig.width / resConfig.height;
            let imageWidth: number, imageHeight: number;

            if (aspectRatio > 1) {
                imageWidth = 1024;
                imageHeight = Math.round(1024 / aspectRatio);
            } else if (aspectRatio < 1) {
                imageHeight = 1024;
                imageWidth = Math.round(1024 * aspectRatio);
            } else {
                imageWidth = 1024;
                imageHeight = 1024;
            }

            const projectId = randomUUID();
            const projectDir = path.join(ASSETS_DIR, projectId);

            if (!fs.existsSync(projectDir)) {
                fs.mkdirSync(projectDir, { recursive: true });
            }

            const generatedScenes: Scene[] = [];
            const userId = this.getUserId(req);

            for (let i = 0; i < scenes.length; i++) {
                const sceneText = scenes[i].trim();
                const sceneId = `scene-${i + 1}`;
                const audioPath = path.join(projectDir, `${sceneId}.mp3`);
                let ttsResult;

                if (ttsProvider === "inworld") {
                    const { generateInworldTTS } = await import("../services/inworld-tts");
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

                let customStyleForPrompt = getAppSettings().imageStyleSettings;
                if (imageStyle === "custom" && customStyleText) {
                    customStyleForPrompt = {
                        art_style: customStyleText,
                        composition: "",
                        color_style: "",
                        fine_details: "",
                    };
                }

                const imagePrompt = await generateImagePromptWithGroq({
                    sceneText,
                    imageStyle: imageStyle || "historical",
                    customStyle: customStyleForPrompt,
                });

                const imagePath = path.join(projectDir, `${sceneId}.png`);
                let imageResult: { success: boolean; error?: string };

                if (imageGenerator === "pollinations") {
                    const { generateImageWithPollinations } = await import("../services/image-generators");
                    try {
                        const apiKey = await getResolvedApiKey("pollinations", userId);
                        const result = await generateImageWithPollinations(
                            imagePrompt,
                            apiKey,
                            imageWidth,
                            imageHeight,
                            pollinationsModel
                        );
                        fs.writeFileSync(imagePath, result.imageBuffer);
                        imageResult = { success: true };
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        throw new Error(`Failed to generate image for scene ${i + 1}: ${message}`);
                    }
                } else if (imageGenerator === "wavespeed" || imageGenerator === "runpod") {
                    const { generateImageWithWaveSpeed, generateImageWithRunPod } = await import("../services/image-generators");
                    try {
                        const apiKey = await getResolvedApiKey(imageGenerator, userId);
                        if (!apiKey) {
                            throw new Error(`${imageGenerator} API key not configured. Please add your API key in Settings.`);
                        }
                        const imageUrl = imageGenerator === "wavespeed"
                            ? await generateImageWithWaveSpeed(imagePrompt, apiKey, imageWidth, imageHeight)
                            : await generateImageWithRunPod(imagePrompt, apiKey, imageWidth, imageHeight);

                        const imageResponse = await fetch(imageUrl);
                        if (!imageResponse.ok) throw new Error(`Failed to download image from ${imageUrl}`);
                        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                        fs.writeFileSync(imagePath, imageBuffer);
                        imageResult = { success: true };
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        throw new Error(`Failed to generate image for scene ${i + 1}: ${message}`);
                    }
                } else if (imageGenerator === "whisk") {
                    const { generateImageWithWhisk } = await import("../services/image-generators");
                    try {
                        const cookie = await getResolvedApiKey("whisk", userId);
                        if (!cookie) {
                            throw new Error("Google Whisk cookie not configured. Please add your Google cookie in Settings.");
                        }
                        const imageUrl = await generateImageWithWhisk(imagePrompt, cookie, imageWidth, imageHeight);

                        const imageResponse = await fetch(imageUrl);
                        if (!imageResponse.ok) throw new Error(`Failed to download image from Whisk`);
                        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                        fs.writeFileSync(imagePath, imageBuffer);
                        imageResult = { success: true };
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        throw new Error(`Failed to generate image for scene ${i + 1}: ${message}`);
                    }
                } else {
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
                    motion: selectedMotion,
                    transition: getAppSettings().transitionSettings.defaultTransition as any, // TODO: Fix transition type in settings
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
                title: projectTitle,
                script,
                status: "ready",
                voiceId,
                imageStyle,
                customStyleText,
                manifest: manifest,
                outputPath: null,
            });

            return res.json({
                projectId: project.id,
                manifest,
                assetsGenerated: {
                    audio: generatedScenes.filter(s => s.audioFile).length,
                    images: generatedScenes.filter(s => s.imageFile).length,
                    total: generatedScenes.length,
                },
            });
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.generateAssets');
        }
    }

    /**
     * Render final video
     */
    async renderVideo(req: Request, res: Response) {
        try {
            const { manifest, projectId, exportQuality } = this.validateBody(renderVideoSchema, req.body);

            const qualitySettings: Record<string, { width: number; height: number; bitrate: string }> = {
                "720p": { width: 1280, height: 720, bitrate: "4M" },
                "1080p": { width: 1920, height: 1080, bitrate: "8M" },
                "4k": { width: 3840, height: 2160, bitrate: "20M" },
            };
            const resolvedQuality = exportQuality && qualitySettings[exportQuality] ? qualitySettings[exportQuality] : undefined;

            const outputId = projectId || randomUUID().slice(0, 8);
            const outputFilename = `video-${outputId}.mp4`;
            const outputPath = `/assets/${outputId}/${outputFilename}`;

            const outputDir = path.join(ASSETS_DIR, outputId);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            if (projectId) {
                await storage.updateVideoProject(projectId, { status: "generating" });
            }

            this.logInfo("RENDER", "Starting video render", { projectId: outputId });

            const renderResult = await renderVideo({
                manifest: {
                    ...manifest,
                    fps: manifest.fps || 30,
                    width: manifest.width || 1280,
                    height: manifest.height || 720,
                    transitionDuration: manifest.transitionDuration || 0.5,
                } as VideoManifest,
                outputPath,
                projectDir: outputDir,
                exportQuality: resolvedQuality,
            });

            if (!renderResult.success) {
                if (projectId) {
                    await storage.updateVideoProject(projectId, { status: "error" });
                }
                throw new Error(renderResult.error || "Video rendering failed");
            }

            if (projectId) {
                await storage.updateVideoProject(projectId, {
                    outputPath,
                    status: "ready",
                });
            }

            return res.json({
                success: true,
                outputUrl: outputPath,
                projectId: outputId,
                manifest,
                message: "Video rendered successfully.",
            });
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.renderVideo');
        }
    }

    // ==========================================
    // Post-Processing / Utilities
    // ==========================================

    async generateThumbnail(req: Request, res: Response) {
        try {
            const project = await storage.getVideoProject(req.params.id);
            if (!project || !project.outputPath) {
                return res.status(400).json({ error: "Project has no video" });
            }

            const timestamp = req.body.timestamp || 1;
            const thumbnailPath = `/assets/${req.params.id}/thumbnail.jpg`;

            const result = await generateThumbnail(project.outputPath, thumbnailPath, timestamp);

            if (result.success) {
                await storage.updateVideoProject(req.params.id, { thumbnailPath });
                return res.json({ success: true, thumbnailPath });
            } else {
                return res.status(500).json({ error: result.error });
            }
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.generateThumbnail');
        }
    }

    async generateAiThumbnail(req: Request, res: Response) {
        try {
            const project = await storage.getVideoProject(req.params.id);
            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            const { style = "cinematic", customPrompt } = req.body;
            const basePrompt = customPrompt || `YouTube video thumbnail for: ${project.title}. ${project.script?.slice(0, 200) || ""}`;
            const thumbnailPrompt = `${basePrompt}, eye-catching thumbnail design, bold vibrant colors, dramatic lighting, high contrast, professional YouTube thumbnail style, 16:9 aspect ratio`;

            const thumbnailFilename = `thumbnail-ai-${Date.now()}.png`;
            const thumbnailDir = path.join(ASSETS_DIR, req.params.id);

            if (!fs.existsSync(thumbnailDir)) {
                fs.mkdirSync(thumbnailDir, { recursive: true });
            }

            const thumbnailFilePath = path.join(thumbnailDir, thumbnailFilename);
            const userId = this.getUserId(req);
            const apiKey = await getResolvedApiKey("seedream", userId);

            const imageResult = await generateImageWithSeestream({
                prompt: thumbnailPrompt,
                outputPath: thumbnailFilePath,
                width: 1280,
                height: 720,
                style: style,
                apiKey: apiKey || undefined
            });

            if (imageResult.success) {
                const thumbnailPath = `/assets/${req.params.id}/${thumbnailFilename}`;
                await storage.updateVideoProject(req.params.id, { thumbnailPath });
                return res.json({ success: true, thumbnailPath });
            } else {
                return res.status(500).json({ error: imageResult.error });
            }
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.generateAiThumbnail');
        }
    }

    async concatenateVideos(req: Request, res: Response) {
        try {
            const { videoPaths, outputName } = req.body;
            if (!videoPaths || !Array.isArray(videoPaths) || videoPaths.length < 2) {
                return res.status(400).json({ error: "At least 2 video paths are required" });
            }

            const outputId = randomUUID().slice(0, 8);
            const outputPath = `/assets/${outputId}/${outputName || "combined.mp4"}`;

            const result = await concatenateVideos(videoPaths, outputPath);

            if (result.success) {
                return res.json({ success: true, outputPath: result.outputPath });
            } else {
                return res.status(500).json({ error: result.error });
            }
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.concatenateVideos');
        }
    }

    async getChapters(req: Request, res: Response) {
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

            await storage.updateVideoProject(req.params.id, { chapters: chapters });
            return res.json(chapters);
        } catch (error) {
            return this.handleError(error, res, 'ProjectController.getChapters');
        }
    }
}
