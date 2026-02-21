import { storage } from "../storage";
import { logInfo, logWarning, logError } from "./logger";
import { ProjectController } from "../controllers/ProjectController";
import { getAppSettings, splitScriptIntoScenes } from "./settings";
import * as path from "path";
import * as fs from "fs";

const ASSETS_DIR = path.join(process.cwd(), "public", "assets");

/**
 * On server startup, find projects stuck in "generating" status
 * and resume them from the last completed scene.
 */
export async function resumeIncompleteJobs(): Promise<void> {
    try {
        const allProjects = await storage.getAllVideoProjects();
        const stuckProjects = allProjects.filter(p => p.status === "generating");

        if (stuckProjects.length === 0) {
            logInfo("RESUME", "No interrupted jobs found");
            return;
        }

        logWarning("RESUME", `Found ${stuckProjects.length} interrupted job(s), attempting to resume...`);

        for (const project of stuckProjects) {
            try {
                await resumeProject(project);
            } catch (error) {
                logError("RESUME", `Failed to resume project ${project.id}`, error as Error);
                await storage.updateVideoProject(project.id, {
                    status: "error",
                    errorMessage: `Resume failed: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }
    } catch (error) {
        logError("RESUME", "Failed to check for interrupted jobs", error as Error);
    }
}

async function resumeProject(project: any): Promise<void> {
    const projectDir = path.join(ASSETS_DIR, project.id);

    if (!fs.existsSync(projectDir)) {
        logWarning("RESUME", `No assets directory for project ${project.id}, marking as error`);
        await storage.updateVideoProject(project.id, {
            status: "error",
            errorMessage: "Assets directory missing after crash"
        });
        return;
    }

    // Determine how many scenes we have by splitting the script
    const appSettings = getAppSettings();
    const scenesText = await splitScriptIntoScenes(project.script, appSettings.sceneSettings);
    const totalScenes = scenesText.length;

    // Find the last fully completed scene (has BOTH audio + visual)
    let completedScenes = 0;
    for (let i = 0; i < totalScenes; i++) {
        const sceneId = `scene-${i + 1}`;
        const hasAudio = fs.existsSync(path.join(projectDir, `${sceneId}.mp3`));
        const hasImage = fs.existsSync(path.join(projectDir, `${sceneId}.png`));
        const hasVideo = fs.existsSync(path.join(projectDir, `${sceneId}.mp4`));

        if (hasAudio && (hasImage || hasVideo)) {
            completedScenes = i + 1;
        } else {
            break; // Stop at first incomplete scene
        }
    }

    if (completedScenes >= totalScenes) {
        // All scenes completed, just need to rebuild manifest and render
        logInfo("RESUME", `All ${totalScenes} scenes already done for ${project.id}, rebuilding manifest`);
        completedScenes = totalScenes; // Will skip the scene loop entirely
    }

    logInfo("RESUME", `Resuming project ${project.id}: ${completedScenes}/${totalScenes} scenes done`, {
        title: project.title,
    });

    // Update status to show we're resuming
    await storage.updateVideoProject(project.id, {
        progressMessage: `Resuming from scene ${completedScenes + 1}/${totalScenes}...`,
    });

    // Reconstruct the generation body from stored project data
    const body = {
        script: project.script,
        voiceId: project.voiceId || "Dennis",
        imageStyle: project.imageStyle || "cinematic",
        customStyleText: project.customStyleText || undefined,
        resolution: project.resolution || "1080p",
        imageGenerator: project.imageGenerator || undefined,
        videoGenerator: project.videoGenerator || undefined,
        ttsProvider: project.ttsProvider || "inworld",
    };

    // Create a controller instance and resume generation
    const controller = new ProjectController();
    controller.runBackgroundGeneration(project.id, body, "system", completedScenes).catch(async (err) => {
        logError("RESUME", `Resumed generation failed for project ${project.id}`, err);
        const existingProject = await storage.getVideoProject(project.id);
        if (!existingProject?.errorMessage) {
            await storage.updateVideoProject(project.id, {
                status: "error",
                errorMessage: `Resume failed: ${err instanceof Error ? err.message : String(err)}`
            });
        }
    });
}
