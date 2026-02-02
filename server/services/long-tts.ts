import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { getResolvedApiKey } from "./api-keys";
import { nanoid } from "nanoid";
import { logInfo, logError, logWarning } from "./logger";

const INWORLD_API_URL = "https://api.inworld.ai/tts/v1/voice";
const MAX_CHUNK_SIZE = 1900; // API limit is 2000, leave buffer

export interface CustomVoice {
  id: string;
  voiceId: string;
  name: string;
  createdAt: string;
}

export interface LongTTSOptions {
  text: string;
  voiceId: string;
  topic?: string; // Optional topic for output filename
  outputDir?: string;
  removeSilence?: boolean;
  silenceThreshold?: number; // dB threshold for silence detection
  minSilenceDuration?: number; // minimum silence duration to remove (seconds)
}

export interface LongTTSResult {
  success: boolean;
  audioPath?: string;
  durationSeconds?: number;
  chunksProcessed?: number;
  error?: string;
}

interface ChunkResult {
  buffer: Buffer;
  duration: number;
  success: boolean;
}

/**
 * Splits text into chunks at sentence boundaries, respecting the max size limit.
 */
function splitTextIntoChunks(text: string): string[] {
  const chunks: string[] = [];

  // Split by sentence-ending punctuation while keeping the punctuation
  const sentences = text.split(/(?<=[.!?])\s+/);

  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // If single sentence is too long, split by commas or spaces
    if (trimmedSentence.length > MAX_CHUNK_SIZE) {
      // First, save current chunk if exists
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      // Split long sentence by clauses (commas)
      const clauses = trimmedSentence.split(/(?<=,)\s*/);
      let clauseChunk = "";

      for (const clause of clauses) {
        if ((clauseChunk + " " + clause).length <= MAX_CHUNK_SIZE) {
          clauseChunk = clauseChunk ? clauseChunk + " " + clause : clause;
        } else {
          if (clauseChunk) {
            chunks.push(clauseChunk.trim());
          }
          // If single clause is still too long, split by words
          if (clause.length > MAX_CHUNK_SIZE) {
            const words = clause.split(/\s+/);
            let wordChunk = "";
            for (const word of words) {
              if ((wordChunk + " " + word).length <= MAX_CHUNK_SIZE) {
                wordChunk = wordChunk ? wordChunk + " " + word : word;
              } else {
                if (wordChunk) chunks.push(wordChunk.trim());
                wordChunk = word;
              }
            }
            if (wordChunk) clauseChunk = wordChunk;
          } else {
            clauseChunk = clause;
          }
        }
      }
      if (clauseChunk) {
        currentChunk = clauseChunk;
      }
    } else if ((currentChunk + " " + trimmedSentence).length <= MAX_CHUNK_SIZE) {
      currentChunk = currentChunk ? currentChunk + " " + trimmedSentence : trimmedSentence;
    } else {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Generates TTS for a single chunk using Inworld API.
 */
async function generateChunkTTS(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<ChunkResult> {
  try {
    const response = await fetch(INWORLD_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        voiceId: voiceId,
        modelId: "inworld-tts-1.5-max",
        timestampType: "WORD",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError("LongTTS", "Inworld TTS API error", undefined, { status: response.status, error: errorText.slice(0, 200) });
      return { buffer: Buffer.alloc(0), duration: 0, success: false };
    }

    const data = await response.json() as {
      audioContent: string;
      timestampInfo?: {
        wordAlignment?: {
          wordEndTimeSeconds: number[];
        };
      };
    };

    if (!data.audioContent) {
      logError("LongTTS", "No audioContent in response");
      return { buffer: Buffer.alloc(0), duration: 0, success: false };
    }

    const buffer = Buffer.from(data.audioContent, "base64");

    // Get duration from word alignment if available
    let duration = 0;
    const wordAlignment = data.timestampInfo?.wordAlignment;
    if (wordAlignment && wordAlignment.wordEndTimeSeconds.length > 0) {
      duration = wordAlignment.wordEndTimeSeconds[wordAlignment.wordEndTimeSeconds.length - 1];
    } else {
      // Estimate duration from text length
      const words = text.split(/\s+/).length;
      duration = (words / 150) * 60; // ~150 words per minute
    }

    return { buffer, duration, success: true };
  } catch (error) {
    logError("LongTTS", "Chunk TTS error", error);
    return { buffer: Buffer.alloc(0), duration: 0, success: false };
  }
}

/**
 * Runs FFmpeg command and returns result.
 */
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
        logError("LongTTS", "FFmpeg error", undefined, { stderr: stderr.slice(-500) });
        resolve({ success: false, error: stderr });
      }
    });

    ffmpeg.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Gets audio duration using ffprobe.
 */
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
      resolve(isNaN(duration) ? 0 : duration);
    });

    ffprobe.on("error", () => {
      resolve(0);
    });
  });
}

