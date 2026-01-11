import * as fs from "fs";
import * as path from "path";
import { getResolvedApiKey } from "./api-keys";

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
      console.error("Failed to fetch Speechify voices:", response.status);
      return [];
    }

    const voices = await response.json();
    cachedVoices = voices;
    console.log("Speechify voices available:", voices.map((v: SpeechifyVoice) => `${v.display_name} (${v.id})`).slice(0, 5));
    return voices;
  } catch (error) {
    console.error("Error fetching Speechify voices:", error);
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

export async function generateTTS(options: TTSOptions): Promise<TTSResult> {
  const { text, voiceId, outputPath } = options;
  const apiKey = await getResolvedApiKey("speechify");

  const estimatedDuration = estimateAudioDuration(text);

  if (!apiKey) {
    console.warn("SPEECHIFY_API_KEY not configured, using estimated duration only");
    return {
      audioPath: "",
      durationSeconds: estimatedDuration,
      success: false,
    };
  }

  // Find a valid voice ID from the API
  const resolvedVoiceId = await findBestVoice(apiKey, voiceId);
  
  if (!resolvedVoiceId) {
    console.error("No valid Speechify voice found");
    return {
      audioPath: "",
      durationSeconds: estimatedDuration,
      success: false,
    };
  }

  console.log(`Using Speechify voice: ${resolvedVoiceId} (requested: ${voiceId})`);

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
      console.error("Speechify API error:", response.status, errorText);
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
        console.error("No audio_data in Speechify JSON response");
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
        console.error("Empty audio response from Speechify");
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
    console.error("TTS generation error:", error);
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

export async function getAvailableVoices(): Promise<string[]> {
  const apiKey = await getResolvedApiKey("speechify");
  if (!apiKey) {
    return ["george", "maisie", "henry", "carly", "oliver", "simone"];
  }
  const voices = await fetchAvailableVoices(apiKey);
  return voices.map(v => v.display_name);
}
