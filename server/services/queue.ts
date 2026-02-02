import { storage } from "../storage";
import { generateScript, type GenerateScriptOptions } from "./gemini";
import { generateImagePromptWithGroq } from "./groq";
import { generateTTS } from "./speechify";
import { generateImageWithSeestream } from "./freepik";
import { renderVideo, generateThumbnail, generateChapters } from "./ffmpeg";
import { logInfo, logError } from "./logger";
import { getAppSettings, splitScriptIntoScenes } from "./settings";
import { getResolvedApiKey } from "./api-keys";
import { resolutionOptions, motionEffects, type VideoManifest, type Scene, type TransitionEffect } from "@shared/schema";

import * as path from "path";
import * as fs from "fs";

interface QueuedProject {
  id: string;
  topic: string;
  style: GenerateScriptOptions["style"];
  duration: GenerateScriptOptions["duration"];
  voiceId: string;
  imageStyle: string;
  customStyleText?: string;
  resolution: string;
  transition: string;
  imageGenerator?: string;
  pollinationsModel?: string;
  ttsProvider?: "speechify" | "inworld";
}

interface ScriptQueuedProject {
  id: string;
  script: string;
  title: string;
  voiceId: string;
  imageStyle: string;
  customStyleText?: string;
  resolution: string;
  transition: string;
  imageGenerator?: string;
  pollinationsModel?: string;
  ttsProvider?: "speechify" | "inworld";
}

type QueueItem = (QueuedProject & { type: "topic" }) | (ScriptQueuedProject & { type: "script" });

const processingQueue: QueueItem[] = [];
let isProcessing = false;