/**
 * Removes silence from audio using FFmpeg silenceremove filter.
 */
async function removeSilenceFromAudio(
  inputPath: string,
  outputPath: string,
  threshold: number = -40,
  minDuration: number = 0.5
): Promise<{ success: boolean; error?: string }> {
  const args = [
    "-y",
    "-i", inputPath,
    "-af", `silenceremove=start_periods=1:start_duration=0:start_threshold=${threshold}dB:detection=peak,aformat=dblp,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=${threshold}dB:detection=peak,aformat=dblp,areverse,silenceremove=stop_periods=-1:stop_duration=${minDuration}:stop_threshold=${threshold}dB`,
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    outputPath,
  ];

  return runFFmpeg(args);
}

/**
 * Concatenates two audio files with crossfade using FFmpeg.
 */
async function crossfadeTwoFiles(
  input1: string,
  input2: string,
  outputPath: string,
  crossfadeDuration: number = 0.2
): Promise<{ success: boolean; error?: string }> {
  // Use acrossfade filter for smooth transition
  const args = [
    "-y",
    "-i", input1,
    "-i", input2,
    "-filter_complex", `[0:a][1:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri`,
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    outputPath,
  ];

  return runFFmpeg(args);
}

/**
 * Concatenates multiple audio files with crossfade between each pair.
 * Uses iterative merging for 3+ files.
 */
async function concatenateAudioFiles(
  inputPaths: string[],
  outputPath: string,
  crossfadeDuration: number = 0.2
): Promise<{ success: boolean; error?: string }> {
  if (inputPaths.length === 0) {
    return { success: false, error: "No input files provided" };
  }

  if (inputPaths.length === 1) {
    // Just copy the single file
    const args = [
      "-y",
      "-i", inputPaths[0],
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      outputPath,
    ];
    return runFFmpeg(args);
  }

  if (inputPaths.length === 2) {
    // Direct crossfade for 2 files
    return crossfadeTwoFiles(inputPaths[0], inputPaths[1], outputPath, crossfadeDuration);
  }

  // For 3+ files, iteratively merge pairs
  const outputDir = path.dirname(outputPath);
  let currentMerged = inputPaths[0];
  let tempCounter = 0;

  for (let i = 1; i < inputPaths.length; i++) {
    const isLast = i === inputPaths.length - 1;
    const nextOutput = isLast
      ? outputPath
      : path.join(outputDir, `merge-temp-${tempCounter++}-${nanoid(4)}.mp3`);

    const result = await crossfadeTwoFiles(
      currentMerged,
      inputPaths[i],
      nextOutput,
      crossfadeDuration
    );

    if (!result.success) {
      return result;
    }

    // Clean up previous temp file (if not original chunk)
    if (!inputPaths.includes(currentMerged) && fs.existsSync(currentMerged)) {
      fs.unlinkSync(currentMerged);
    }

    currentMerged = nextOutput;
  }

  return { success: true };
}

/**
 * Generates long-form TTS by splitting text, processing chunks, and joining audio.
 */
// Helper to generate safe filename from topic or text
function generateSafeFilename(topic?: string, text?: string): string {
  let baseName = "";
  if (topic && topic.trim()) {
    baseName = topic.trim();
  } else if (text) {
    // Use first 5 words of text if no topic
    baseName = text.trim().split(/\s+/).slice(0, 5).join(' ');
  }
  // Sanitize: remove special characters, limit length
  const sanitized = baseName
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 50);
  return sanitized || `tts-${nanoid(6)}`;
}

