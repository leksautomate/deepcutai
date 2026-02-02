import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { VideoManifest, Scene, MotionEffect, TransitionEffect } from "@shared/schema";
import { logError, logInfo, logWarning } from "./logger";

interface RenderOptions {
  manifest: VideoManifest;
  outputPath: string;
  projectDir: string;
  exportQuality?: {
    width: number;
    height: number;
    bitrate: string;
  };
}

interface RenderResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

function runFFmpeg(args: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        logError("FFmpeg", "FFmpeg command failed", undefined, { stderr: stderr.slice(-500) });
        resolve({ success: false, error: stderr });
      }
    });

    ffmpeg.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

function getMotionFilter(motion: MotionEffect | undefined, duration: number, width: number, height: number): string {
  const zoomStart = 1.0;
  const zoomEnd = 1.25;
  const fps = 30;
  const frames = Math.ceil(duration * fps);
  const zoomIncrement = (zoomEnd - zoomStart) / frames;
  const maxFrames = Math.max(1, frames - 1);

  switch (motion) {
    case "zoom-in":
      return `scale=8000:-1,zoompan=z='min(zoom+${zoomIncrement},${zoomEnd})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case "zoom-out":
      return `scale=8000:-1,zoompan=z='if(lte(zoom,${zoomStart}),${zoomEnd},max(${zoomStart},zoom-${zoomIncrement}))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case "pan-left":
      return `scale=8000:-1,zoompan=z='${zoomEnd}':x='min(iw-iw/zoom,max(0,(iw-iw/zoom)*(1-min(1,on/${maxFrames}))))':y='(ih-ih/zoom)/2':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case "pan-right":
      return `scale=8000:-1,zoompan=z='${zoomEnd}':x='min(iw-iw/zoom,max(0,(iw-iw/zoom)*min(1,on/${maxFrames})))':y='(ih-ih/zoom)/2':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case "pan-up":
      return `scale=8000:-1,zoompan=z='${zoomEnd}':x='(iw-iw/zoom)/2':y='min(ih-ih/zoom,max(0,(ih-ih/zoom)*(1-min(1,on/${maxFrames}))))':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case "pan-down":
      return `scale=8000:-1,zoompan=z='${zoomEnd}':x='(iw-iw/zoom)/2':y='min(ih-ih/zoom,max(0,(ih-ih/zoom)*min(1,on/${maxFrames})))':d=${frames}:s=${width}x${height}:fps=${fps}`;
    default:
      return `scale=8000:-1,zoompan=z='min(zoom+${zoomIncrement},${zoomEnd})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
  }
}

async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      audioPath,
    ]);

    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.on("close", () => {
      const duration = parseFloat(output.trim());
      resolve(isNaN(duration) ? 5 : duration);
    });

    ffprobe.on("error", () => {
      resolve(5);
    });
  });
}

async function createSceneVideo(
  scene: Scene,
  projectDir: string,
  index: number,
  width: number,
  height: number
): Promise<{ success: boolean; videoPath?: string; duration?: number; error?: string }> {
  const imageFile = scene.imageFile ? path.join(process.cwd(), "public", scene.imageFile) : null;
  const audioFile = scene.audioFile ? path.join(process.cwd(), "public", scene.audioFile) : null;

  if (!imageFile || !fs.existsSync(imageFile)) {
    logError("render", `Image file not found for scene ${scene.id}`, undefined, { sceneId: scene.id, imageFile: scene.imageFile });
    return { success: false, error: `Image file not found for scene ${scene.id}` };
  }

  // Get actual audio duration if audio exists, otherwise use scene duration
  let duration = scene.durationInSeconds || 5;
  if (audioFile && fs.existsSync(audioFile)) {
    const audioDuration = await getAudioDuration(audioFile);
    // Use audio duration + small buffer to ensure audio completes fully
    duration = Math.max(duration, audioDuration + 0.1);
    logInfo("Render", `Scene ${index}: Using audio duration ${audioDuration.toFixed(2)}s (+ 0.1s buffer)`);
  }

  const sceneVideoPath = path.join(projectDir, `scene-${index}-video.mp4`);
  const motionFilter = getMotionFilter(scene.motion, duration, width, height);

  const videoArgs = [
    "-y",
    "-loop", "1",
    "-i", imageFile,
    "-vf", motionFilter,
    "-t", duration.toString(),
    "-pix_fmt", "yuv420p",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-profile:v", "high",
    "-level", "4.2",
    sceneVideoPath,
  ];

  const videoResult = await runFFmpeg(videoArgs);
  if (!videoResult.success) {
    return { success: false, error: videoResult.error };
  }

  if (audioFile && fs.existsSync(audioFile)) {
    const sceneWithAudioPath = path.join(projectDir, `scene-${index}-with-audio.mp4`);
    const audioArgs = [
      "-y",
      "-i", sceneVideoPath,
      "-i", audioFile,
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "256k",
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-shortest",
      sceneWithAudioPath,
    ];

    const audioResult = await runFFmpeg(audioArgs);
    if (audioResult.success) {
      fs.unlinkSync(sceneVideoPath);
      return { success: true, videoPath: sceneWithAudioPath, duration };
    }
  }

  return { success: true, videoPath: sceneVideoPath, duration };
}

