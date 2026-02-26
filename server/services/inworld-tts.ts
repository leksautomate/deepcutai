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
  { "id": "Abby", "name": "Abby", "gender": "female" },
  { "id": "Alex", "name": "Alex", "gender": "male" },
  { "id": "Amina", "name": "Amina", "gender": "female" },
  { "id": "Anjali", "name": "Anjali", "gender": "female" },
  { "id": "Arjun", "name": "Arjun", "gender": "male" },
  { "id": "Ashley", "name": "Ashley", "gender": "female" },
  { "id": "Brian", "name": "Brian", "gender": "male" },
  { "id": "Callum", "name": "Callum", "gender": "male" },
  { "id": "Carter", "name": "Carter", "gender": "male" },
  { "id": "Celeste", "name": "Celeste", "gender": "female" },
  { "id": "Chloe", "name": "Chloe", "gender": "female" },
  { "id": "Claire", "name": "Claire", "gender": "female" },
  { "id": "Craig", "name": "Craig", "gender": "male" },
  { "id": "Darlene", "name": "Darlene", "gender": "female" },
  { "id": "Deborah", "name": "Deborah", "gender": "female" },
  { "id": "Dennis", "name": "Dennis", "gender": "male" },
  { "id": "Derek", "name": "Derek", "gender": "male" },
  { "id": "Dominus", "name": "Dominus", "gender": "male" },
  { "id": "Edward", "name": "Edward", "gender": "male" },
  { "id": "Elliot", "name": "Elliot", "gender": "male" },
  { "id": "Ethan", "name": "Ethan", "gender": "male" },
  { "id": "Evan", "name": "Evan", "gender": "male" },
  { "id": "Evelyn", "name": "Evelyn", "gender": "female" },
  { "id": "Gareth", "name": "Gareth", "gender": "male" },
  { "id": "Graham", "name": "Graham", "gender": "male" },
  { "id": "Grant", "name": "Grant", "gender": "male" },
  { "id": "Hamish", "name": "Hamish", "gender": "male" },
  { "id": "Hank", "name": "Hank", "gender": "male" },
  { "id": "Jake", "name": "Jake", "gender": "male" },
  { "id": "James", "name": "James", "gender": "male" },
  { "id": "Jason", "name": "Jason", "gender": "male" },
  { "id": "Jessica", "name": "Jessica", "gender": "female" },
  { "id": "Kayla", "name": "Kayla", "gender": "female" },
  { "id": "Kelsey", "name": "Kelsey", "gender": "female" },
  { "id": "Lauren", "name": "Lauren", "gender": "female" },
  { "id": "Liam", "name": "Liam", "gender": "male" },
  { "id": "Loretta", "name": "Loretta", "gender": "female" },
  { "id": "Malcolm", "name": "Malcolm", "gender": "male" },
  { "id": "Marlene", "name": "Marlene", "gender": "female" },
  { "id": "Miranda", "name": "Miranda", "gender": "female" },
  { "id": "Mortimer", "name": "Mortimer", "gender": "male" },
  { "id": "Nate", "name": "Nate", "gender": "male" },
  { "id": "Oliver", "name": "Oliver", "gender": "male" },
  { "id": "Pippa", "name": "Pippa", "gender": "female" },
  { "id": "Pixie", "name": "Pixie", "gender": "female" },
  { "id": "Ronald", "name": "Ronald", "gender": "male" },
  { "id": "Rupert", "name": "Rupert", "gender": "male" },
  { "id": "Saanvi", "name": "Saanvi", "gender": "female" },
  { "id": "Sarah", "name": "Sarah", "gender": "female" },
  { "id": "Sebastian", "name": "Sebastian", "gender": "male" },
  { "id": "Serena", "name": "Serena", "gender": "female" },
  { "id": "Simon", "name": "Simon", "gender": "male" },
  { "id": "Snik", "name": "Snik", "gender": "male" },
  { "id": "Tessa", "name": "Tessa", "gender": "female" },
  { "id": "Timothy", "name": "Timothy", "gender": "male" },
  { "id": "Tyler", "name": "Tyler", "gender": "male" },
  { "id": "Veronica", "name": "Veronica", "gender": "female" },
  { "id": "Victor", "name": "Victor", "gender": "male" },
  { "id": "Victoria", "name": "Victoria", "gender": "female" },
  { "id": "Vinny", "name": "Vinny", "gender": "male" },
  { "id": "Wendy", "name": "Wendy", "gender": "female" }
] as const;