async function processScriptProject(project: ScriptQueuedProject) {
  const assetsDir = path.join(process.cwd(), "public", "assets");
  const settings = getAppSettings();

  try {
    logInfo("QUEUE", `Starting script project: ${project.id}`, { title: project.title });

    await storage.updateVideoProject(project.id, {
      status: "generating",
      progress: 10,
      progressMessage: "Processing script...",
    });

    const scenes = splitScriptIntoScenes(project.script, settings.sceneSettings);
    logInfo("QUEUE", `Split into ${scenes.length} scenes`, { projectId: project.id });

    const projectDir = path.join(assetsDir, project.id);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const resConfig = resolutionOptions.find(r => r.id === project.resolution) || resolutionOptions[0];

    // Calculate proper image dimensions based on aspect ratio
    let imageWidth: number;
    let imageHeight: number;
    const aspectRatio = resConfig.width / resConfig.height;

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

    logInfo("QUEUE", `Using resolution: ${resConfig.id}`, { imageWidth, imageHeight, aspectRatio: aspectRatio.toFixed(2) });

    const generatedScenes: Scene[] = [];
    const totalScenes = scenes.length;
    const imageGenerator = project.imageGenerator || "wavespeed";

    for (let i = 0; i < scenes.length; i++) {
      const sceneText = scenes[i].trim();
      const sceneId = `scene-${i + 1}`;
      const progressPercent = 15 + Math.floor((i / totalScenes) * 65);

      await storage.updateVideoProject(project.id, {
        progress: progressPercent,
        progressMessage: `Generating scene ${i + 1} of ${totalScenes}...`,
      });

      const audioPath = path.join(projectDir, `${sceneId}.mp3`);
      let ttsResult;

      if (project.ttsProvider === "inworld") {
        const { generateInworldTTS } = await import("./inworld-tts");
        ttsResult = await generateInworldTTS({
          text: sceneText,
          voiceId: project.voiceId,
          outputPath: audioPath,
        });
      } else {
        ttsResult = await generateTTS({
          text: sceneText,
          voiceId: project.voiceId,
          outputPath: audioPath,
        });
      }

      // Use custom style text if provided and imageStyle is "custom"
      let customStyleForPrompt = settings.imageStyleSettings;
      if (project.imageStyle === "custom" && project.customStyleText) {
        customStyleForPrompt = {
          art_style: project.customStyleText,
          composition: "",
          color_style: "",
          fine_details: "",
        };
      }

      const imagePrompt = await generateImagePromptWithGroq({
        sceneText,
        imageStyle: project.imageStyle,
        customStyle: customStyleForPrompt,
      });

      const imagePath = path.join(projectDir, `${sceneId}.png`);
      let imageResult: { success: boolean; error?: string };

      // Use selected image generator with proper dimensions
      if (imageGenerator === "pollinations") {
        const { generateImageWithPollinations } = await import("./image-generators");
        try {
          const apiKey = await getResolvedApiKey("pollinations");
          const pollinationsModel = project.pollinationsModel || "flux";

          const result = await generateImageWithPollinations(
            imagePrompt,
            apiKey || null,
            imageWidth,
            imageHeight,
            pollinationsModel
          );

          // Write image buffer directly to file
          fs.writeFileSync(imagePath, result.imageBuffer);

          imageResult = { success: true };
        } catch (error) {
          logError("QUEUE", `Pollinations generation error`, error);
          imageResult = { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      } else if (imageGenerator === "wavespeed" || imageGenerator === "runpod") {
        const { generateImageWithWaveSpeed, generateImageWithRunPod } = await import("./image-generators");
        try {
          // Use centralized API key resolver (checks database first, then env vars)
          const apiKey = await getResolvedApiKey(imageGenerator);
          if (!apiKey) {
            throw new Error(`${imageGenerator} API key not configured. Please add your API key in Settings.`);
          }

          const imageUrl = imageGenerator === "wavespeed"
            ? await generateImageWithWaveSpeed(imagePrompt, apiKey, imageWidth, imageHeight)
            : await generateImageWithRunPod(imagePrompt, apiKey, imageWidth, imageHeight);

          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.statusText}`);
          }
          const arrayBuffer = await imageResponse.arrayBuffer();
          fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));

          imageResult = { success: true };
        } catch (error) {
          logError("QUEUE", `${imageGenerator} generation error`, error);
          imageResult = { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      } else if (imageGenerator === "whisk") {
        const { generateImageWithWhisk } = await import("./image-generators");
        try {
          const cookie = await getResolvedApiKey("whisk");
          if (!cookie) {
            throw new Error("Google Whisk cookie not configured. Please add your Google cookie in Settings.");
          }
          const imageData = await generateImageWithWhisk(imagePrompt, cookie, imageWidth, imageHeight);

          // Handle both URL and base64 data URL
          if (imageData.startsWith('data:')) {
            // Base64 data URL - extract and save
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(imagePath, Buffer.from(base64Data, 'base64'));
          } else {
            // Regular URL - download
            const imageResponse = await fetch(imageData);
            if (!imageResponse.ok) {
              throw new Error(`Failed to download image from Whisk`);
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
          }

          imageResult = { success: true };
        } catch (error) {
          logError("QUEUE", `Whisk generation error`, error);
          imageResult = { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      } else {
        // Use centralized API key resolver for Seedream/Freepik
        const apiKey = await getResolvedApiKey("seedream");

        imageResult = await generateImageWithSeestream({
          prompt: imagePrompt,
          outputPath: imagePath,
          width: imageWidth,
          height: imageHeight,
          style: project.imageStyle,
          apiKey: apiKey || undefined,
        });
      }

      const motionOptions = motionEffects;
      const selectedMotion = motionOptions[i % motionOptions.length];
      const selectedTransition = project.transition || settings.transitionSettings.defaultTransition;

      generatedScenes.push({
        id: sceneId,
        text: sceneText,
        audioFile: ttsResult.audioPath ? `/assets/${project.id}/${sceneId}.mp3` : undefined,
        imageFile: imageResult.success ? `/assets/${project.id}/${sceneId}.png` : undefined,
        durationInSeconds: ttsResult.durationSeconds,
        motion: selectedMotion,
        transition: selectedTransition as TransitionEffect,
      });
    }

    await storage.updateVideoProject(project.id, {
      progress: 85,
      progressMessage: "Rendering video...",
    });

    const manifest: VideoManifest = {
      fps: 30,
      width: resConfig.width,
      height: resConfig.height,
      scenes: generatedScenes,
      transitionDuration: settings.transitionSettings.transitionDuration,
    };

    const manifestPath = path.join(projectDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const outputFilename = `video-${project.id.slice(0, 8)}.mp4`;
    const outputPath = `/assets/${project.id}/${outputFilename}`;

    const renderResult = await renderVideo({
      manifest,
      outputPath,
      projectDir,
    });

    if (renderResult.success) {
      const sceneDurations = generatedScenes.map(s => s.durationInSeconds || 5);
      const totalDuration = sceneDurations.reduce((a, b) => a + b, 0);
      const chapters = generateChapters(generatedScenes, sceneDurations);

      const thumbnailPath = `/assets/${project.id}/thumbnail.jpg`;
      await generateThumbnail(outputPath, thumbnailPath, 1);

      await storage.updateVideoProject(project.id, {
        status: "ready",
        progress: 100,
        progressMessage: "Video complete!",
        manifest: manifest,
        outputPath,
        thumbnailPath,
        chapters: chapters as any,
        totalDuration,
      });

      await storage.incrementUsage('video', 1);
      await storage.incrementUsage('render', 1, totalDuration);
      await storage.incrementUsage('image', generatedScenes.length);
      await storage.incrementUsage('audio', generatedScenes.length);

      logInfo("QUEUE", `Script project completed: ${project.id}`);
    } else {
      await storage.updateVideoProject(project.id, {
        status: "error",
        progress: 0,
        errorMessage: renderResult.error || "Rendering failed",
      });
      logError("QUEUE", `Script project failed: ${project.id}`, new Error(renderResult.error));
    }
  } catch (error) {
    logError("QUEUE", `Script project error: ${project.id}`, error);
    await storage.updateVideoProject(project.id, {
      status: "error",
      progress: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function processProject(project: QueuedProject) {
  const assetsDir = path.join(process.cwd(), "public", "assets");
  const settings = getAppSettings();

  try {
    logInfo("QUEUE", `Starting project: ${project.id}`, { topic: project.topic });

    await storage.updateVideoProject(project.id, {
      status: "generating",
      progress: 5,
      progressMessage: "Generating script...",
    });

    const scriptResult = await generateScript({
      topic: project.topic,
      style: project.style,
      duration: project.duration,
    });

    await storage.updateVideoProject(project.id, {
      script: scriptResult.script,
      progress: 15,
      progressMessage: "Script generated, creating scenes...",
    });

    const scenes = splitScriptIntoScenes(scriptResult.script, settings.sceneSettings);
    logInfo("QUEUE", `Split into ${scenes.length} scenes`, { projectId: project.id });

    const projectDir = path.join(assetsDir, project.id);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const resConfig = resolutionOptions.find(r => r.id === project.resolution) || resolutionOptions[0];

    // Calculate proper image dimensions based on aspect ratio
    let imageWidth: number;
    let imageHeight: number;
    const aspectRatio = resConfig.width / resConfig.height;

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

    const generatedScenes: Scene[] = [];
    const totalScenes = scenes.length;

    for (let i = 0; i < scenes.length; i++) {
      const sceneText = scenes[i].trim();
      const sceneId = `scene-${i + 1}`;
      const progressPercent = 20 + Math.floor((i / totalScenes) * 60);

      await storage.updateVideoProject(project.id, {
        progress: progressPercent,
        progressMessage: `Generating scene ${i + 1} of ${totalScenes}...`,
      });

      const audioPath = path.join(projectDir, `${sceneId}.mp3`);
      let ttsResult;

      if (project.ttsProvider === "inworld") {
        const { generateInworldTTS } = await import("./inworld-tts");
        ttsResult = await generateInworldTTS({
          text: sceneText,
          voiceId: project.voiceId,
          outputPath: audioPath,
        });
      } else {
        ttsResult = await generateTTS({
          text: sceneText,
          voiceId: project.voiceId,
          outputPath: audioPath,
        });
      }

      // Use custom style text if provided and imageStyle is "custom"
      let customStyleForPrompt = settings.imageStyleSettings;
      if (project.imageStyle === "custom" && project.customStyleText) {
        customStyleForPrompt = {
          art_style: project.customStyleText,
          composition: "",
          color_style: "",
          fine_details: "",
        };
      }

      const imagePrompt = await generateImagePromptWithGroq({
        sceneText,
        imageStyle: project.imageStyle,
        customStyle: customStyleForPrompt,
      });

      const imagePath = path.join(projectDir, `${sceneId}.png`);
      let imageResult: { success: boolean; error?: string };
      const imageGenerator = project.imageGenerator || "wavespeed";

      // Use selected image generator with proper dimensions
      if (imageGenerator === "pollinations") {
        const { generateImageWithPollinations } = await import("./image-generators");
        try {
          const apiKey = await getResolvedApiKey("pollinations");
          const pollinationsModel = project.pollinationsModel || "flux";

          const result = await generateImageWithPollinations(
            imagePrompt,
            apiKey || null,
            imageWidth,
            imageHeight,
            pollinationsModel
          );

          // Write image buffer directly to file
          fs.writeFileSync(imagePath, result.imageBuffer);

          imageResult = { success: true };
        } catch (error) {
          logError("QUEUE", `Pollinations generation error`, error);
          imageResult = { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      } else if (imageGenerator === "wavespeed" || imageGenerator === "runpod") {
        const { generateImageWithWaveSpeed, generateImageWithRunPod } = await import("./image-generators");
        try {
          const apiKey = await getResolvedApiKey(imageGenerator);
          if (!apiKey) {
            throw new Error(`${imageGenerator} API key not configured. Please add your API key in Settings.`);
          }

          const imageUrl = imageGenerator === "wavespeed"
            ? await generateImageWithWaveSpeed(imagePrompt, apiKey, imageWidth, imageHeight)
            : await generateImageWithRunPod(imagePrompt, apiKey, imageWidth, imageHeight);

          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.statusText}`);
          }
          const arrayBuffer = await imageResponse.arrayBuffer();
          fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));

          imageResult = { success: true };
        } catch (error) {
          logError("QUEUE", `${imageGenerator} generation error`, error);
          imageResult = { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      } else if (imageGenerator === "whisk") {
        const { generateImageWithWhisk } = await import("./image-generators");
        try {
          const cookie = await getResolvedApiKey("whisk");
          if (!cookie) {
            throw new Error("Google Whisk cookie not configured. Please add your Google cookie in Settings.");
          }
          const imageData = await generateImageWithWhisk(imagePrompt, cookie, imageWidth, imageHeight);

          // Handle both URL and base64 data URL
          if (imageData.startsWith('data:')) {
            // Base64 data URL - extract and save
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(imagePath, Buffer.from(base64Data, 'base64'));
          } else {
            // Regular URL - download
            const imageResponse = await fetch(imageData);
            if (!imageResponse.ok) {
              throw new Error(`Failed to download image from Whisk`);
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
          }

          imageResult = { success: true };
        } catch (error) {
          logError("QUEUE", `Whisk generation error`, error);
          imageResult = { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      } else {
        // Use centralized API key resolver for Seedream/Freepik
        const seedreamApiKey = await getResolvedApiKey("seedream");

        imageResult = await generateImageWithSeestream({
          prompt: imagePrompt,
          outputPath: imagePath,
          width: imageWidth,
          height: imageHeight,
          style: project.imageStyle,
          apiKey: seedreamApiKey || undefined,
        });
      }

      const motionOptions = motionEffects;
      const selectedMotion = motionOptions[i % motionOptions.length];
      const selectedTransition = project.transition || settings.transitionSettings.defaultTransition;

      generatedScenes.push({
        id: sceneId,
        text: sceneText,
        audioFile: ttsResult.audioPath ? `/assets/${project.id}/${sceneId}.mp3` : undefined,
        imageFile: imageResult.success ? `/assets/${project.id}/${sceneId}.png` : undefined,
        durationInSeconds: ttsResult.durationSeconds,
        motion: selectedMotion,
        transition: selectedTransition as TransitionEffect,
      });
    }

    await storage.updateVideoProject(project.id, {
      progress: 80,
      progressMessage: "Rendering video...",
    });

    const manifest: VideoManifest = {
      fps: 30,
      width: resConfig.width,
      height: resConfig.height,
      scenes: generatedScenes,
      transitionDuration: settings.transitionSettings.transitionDuration,
    };

    const manifestPath = path.join(projectDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const outputFilename = `video-${project.id.slice(0, 8)}.mp4`;
    const outputPath = `/assets/${project.id}/${outputFilename}`;

    const renderResult = await renderVideo({
      manifest,
      outputPath,
      projectDir,
    });

    if (renderResult.success) {
      const sceneDurations = generatedScenes.map(s => s.durationInSeconds || 5);
      const totalDuration = sceneDurations.reduce((a, b) => a + b, 0);
      const chapters = generateChapters(generatedScenes, sceneDurations);

      const thumbnailPath = `/assets/${project.id}/thumbnail.jpg`;
      await generateThumbnail(outputPath, thumbnailPath, 1);

      await storage.updateVideoProject(project.id, {
        status: "ready",
        progress: 100,
        progressMessage: "Video complete!",
        manifest: manifest,
        outputPath,
        thumbnailPath,
        chapters: chapters,
        totalDuration,
      });

      await storage.incrementUsage('video', 1);
      await storage.incrementUsage('script', 1);
      await storage.incrementUsage('render', 1, totalDuration);
      await storage.incrementUsage('image', generatedScenes.length);
      await storage.incrementUsage('audio', generatedScenes.length);

      logInfo("QUEUE", `Project completed: ${project.id}`);
    } else {
      await storage.updateVideoProject(project.id, {
        status: "error",
        progress: 0,
        errorMessage: renderResult.error || "Rendering failed",
      });
      logError("QUEUE", `Project failed: ${project.id}`, new Error(renderResult.error));
    }
  } catch (error) {
    logError("QUEUE", `Project error: ${project.id}`, error);
    await storage.updateVideoProject(project.id, {
      status: "error",
      progress: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function processQueue() {
  if (isProcessing || processingQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (processingQueue.length > 0) {
    const item = processingQueue.shift();
    if (item) {
      if (item.type === "script") {
        await processScriptProject(item);
      } else {
        await processProject(item);
      }
    }
  }

  isProcessing = false;
}

export async function addToQueue(projectData: Omit<QueuedProject, "id">): Promise<string> {
  const project = await storage.createVideoProject({
    title: projectData.topic.slice(0, 50),
    script: "",
    status: "draft",
    voiceId: projectData.voiceId,
    imageStyle: projectData.imageStyle,
    manifest: null,
    outputPath: null,
  });

  const queuedProject: QueueItem = {
    type: "topic",
    id: project.id,
    ...projectData,
  };

  processingQueue.push(queuedProject);
  logInfo("QUEUE", `Added project to queue: ${project.id}`, { position: processingQueue.length });

  setTimeout(() => processQueue(), 100);

  return project.id;
}

export async function addScriptToQueue(projectData: Omit<ScriptQueuedProject, "id">): Promise<string> {
  const project = await storage.createVideoProject({
    title: projectData.title || "Untitled Video",
    script: projectData.script,
    status: "queued",
    voiceId: projectData.voiceId,
    imageStyle: projectData.imageStyle,
    manifest: null,
    outputPath: null,
  });

  const queuedProject: QueueItem = {
    type: "script",
    id: project.id,
    ...projectData,
  };

  processingQueue.push(queuedProject);
  logInfo("QUEUE", `Added script project to queue: ${project.id}`, { position: processingQueue.length });

  setTimeout(() => processQueue(), 100);

  return project.id;
}

export function getQueueStatus(): { queueLength: number; isProcessing: boolean; projects: string[] } {
  return {
    queueLength: processingQueue.length,
    isProcessing,
    projects: processingQueue.map(p => p.id),
  };
}