function getTransitionFilter(transition: TransitionEffect | undefined): string {
  switch (transition) {
    case "fade":
      return "fade";
    case "dissolve":
      return "dissolve";
    case "wipe-left":
      return "wipeleft";
    case "wipe-right":
      return "wiperight";
    case "wipe-up":
      return "wipeup";
    case "wipe-down":
      return "wipedown";
    default:
      return "fade";
  }
}

export async function renderVideo(options: RenderOptions): Promise<RenderResult> {
  const { manifest, outputPath, projectDir, exportQuality } = options;
  const { scenes } = manifest;
  const transitionDuration = manifest.transitionDuration || 0.5;

  // Use export quality settings if provided, otherwise use manifest dimensions
  const width = exportQuality?.width || manifest.width;
  const height = exportQuality?.height || manifest.height;
  const bitrate = exportQuality?.bitrate || "8M";

  if (!scenes || scenes.length === 0) {
    return { success: false, error: "No scenes in manifest" };
  }

  logInfo("Render", `Rendering video with ${scenes.length} scenes at ${width}x${height}`);

  const sceneVideos: string[] = [];
  const sceneDurations: number[] = [];

  const failedScenes: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    logInfo("Render", `Processing scene ${i + 1}/${scenes.length}: ${scene.id}`);

    const result = await createSceneVideo(scene, projectDir, i, width, height);
    if (!result.success || !result.videoPath) {
      logError("Render", `Failed to create scene ${i + 1}`, undefined, { error: result.error });
      failedScenes.push(`Scene ${i + 1}: ${result.error}`);
      logWarning("render", `Failed to create scene ${i + 1}`, { sceneId: scene.id, error: result.error, imageFile: scene.imageFile, audioFile: scene.audioFile });
      continue;
    }
    sceneVideos.push(result.videoPath);
    // Use actual duration from createSceneVideo (includes audio duration + buffer)
    sceneDurations.push(result.duration || scene.durationInSeconds || 5);
  }

  if (sceneVideos.length === 0) {
    const errorMsg = `No scene videos were created. Failed scenes: ${failedScenes.join("; ")}`;
    logError("render", errorMsg, undefined, { totalScenes: scenes.length, failedScenes });
    return { success: false, error: errorMsg };
  }

  const fullOutputPath = path.join(process.cwd(), "public", outputPath);
  const outputDir = path.dirname(fullOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let concatResult: { success: boolean; error?: string };

  const hasTransitions = scenes.some(s => s.transition && s.transition !== "none");

  if (hasTransitions && sceneVideos.length > 1) {
    logInfo("Render", "Rendering with transitions...");

    const inputs = sceneVideos.map(v => ["-i", v]).flat();

    let filterComplex = "";
    let currentOutput = "[0:v]";
    let clipEndTime = sceneDurations[0];

    for (let i = 1; i < sceneVideos.length; i++) {
      const transition = scenes[i - 1].transition || "fade";
      const transitionType = getTransitionFilter(transition);
      const offset = Math.max(0, clipEndTime - transitionDuration);
      const isLastTransition = i === sceneVideos.length - 1;
      const outputLabel = isLastTransition ? "[vtrans]" : `[v${i}]`;

      filterComplex += `${currentOutput}[${i}:v]xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${offset}${outputLabel};`;
      currentOutput = outputLabel;
      clipEndTime = offset + sceneDurations[i];
    }

    // Add scale filter for final output
    filterComplex += `[vtrans]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[vout];`;

    const hasAudio = sceneVideos.some((_v, i) => {
      const scene = scenes[i];
      return scene?.audioFile;
    });

    let transitionArgs: string[];

    if (hasAudio) {
      // Audio must match video xfade timing - each scene audio plays at the correct offset
      // Calculate audio delays to match xfade offsets
      const audioFilters: string[] = [];
      const audioLabels: string[] = [];
      
      for (let i = 0; i < sceneVideos.length; i++) {
        if (scenes[i]?.audioFile) {
          if (i === 0) {
            // First audio starts at 0
            audioFilters.push(`[${i}:a]asetpts=PTS-STARTPTS[a${i}]`);
          } else {
            // Subsequent audio delayed to match xfade offset
            // Calculate the offset: previous end time minus transition overlap
            let prevEnd = 0;
            for (let j = 0; j < i; j++) {
              prevEnd += sceneDurations[j];
              if (j < i - 1) {
                prevEnd -= transitionDuration;
              }
            }
            prevEnd -= transitionDuration; // Account for current transition overlap
            const delayMs = Math.max(0, Math.round(prevEnd * 1000));
            audioFilters.push(`[${i}:a]asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs}[a${i}]`);
          }
          audioLabels.push(`[a${i}]`);
        }
      }
      
      if (audioLabels.length > 0) {
        // Mix all audio streams together (they're already delayed to correct positions)
        filterComplex += audioFilters.join(';') + ';';
        filterComplex += `${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[aout]`;
      } else {
        filterComplex += `anullsrc=r=44100:cl=stereo[aout]`;
      }

      transitionArgs = [
        "-y",
        ...inputs,
        "-filter_complex", filterComplex,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-b:a", "256k",
        "-b:v", bitrate,
        "-preset", "medium",
        "-profile:v", "high",
        "-level", "4.2",
        "-movflags", "+faststart",
        fullOutputPath,
      ];
    } else {
      // Remove trailing semicolon for video-only output
      const videoFilterComplex = filterComplex.endsWith(";") ? filterComplex.slice(0, -1) : filterComplex;
      transitionArgs = [
        "-y",
        ...inputs,
        "-filter_complex", videoFilterComplex,
        "-map", "[vout]",
        "-c:v", "libx264",
        "-b:v", bitrate,
        "-preset", "medium",
        "-profile:v", "high",
        "-level", "4.2",
        "-movflags", "+faststart",
        fullOutputPath,
      ];
    }

    concatResult = await runFFmpeg(transitionArgs);

    if (!concatResult.success) {
      logWarning("Render", "Transition rendering failed, falling back to simple concat");
      const concatListPath = path.join(projectDir, "concat-list.txt");
      const concatListContent = sceneVideos.map((v) => `file '${v}'`).join("\n");
      fs.writeFileSync(concatListPath, concatListContent);

      const fallbackArgs = [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatListPath,
        "-c:v", "libx264",
        "-c:a", "aac",
        "-b:a", "256k",
        "-b:v", bitrate,
        "-vf", `scale=${width}:${height}`,
        "-preset", "medium",
        "-profile:v", "high",
        "-level", "4.2",
        "-movflags", "+faststart",
        fullOutputPath,
      ];
      concatResult = await runFFmpeg(fallbackArgs);
      fs.unlinkSync(concatListPath);
    }
  } else {
    const concatListPath = path.join(projectDir, "concat-list.txt");
    const concatListContent = sceneVideos.map((v) => `file '${v}'`).join("\n");
    fs.writeFileSync(concatListPath, concatListContent);

    const concatArgs = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c:v", "libx264",
      "-c:a", "aac",
      "-b:a", "256k",
      "-b:v", bitrate,
      "-vf", `scale=${width}:${height}`,
      "-preset", "medium",
      "-profile:v", "high",
      "-level", "4.2",
      "-movflags", "+faststart",
      fullOutputPath,
    ];

    logInfo("Render", "Concatenating scene videos...");
    concatResult = await runFFmpeg(concatArgs);
    fs.unlinkSync(concatListPath);
  }

  for (const videoPath of sceneVideos) {
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
  }

  if (!concatResult.success) {
    return { success: false, error: concatResult.error };
  }

  logInfo("Render", `Video rendered successfully: ${outputPath}`);
  return { success: true, outputPath };
}

