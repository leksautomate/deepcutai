import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { VideoManifest, Scene, MotionEffect, TransitionEffect } from "@shared/schema";

interface RenderOptions {
  manifest: VideoManifest;
  outputPath: string;
  projectDir: string;
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
        console.error("FFmpeg error:", stderr);
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
    return { success: false, error: `Image file not found for scene ${scene.id}` };
  }

  // Get actual audio duration if audio exists, otherwise use scene duration
  let duration = scene.durationInSeconds || 5;
  if (audioFile && fs.existsSync(audioFile)) {
    const audioDuration = await getAudioDuration(audioFile);
    // Use audio duration + small buffer to ensure audio completes fully
    duration = Math.max(duration, audioDuration + 0.1);
    console.log(`Scene ${index}: Using audio duration ${audioDuration.toFixed(2)}s (+ 0.1s buffer)`);
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
    // Use audio as the primary duration source - video already matches audio length
    const audioArgs = [
      "-y",
      "-i", sceneVideoPath,
      "-i", audioFile,
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "256k",
      "-map", "0:v:0",
      "-map", "1:a:0",
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
  const { manifest, outputPath, projectDir } = options;
  const { width, height, scenes } = manifest;
  const transitionDuration = manifest.transitionDuration || 0.5;

  if (!scenes || scenes.length === 0) {
    return { success: false, error: "No scenes in manifest" };
  }

  console.log(`Rendering video with ${scenes.length} scenes at ${width}x${height}`);

  const sceneVideos: string[] = [];
  const sceneDurations: number[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    console.log(`Processing scene ${i + 1}/${scenes.length}: ${scene.id}`);

    const result = await createSceneVideo(scene, projectDir, i, width, height);
    if (!result.success || !result.videoPath) {
      console.error(`Failed to create scene ${i + 1}: ${result.error}`);
      continue;
    }
    sceneVideos.push(result.videoPath);
    // Use actual duration from createSceneVideo (includes audio duration + buffer)
    sceneDurations.push(result.duration || scene.durationInSeconds || 5);
  }

  if (sceneVideos.length === 0) {
    return { success: false, error: "No scene videos were created" };
  }

  const fullOutputPath = path.join(process.cwd(), "public", outputPath);
  const outputDir = path.dirname(fullOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let concatResult: { success: boolean; error?: string };

  const hasTransitions = scenes.some(s => s.transition && s.transition !== "none");

  if (hasTransitions && sceneVideos.length > 1) {
    console.log("Rendering with transitions...");
    
    const inputs = sceneVideos.map(v => ["-i", v]).flat();
    
    let filterComplex = "";
    let currentOutput = "[0:v]";
    let clipEndTime = sceneDurations[0];
    
    for (let i = 1; i < sceneVideos.length; i++) {
      const transition = scenes[i - 1].transition || "fade";
      const transitionType = getTransitionFilter(transition);
      const offset = Math.max(0, clipEndTime - transitionDuration);
      const outputLabel = i === sceneVideos.length - 1 ? "[vout]" : `[v${i}]`;
      
      filterComplex += `${currentOutput}[${i}:v]xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${offset}${outputLabel};`;
      currentOutput = outputLabel;
      clipEndTime = offset + sceneDurations[i];
    }
    
    const hasAudio = sceneVideos.some((v, i) => {
      const scene = scenes[i];
      return scene?.audioFile;
    });

    let transitionArgs: string[];

    if (hasAudio) {
      const audioFilters: string[] = [];
      for (let i = 0; i < sceneVideos.length; i++) {
        if (scenes[i]?.audioFile) {
          audioFilters.push(`[${i}:a]`);
        } else {
          filterComplex += `anullsrc=r=44100:cl=stereo,atrim=0:${sceneDurations[i]}[sil${i}];`;
          audioFilters.push(`[sil${i}]`);
        }
      }
      filterComplex += `${audioFilters.join("")}concat=n=${sceneVideos.length}:v=0:a=1[aout]`;

      transitionArgs = [
        "-y",
        ...inputs,
        "-filter_complex", filterComplex,
        "-map", "[vout]",
        "-map", "[aout]",
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
    } else {
      transitionArgs = [
        "-y",
        ...inputs,
        "-filter_complex", filterComplex.slice(0, -1),
        "-map", "[vout]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-profile:v", "high",
        "-level", "4.2",
        "-movflags", "+faststart",
        fullOutputPath,
      ];
    }

    concatResult = await runFFmpeg(transitionArgs);

    if (!concatResult.success) {
      console.log("Transition rendering failed, falling back to simple concat");
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
        "-preset", "medium",
        "-crf", "18",
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
      "-preset", "medium",
      "-crf", "18",
      "-profile:v", "high",
      "-level", "4.2",
      "-movflags", "+faststart",
      fullOutputPath,
    ];

    console.log("Concatenating scene videos...");
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

  console.log(`Video rendered successfully: ${outputPath}`);
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
    console.log(`Thumbnail generated: ${outputPath}`);
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
    console.log(`Videos concatenated: ${outputPath}`);
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
