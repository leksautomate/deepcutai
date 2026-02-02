import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { z } from 'zod';
import { BaseController } from './BaseController';
import { getAppSettings } from '../services/settings';
import { generateTTS } from '../services/speechify';
import { generateImageWithSeestream } from '../services/freepik';
import { generateImagePromptWithGroq } from '../services/groq';
import { storage } from '../storage';
import { getResolvedApiKey } from '../services/api-keys';
import type { VideoManifest } from '@shared/schema';

// Helper for assets directory
const ASSETS_DIR = path.join(process.cwd(), "public", "assets");

// Validation schema for regenerate-scene-image endpoint
const regenerateSceneImageSchema = z.object({
    projectId: z.string().min(1, "Project ID is required"),
    sceneId: z.string().min(1, "Scene ID is required"),
    sceneIndex: z.number().int().min(0, "Scene index must be a non-negative integer"),
    text: z.string().min(1, "Text is required").max(10000, "Text is too long"),
    width: z.number().int().min(256).max(4096).optional(),
    height: z.number().int().min(256).max(4096).optional(),
});

// Hardcoded for now, should move to service
const SPEECHIFY_VOICES = [
    { id: "george", name: "George", voiceId: "george", gender: "male", accent: "American" },
    { id: "maisie", name: "Maisie", voiceId: "maisie", gender: "female", accent: "British" },
    { id: "henry", name: "Henry", voiceId: "henry", gender: "male", accent: "British" },
    { id: "carly", name: "Carly", voiceId: "carly", gender: "female", accent: "British" },
    { id: "oliver", name: "Oliver", voiceId: "oliver", gender: "male", accent: "Australian" },
    { id: "simone", name: "Simone", voiceId: "simone", gender: "female", accent: "Australian" },
];

export class AssetController extends BaseController {

    async getVoices(_req: Request, res: Response) {
        try {
            const { inworldDefaultVoices } = await import("../services/inworld-tts");

            const inworldVoices = inworldDefaultVoices.map(v => ({
                id: v.id,
                name: v.name,
                voiceId: v.id,
                gender: v.gender,
                accent: "Standard",
            }));

            return res.json({
                defaultVoices: SPEECHIFY_VOICES,
                inworldVoices,
                customVoices: getAppSettings().customVoices,
            });
        } catch (error) {
            return this.handleError(error, res, 'AssetController.getVoices');
        }
    }