export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timestamp: number = 1
): Promise<{ success: boolean; thumbnailPath?: string; error?: string }> {
  const fullVideoPath = path.join(process.cwd(), "public", videoPath);
  const fullOutputPath = path.join(process.cwd(), "public", outputPath);

  const outputDir = path.dirname(fullOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const args = [
    "-y",
    "-i", fullVideoPath,
    "-ss", timestamp.toString(),
    "-vframes", "1",
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
    "-q:v", "2",
    fullOutputPath,
  ];

  const result = await runFFmpeg(args);

  if (result.success) {
    logInfo("Render", `Thumbnail generated: ${outputPath}`);
    return { success: true, thumbnailPath: outputPath };
  }

  return { success: false, error: result.error };
}

export async function concatenateVideos(
  videoPaths: string[],
  outputPath: string
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  if (videoPaths.length === 0) {
    return { success: false, error: "No videos to concatenate" };
  }

  const fullOutputPath = path.join(process.cwd(), "public", outputPath);
  const outputDir = path.dirname(fullOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const concatListPath = path.join(outputDir, "concat-list.txt");
  const concatListContent = videoPaths
    .map(v => `file '${path.join(process.cwd(), "public", v)}'`)
    .join("\n");
  fs.writeFileSync(concatListPath, concatListContent);

  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatListPath,
    "-c:v", "libx264",
    "-c:a", "aac",
    "-b:a", "256k",
    "-preset", "medium",
    "-crf", "18",
    "-profile:v", "high",
    "-level", "4.2",
    "-movflags", "+faststart",
    fullOutputPath,
  ];

  const result = await runFFmpeg(args);
  fs.unlinkSync(concatListPath);

  if (result.success) {
    logInfo("Render", `Videos concatenated: ${outputPath}`);
    return { success: true, outputPath };
  }

  return { success: false, error: result.error };
}

export function generateChapters(
  scenes: Scene[],
  sceneDurations: number[]
): { title: string; startTime: number; endTime: number }[] {
  const chapters: { title: string; startTime: number; endTime: number }[] = [];
  let currentTime = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const duration = sceneDurations[i] || scene.durationInSeconds || 5;

    chapters.push({
      title: `Scene ${i + 1}`,
      startTime: currentTime,
      endTime: currentTime + duration,
    });

    currentTime += duration;
  }

  return chapters;
}
