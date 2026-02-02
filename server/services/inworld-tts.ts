import * as fs from "fs";
import * as path from "path";
import { getResolvedApiKey } from "./api-keys";
import { logInfo, logWarning, logError } from "./logger";

const INWORLD_API_URL = "https://api.inworld.ai/tts/v1/voice";

export interface InworldTTSOptions {
  text: string;
  voiceId: string;
  outputPath: string;
}

export interface InworldTTSResult {
  audioPath: string;
  durationSeconds: number;
  success: boolean;
  wordAlignment?: {
    words: string[];
    wordStartTimeSeconds: number[];
    wordEndTimeSeconds: number[];
  };
}

/**
 * Generates speech using Inworld AI's TTS API.
 * 
 * @param options - TTS configuration including text, voice ID, and output path
 * @returns Result object containing success status, audio path, duration, and word timings
 */
export async function generateInworldTTS(options: InworldTTSOptions): Promise<InworldTTSResult> {
  const { text, voiceId, outputPath } = options;

  const apiKey = await getResolvedApiKey("inworld");
  const estimatedDuration = estimateAudioDuration(text);

  if (!apiKey) {
    logWarning("Inworld", "API key not configured, using estimated duration only");
    return {
      audioPath: "",
      durationSeconds: estimatedDuration,
      success: false,
    };
  }

  logInfo("Inworld", `Generating TTS for voice: ${voiceId}`, { textLength: text.length });

  try {
    const response = await fetch(INWORLD_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        voiceId: voiceId || "Dennis",
        modelId: "inworld-tts-1.5-max",
        timestampType: "WORD",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError("Inworld", "API error", undefined, { status: response.status, error: errorText.slice(0, 200) });
      return {
        audioPath: "",
        durationSeconds: estimatedDuration,
        success: false,
      };
    }

    const data = await response.json() as {
      audioContent: string;
      timestampInfo?: {
        wordAlignment?: {
          words: string[];
          wordStartTimeSeconds: number[];
          wordEndTimeSeconds: number[];
        };
      };
    };

    if (!data.audioContent) {
      logError("Inworld", "No audioContent in TTS response");
      return {
        audioPath: "",
        durationSeconds: estimatedDuration,
        success: false,
      };
    }

    const audioBuffer = Buffer.from(data.audioContent, "base64");

    if (audioBuffer.length === 0) {
      logError("Inworld", "Empty audio content from TTS");
      return {
        audioPath: "",
        durationSeconds: estimatedDuration,
        success: false,
      };
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, audioBuffer);

    let duration = estimatedDuration;
    const wordAlignment = data.timestampInfo?.wordAlignment;
    if (wordAlignment && wordAlignment.wordEndTimeSeconds.length > 0) {
      duration = wordAlignment.wordEndTimeSeconds[wordAlignment.wordEndTimeSeconds.length - 1];
    }

    return {
      audioPath: outputPath,
      durationSeconds: duration,
      success: true,
      wordAlignment: wordAlignment,
    };
  } catch (error) {
    logError("Inworld", "TTS generation error", error);
    return {
      audioPath: "",
      durationSeconds: estimatedDuration,
      success: false,
    };
  }
}

function estimateAudioDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  const wordsPerMinute = 150;
  const durationMinutes = words / wordsPerMinute;
  return Math.max(2, durationMinutes * 60);
}

export const inworldDefaultVoices = [
  { id: "Dennis", name: "Dennis", gender: "male" },
  { id: "Alex", name: "Alex", gender: "male" },
  { id: "Craig", name: "Craig", gender: "male" },
  { id: "Mark", name: "Mark", gender: "male" },
  { id: "Shaun", name: "Shaun", gender: "male" },
  { id: "Timothy", name: "Timothy", gender: "male" },
  { id: "Ashley", name: "Ashley", gender: "female" },
  { id: "Deborah", name: "Deborah", gender: "female" },
  { id: "Elizabeth", name: "Elizabeth", gender: "female" },
  { id: "Julia", name: "Julia", gender: "female" },
  { id: "Olivia", name: "Olivia", gender: "female" },
  { id: "Sarah", name: "Sarah", gender: "female" },
] as const;
