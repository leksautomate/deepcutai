import { GoogleGenAI } from "@google/genai";
import { getResolvedApiKey } from "./api-keys";

async function getGeminiClient(userId?: string): Promise<GoogleGenAI> {
  const apiKey = await getResolvedApiKey("gemini", userId);
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Please add it in Settings.");
  }
  return new GoogleGenAI({ apiKey });
}

export interface GenerateScriptOptions {
  topic: string;
  style?: "educational" | "entertaining" | "documentary" | "storytelling";
  duration?: "30s" | "1min" | "2min" | "10min";
  userId?: string;
}

export interface GeneratedScript {
  title: string;
  script: string;
  scenes: string[];
}

const VIRAL_SCRIPT_PROMPT = `You are an expert viral short-form content creator specializing in documentary scripts for YouTube Shorts, TikTok, Instagram Reels, and YouTube videos. Your scripts are optimized for maximum retention, emotional impact, and shareability.

## WRITING RULES

**Sentence Structure:**
- 3-8 words per sentence (ideal)
- One idea per line
- Short, punchy, visual
- Write for subtitles

**Voice & Tone:**
- Active voice dominates
- Present tense for immediacy
- Cold, factual documentary narrator
- No emotional commentary ("sadly," "unfortunately")
- No modern colloquialisms
- Cinematic, visual language

**TTS Optimization:**
- Use periods for natural pauses
- Em dashes (—) for dramatic breaks
- Commas for flow within sentences
- Write exactly as it should be spoken

**Forbidden:**
- Long paragraphs or run-on sentences
- Over-explaining motivations
- Flowery or poetic language
- Naming subject before final reveal (if applicable)
- Internal monologue or thoughts
- Abstract concepts without concrete imagery

## STORYTELLING TECHNIQUES

**Mystery Preservation:**
- Create information gaps: "No one knows why."
- Build curiosity through contradictions
- Use phrases like "To this day, historians debate..."

**Emotional Peaks:**
- Betrayal (midpoint or climax)
- Impossible odds (early setup)
- Unexpected mercy/cruelty (twist)
- Legacy impact (reveal)

**Visual Power Words:**
Use sensory, cinematic language:
- Physical: blood, fire, walls, chains, crown, sword
- Action: fell, burned, crowned, executed, disappeared, charged
- Spatial: deep, outside, beneath, across, hidden, behind

## HOOK FORMULA

Start every script with a powerful hook:
- Use generic descriptors: "this man," "this girl," "this soldier," "this city"
- Include brief time/place context
- Focus on ONE powerful trait or action
- End hook with dramatic, unexpected consequence

## OUTPUT REQUIREMENTS

**ONLY output the script text. Nothing else.**
- No titles
- No hook variations
- No timing markers
- No section labels
- No production instructions
- No metadata

Just the clean script with:
- One sentence per line
- Natural line breaks for pacing
- Proper punctuation for TTS
- Each paragraph becomes a separate scene`;