    async previewTTS(req: Request, res: Response) {
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
            const previewDir = path.join(ASSETS_DIR, "previews");

            if (!fs.existsSync(previewDir)) {
                fs.mkdirSync(previewDir, { recursive: true });
            }

            const audioPath = path.join(previewDir, `${previewId}.mp3`);
            let ttsResult;

            if (ttsProvider === "inworld") {
                const { generateInworldTTS } = await import("../services/inworld-tts");
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
                throw new Error(`Failed to generate voice preview. Make sure your ${provider} API key is configured.`);
            }

            return res.json({
                audioUrl: `/assets/previews/${previewId}.mp3`,
                duration: ttsResult.durationSeconds,
            });
        } catch (error) {
            return this.handleError(error, res, 'AssetController.previewTTS');
        }
    }

    async generateImage(req: Request, res: Response) {
        try {
            const userId = this.getUserId(req);
            const { prompt, generator, pollinationsModel, width, height, seed } = req.body;

            // Use centralized API key resolver
            const apiKey = await getResolvedApiKey(generator, userId);

            if (!apiKey && generator !== "pollinations") {
                return res.status(400).json({ error: `No API key configured for ${generator}. Please add your API key in Settings.` });
            }

            let imageUrl: string;

            if (generator === "pollinations") {
                const { generateImageWithPollinations } = await import("../services/image-generators");
                const result = await generateImageWithPollinations(
                    prompt,
                    apiKey, // Can be undefined for pollinations
                    width || 1024,
                    height || 576,
                    pollinationsModel || "flux",
                    seed
                );
                // Convert buffer to base64 data URL
                imageUrl = `data:image/png;base64,${result.imageBuffer.toString('base64')}`;
            } else if (generator === "seedream") {
                // Actually generate with Seedream/Freepik
                const tempPath = `/tmp/gen-${Date.now()}.png`;
                const result = await generateImageWithSeestream({
                    prompt,
                    outputPath: tempPath,
                    width: width || 1024,
                    height: height || 576,
                    apiKey: apiKey!,
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
                const { generateImageWithWaveSpeed } = await import("../services/image-generators");
                imageUrl = await generateImageWithWaveSpeed(prompt, apiKey!, width || 1024, height || 576, seed);
            } else if (generator === "runpod") {
                const { generateImageWithRunPod } = await import("../services/image-generators");
                imageUrl = await generateImageWithRunPod(prompt, apiKey!, width || 1024, height || 576, seed);
            } else if (generator === "whisk") {
                const { generateImageWithWhisk } = await import("../services/image-generators");
                const cookie = await getResolvedApiKey("whisk", userId);
                if (!cookie) {
                    return res.status(400).json({ error: "Google Whisk cookie not configured" });
                }
                imageUrl = await generateImageWithWhisk(prompt, cookie, width || 1024, height || 576);
            } else {
                return res.status(400).json({ error: "Unknown generator" });
            }

            await storage.incrementUsage("image", 1);
            return res.json({ imageUrl });
        } catch (error) {
            return this.handleError(error, res, 'AssetController.generateImage');
        }
    }

    async regenerateSceneImage(req: Request, res: Response) {
        try {
            // Validate input
            const { projectId, sceneId, sceneIndex, text, width, height } = this.validateBody(regenerateSceneImageSchema, req.body);

            const project = await storage.getVideoProject(projectId);
            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            const manifest = project.manifest as VideoManifest | undefined;
            if (!manifest || !manifest.scenes) {
                return res.status(400).json({ error: "Project has no manifest or scenes" });
            }

            // Get image generator settings from project or defaults
            const imageGenerator = project.imageGenerator || "wavespeed";
            const imageStyle = project.imageStyle || "cinematic";
            const userId = this.getUserId(req);

            // Generate image prompt using Groq
            let imagePrompt: string;
            try {
                imagePrompt = await generateImagePromptWithGroq({ sceneText: text, imageStyle });
            } catch (error) {
                // Fallback to simple prompt
                imagePrompt = `${imageStyle} style: ${text}`;
            }

            this.logInfo("REGENERATE", `Regenerating image for scene ${sceneIndex + 1}`, { sceneId, imageGenerator, promptPreview: imagePrompt.slice(0, 100) });

            const projectDir = path.join(ASSETS_DIR, projectId);
            if (!fs.existsSync(projectDir)) {
                fs.mkdirSync(projectDir, { recursive: true });
            }

            const imageFilename = `scene-${sceneIndex + 1}-${Date.now()}.png`;
            const imagePath = path.join(projectDir, imageFilename);
            // const imageUrl = `/assets/${projectId}/${imageFilename}`; // Not used locally, but client constructs it

            // Generate image based on provider
            // Re-using logic similar to generateImage but writing to file
            if (imageGenerator === "pollinations") {
                const { generateImageWithPollinations } = await import("../services/image-generators");
                const pollinationsModel = "flux";
                const apiKey = await getResolvedApiKey("pollinations", userId);
                const result = await generateImageWithPollinations(imagePrompt, apiKey, width || 1280, height || 720, pollinationsModel);
                fs.writeFileSync(imagePath, result.imageBuffer);
            } else if (imageGenerator === "wavespeed" || imageGenerator === "runpod") {
                const apiKey = await getResolvedApiKey(imageGenerator, userId);
                if (!apiKey) {
                    return res.status(400).json({ error: `No API key configured for ${imageGenerator}` });
                }
                const { generateImageWithWaveSpeed, generateImageWithRunPod } = await import("../services/image-generators");
                const remoteImageUrl = imageGenerator === "wavespeed"
                    ? await generateImageWithWaveSpeed(imagePrompt, apiKey, width || 1280, height || 720)
                    : await generateImageWithRunPod(imagePrompt, apiKey, width || 1280, height || 720);

                // Download and save image
                const response = await fetch(remoteImageUrl);
                const buffer = Buffer.from(await response.arrayBuffer());
                fs.writeFileSync(imagePath, buffer);
            } else if (imageGenerator === "whisk") {
                const cookie = await getResolvedApiKey("whisk", userId);
                if (!cookie) {
                    return res.status(400).json({ error: "Google Whisk cookie not configured" });
                }
                const { generateImageWithWhisk } = await import("../services/image-generators");
                const imageData = await generateImageWithWhisk(imagePrompt, cookie, width || 1280, height || 720);

                // Handle both URL and base64 data URL
                if (imageData.startsWith('data:')) {
                    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
                    fs.writeFileSync(imagePath, Buffer.from(base64Data, 'base64'));
                } else {
                    const response = await fetch(imageData);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    fs.writeFileSync(imagePath, buffer);
                }
            } else {
                // Seedream/Freepik
                const apiKey = await getResolvedApiKey("seedream", userId);

                const result = await generateImageWithSeestream({
                    prompt: imagePrompt,
                    outputPath: imagePath,
                    width: width || 1280,
                    height: height || 720,
                    style: imageStyle,
                    apiKey: apiKey || undefined,
                });

                if (!result.success) {
                    throw new Error(result.error || "Seedream generation failed");
                }
            }

            // We don't update the manifest here? routes.ts didn't seem to update the manifest with the new image path...
            // wait, looking at routes.ts... it just regenerates the file. The file name has a timestamp, so the path CHANGES.
            // If the path changes, the manifest MUST be updated.
            // Let's check routes.ts again for manifest update.
            // Ah, lines 1416-1419 in routes.ts (implied):
            /*
              manifest.scenes[sceneIndex].imageFile = imageUrl;
              await storage.updateVideoProject(projectId, { manifest });
              res.json({ success: true, imageUrl });
            */
            // I need to add that logic.

            const relativeImagePath = `/assets/${projectId}/${imageFilename}`;
            if (manifest.scenes[sceneIndex]) {
                manifest.scenes[sceneIndex].imageFile = relativeImagePath;
                await storage.updateVideoProject(projectId, { manifest });
            }

            return res.json({ success: true, imageUrl: relativeImagePath });
        } catch (error) {
            return this.handleError(error, res, 'AssetController.regenerateSceneImage');
        }
    }
}