export async function generateLongTTS(options: LongTTSOptions): Promise<LongTTSResult> {
  const {
    text,
    voiceId,
    topic,
    outputDir = path.join(process.cwd(), "public", "tts-output"),
    removeSilence = true,
    silenceThreshold = -40,
    minSilenceDuration = 0.3,
  } = options;

  const apiKey = await getResolvedApiKey("inworld");
  if (!apiKey) {
    return { success: false, error: "Inworld API key not configured" };
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sessionId = nanoid(10);
  const tempDir = path.join(outputDir, `temp-${sessionId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Split text into chunks
    const chunks = splitTextIntoChunks(text);
    logInfo("LongTTS", `Processing ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return { success: false, error: "No valid text to process" };
    }

    const chunkPaths: string[] = [];
    let totalDuration = 0;
    let successCount = 0;

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logInfo("LongTTS", `Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);

      const result = await generateChunkTTS(chunk, voiceId, apiKey);

      if (result.success && result.buffer.length > 0) {
        const chunkPath = path.join(tempDir, `chunk-${i.toString().padStart(4, "0")}.mp3`);
        fs.writeFileSync(chunkPath, result.buffer);
        chunkPaths.push(chunkPath);
        totalDuration += result.duration;
        successCount++;
      } else {
        logError("LongTTS", `Failed to generate chunk ${i + 1}`);
      }

      // Small delay between API calls to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (chunkPaths.length === 0) {
      return { success: false, error: "Failed to generate any audio chunks" };
    }

    // Concatenate all chunks
    const concatenatedPath = path.join(tempDir, "concatenated.mp3");
    const concatResult = await concatenateAudioFiles(chunkPaths, concatenatedPath);

    if (!concatResult.success) {
      return { success: false, error: `Failed to concatenate audio: ${concatResult.error}` };
    }

    // Final output path - use topic/text for filename
    const safeBaseName = generateSafeFilename(topic, text);
    const finalFilename = `${safeBaseName}-${sessionId}.mp3`;
    let finalPath = path.join(outputDir, finalFilename);

    // Remove silence if requested
    if (removeSilence) {
      logInfo("LongTTS", "Removing silence...");
      const silenceResult = await removeSilenceFromAudio(
        concatenatedPath,
        finalPath,
        silenceThreshold,
        minSilenceDuration
      );

      if (!silenceResult.success) {
        logWarning("LongTTS", "Silence removal failed, using concatenated audio");
        fs.copyFileSync(concatenatedPath, finalPath);
      }
    } else {
      fs.copyFileSync(concatenatedPath, finalPath);
    }

    // Get final duration
    const finalDuration = await getAudioDuration(finalPath);

    // Clean up temp files
    for (const chunkPath of chunkPaths) {
      if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }
    if (fs.existsSync(concatenatedPath)) fs.unlinkSync(concatenatedPath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);

    // Return relative path for serving
    const relativePath = `/tts-output/${finalFilename}`;

    logInfo("LongTTS", `Complete: ${successCount}/${chunks.length} chunks, ${finalDuration.toFixed(1)}s`);

    return {
      success: true,
      audioPath: relativePath,
      durationSeconds: finalDuration,
      chunksProcessed: successCount,
    };
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError("LongTTS", "Error occurred", undefined, { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

// Custom voices storage (in-memory for now, could be moved to database)
const customVoicesFile = path.join(process.cwd(), "data", "custom-voices.json");

function ensureDataDir() {
  const dataDir = path.dirname(customVoicesFile);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function getCustomVoices(): CustomVoice[] {
  try {
    ensureDataDir();
    if (fs.existsSync(customVoicesFile)) {
      const data = fs.readFileSync(customVoicesFile, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    logError("LongTTS", "Error reading custom voices file", error);
  }
  return [];
}

export function addCustomVoice(voiceId: string, name: string): CustomVoice {
  const voices = getCustomVoices();
  const newVoice: CustomVoice = {
    id: nanoid(10),
    voiceId,
    name,
    createdAt: new Date().toISOString(),
  };
  voices.push(newVoice);

  ensureDataDir();
  fs.writeFileSync(customVoicesFile, JSON.stringify(voices, null, 2));

  return newVoice;
}

export function deleteCustomVoice(id: string): boolean {
  const voices = getCustomVoices();
  const index = voices.findIndex(v => v.id === id);
  if (index === -1) return false;

  voices.splice(index, 1);
  ensureDataDir();
  fs.writeFileSync(customVoicesFile, JSON.stringify(voices, null, 2));

  return true;
}

export function updateCustomVoice(id: string, voiceId: string, name: string): CustomVoice | null {
  const voices = getCustomVoices();
  const voice = voices.find(v => v.id === id);
  if (!voice) return null;

  voice.voiceId = voiceId;
  voice.name = name;

  ensureDataDir();
  fs.writeFileSync(customVoicesFile, JSON.stringify(voices, null, 2));

  return voice;
}