function getDurationGuide(duration: string): string {
  switch (duration) {
    case "30s":
      return `30-SECOND FORMAT (28-32 seconds when spoken):
- Hook: 5 seconds (1-2 sentences)
- Context + Twist: 15 seconds (4-5 sentences)
- Reveal: 5-8 seconds (1-2 sentences)
- Total: 6-9 sentences maximum`;
    case "1min":
      return `60-SECOND FORMAT (55-65 seconds when spoken):
- Hook/Context: 8-10 seconds (2-3 sentences)
- Small Twist: 6-8 seconds (2 sentences)
- Plot Twist: 8-10 seconds (2-3 sentences)
- Response: 6-8 seconds (2 sentences)
- Tension Build: 4-6 seconds (1-2 sentences)
- Consequence: 6-8 seconds (2 sentences)
- Reveal: 4-6 seconds (1-2 sentences)
- Total: 12-17 sentences`;
    case "2min":
      return `2-MINUTE FORMAT (110-130 seconds when spoken):
- Hook: 8-10 seconds (2-3 sentences)
- Context Setup: 20-25 seconds (5-7 sentences)
- First Twist: 15-20 seconds (4-5 sentences)
- Development: 20-25 seconds (5-7 sentences)
- Climax: 15-20 seconds (4-5 sentences)
- Resolution/Reveal: 10-15 seconds (3-4 sentences)
- Total: 23-31 sentences`;
    case "10min":
      return `10-MINUTE FORMAT (9-11 minutes when spoken):
- Hook: 15-20 seconds (4-5 sentences)
- Introduction: 60-90 seconds (15-20 sentences)
- Act 1 - Setup: 2-3 minutes (40-50 sentences)
- Act 2 - Conflict/Development: 3-4 minutes (50-60 sentences)
- Act 3 - Climax: 2-3 minutes (40-50 sentences)
- Resolution/Reveal: 60-90 seconds (15-20 sentences)
- Total: 160-200 sentences, detailed storytelling with multiple twists`;
    default:
      return `60-SECOND FORMAT: 12-17 sentences total`;
  }
}

export async function generateScript(options: GenerateScriptOptions): Promise<GeneratedScript> {
  const { topic, style = "documentary", duration = "1min", userId } = options;

  const durationGuide = getDurationGuide(duration);

  const prompt = `${VIRAL_SCRIPT_PROMPT}

## YOUR TASK

Create a script about: "${topic}"

Duration: ${durationGuide}

Style: ${style === "documentary" ? "Cold, factual documentary narrator" : style === "storytelling" ? "Narrative and immersive" : style === "entertaining" ? "Engaging with energy" : "Informative and clear"}

**REMEMBER: Output ONLY the script. No titles, no labels, no explanations. Just the clean script text with one sentence per line.**

Return your response as JSON:
{
  "script": "The full script with each sentence on its own line",
  "scenes": ["Scene 1 paragraph", "Scene 2 paragraph", ...]
}`;

  try {
    const ai = await getGeminiClient(userId);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "";
    const parsed = JSON.parse(text);

    const script = parsed.script || parsed.scenes?.join("\n\n") || "";
    const scenes = parsed.scenes || script.split(/\n\n+/).filter((s: string) => s.trim()) || [];

    return {
      title: `Video about ${topic}`,
      script,
      scenes,
    };
  } catch (error: any) {
    console.error("Gemini script generation error:", error);
    if (error.message?.includes("API key not configured")) {
      throw error;
    }
    throw new Error("Failed to generate script with AI");
  }
}

export async function generateImagePrompt(sceneText: string, imageStyle: string, userId?: string): Promise<string> {
  const styleDescriptions: Record<string, string> = {
    cinematic: "cinematic, high-quality, dramatic lighting, movie-like composition",
    anime: "anime style, Japanese animation, vibrant colors, detailed",
    realistic: "photorealistic, detailed, natural lighting, professional photography",
    illustration: "digital illustration, artistic, clean lines, modern design",
    abstract: "abstract art, geometric shapes, vibrant colors, artistic interpretation",
  };

  const styleDesc = styleDescriptions[imageStyle] || styleDescriptions.cinematic;

  const prompt = `Based on this video script scene, create a detailed image prompt for an AI image generator:

Scene text: "${sceneText}"
Style: ${styleDesc}

Generate a single, detailed image prompt that:
1. Captures the essence of the scene
2. Is visually interesting and suitable for video content
3. Includes the specified style
4. Is optimized for a 16:9 landscape format
5. Does NOT include any text, words, or letters in the image

Return ONLY the image prompt, nothing else.`;

  try {
    const ai = await getGeminiClient(userId);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text?.trim() || `${styleDesc} scene depicting: ${sceneText}`;
  } catch (error) {
    console.error("Gemini image prompt error:", error);
    return `${styleDesc} visual representation of: ${sceneText}`;
  }
}
