import * as fs from "fs";
import * as path from "path";
import { getResolvedApiKey } from "./api-keys";
import { logInfo, logError, logWarning } from "./logger";

const SPEECHIFY_API_URL = "https://api.sws.speechify.com/v1";

export interface TTSOptions {
  text: string;
  voiceId: string;
  outputPath: string;
}

export interface TTSResult {
  audioPath: string;
  durationSeconds: number;
  success: boolean;
}

interface SpeechifyVoice {
  id: string;
  display_name: string;
  gender: string;
  locale: string;
}

let cachedVoices: SpeechifyVoice[] | null = null;

async function fetchAvailableVoices(apiKey: string): Promise<SpeechifyVoice[]> {
  if (cachedVoices) {
    return cachedVoices;
  }

  try {
    const response = await fetch(`${SPEECHIFY_API_URL}/voices`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      logError("Speechify", "Failed to fetch voices", undefined, { status: response.status });
      return [];
    }

    const voices = await response.json();
    cachedVoices = voices;
    logInfo("Speechify", "Voices available", { count: voices.length, preview: voices.slice(0, 5).map((v: SpeechifyVoice) => v.display_name) });
    return voices;
  } catch (error) {
    logError("Speechify", "Error fetching voices", error);
    return [];
  }
}

async function findBestVoice(apiKey: string, preferredVoiceId: string): Promise<string | null> {
  const voices = await fetchAvailableVoices(apiKey);

  if (voices.length === 0) {
    return null;
  }

  // Try to find a voice matching the preferred name
  const preferredLower = preferredVoiceId.toLowerCase();
  const exactMatch = voices.find(v =>
    v.display_name.toLowerCase() === preferredLower ||
    v.id.toLowerCase() === preferredLower
  );
  if (exactMatch) {
    return exactMatch.id;
  }

  // Try partial match
  const partialMatch = voices.find(v =>
    v.display_name.toLowerCase().includes(preferredLower)
  );
  if (partialMatch) {
    return partialMatch.id;
  }

  // Return the first available voice
  return voices[0]?.id || null;
}

/**
 * Generates speech from text using the Speechify API.
 * 
 * @param options - TTS configuration including text, voice ID, and output path
 * @returns Result object containing success status, audio path, and duration
 */
export async function generateTTS(options: TTSOptions): Promise<TTSResult> {
  const { text, voiceId, outputPath } = options;
  const apiKey = await getResolvedApiKey("speechify");

  const estimatedDuration = estimateAudioDuration(text);

  if (!apiKey) {
    logWarning("Speechify", "API key not configured, using estimated duration only");
    return {
      audioPath: "",
      durationSeconds: estimatedDuration,
      success: false,
    };
  }

  // Find a valid voice ID from the API
  const resolvedVoiceId = await findBestVoice(apiKey, voiceId);

  if (!resolvedVoiceId) {
    logError("Speechify", "No valid voice found");
    return {
      audioPath: "",
      durationSeconds: estimatedDuration,
      success: false,
    };
  }

  logInfo("Speechify", `Using voice: ${resolvedVoiceId} (requested: ${voiceId})`);

  try {
    const response = await fetch(`${SPEECHIFY_API_URL}/audio/speech`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        voice_id: resolvedVoiceId,
        audio_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError("Speechify", "API error", undefined, { status: response.status, error: errorText.slice(0, 200) });
      return {
        audioPath: "",
        durationSeconds: estimatedDuration,
        success: false,
      };
    }

    // Try JSON response first
    const contentType = response.headers.get("content-type");
    let audioBuffer: Buffer;
    let duration = estimatedDuration;

    if (contentType?.includes("application/json")) {
      const data = await response.json();
      if (data.audio_data) {
        audioBuffer = Buffer.from(data.audio_data, "base64");
        duration = data.duration || estimatedDuration;
      } else {
        logError("Speechify", "No audio_data in JSON response");
        return {
          audioPath: "",
          durationSeconds: estimatedDuration,
          success: false,
        };
      }
    } else {
      // Handle binary audio response directly
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      if (audioBuffer.length === 0) {
        logError("Speechify", "Empty audio response");
        return {
          audioPath: "",
          durationSeconds: estimatedDuration,
          success: false,
        };
      }
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, audioBuffer);

    return {
      audioPath: outputPath,
      durationSeconds: duration,
      success: true,
    };
  } catch (error) {
    logError("Speechify", "TTS generation error", error);
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

/**
 * Retrieves a list of available Speechify voice names.
 * Falls back to a hardcoded list if API key is missing.
 * 
 * @returns Array of voice display names
 */
export async function getAvailableVoices(): Promise<string[]> {
  const apiKey = await getResolvedApiKey("speechify");
  if (!apiKey) {
    return ["george", "maisie", "henry", "carly", "oliver", "simone"];
  }
  const voices = await fetchAvailableVoices(apiKey);
  return voices.map(v => v.display_name);
}
