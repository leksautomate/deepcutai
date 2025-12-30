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
  duration?: "short" | "medium" | "long";
  userId?: string;
}

export interface GeneratedScript {
  title: string;
  script: string;
  scenes: string[];
}

export async function generateScript(options: GenerateScriptOptions): Promise<GeneratedScript> {
  const { topic, style = "educational", duration = "medium", userId } = options;

  const durationGuide = {
    short: "3-5 sentences, about 1-2 minutes when spoken",
    medium: "8-12 sentences, about 3-5 minutes when spoken",
    long: "15-25 sentences, about 5-10 minutes when spoken",
  };

  const styleGuide = {
    educational: "informative and clear, explaining concepts step by step",
    entertaining: "engaging and fun, with humor and energy",
    documentary: "serious and factual, with a professional tone",
    storytelling: "narrative and immersive, telling a compelling story",
  };

  const prompt = `You are a professional video script writer. Create a script for a faceless YouTube video about: "${topic}"

Style: ${styleGuide[style]}
Length: ${durationGuide[duration]}

Requirements:
1. Write in a natural, conversational tone suitable for text-to-speech
2. Each paragraph will become a separate scene with its own image
3. Keep paragraphs concise (15-30 words each) for better pacing
4. Start with a hook to grab attention
5. End with a clear conclusion or call to action
6. Avoid special characters, abbreviations, or anything that might confuse TTS
7. Do NOT include scene numbers, timestamps, or stage directions

Return your response as JSON with this exact structure:
{
  "title": "Video Title",
  "script": "Full script with paragraphs separated by double newlines",
  "scenes": ["Scene 1 text", "Scene 2 text", ...]
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

    return {
      title: parsed.title || `Video about ${topic}`,
      script: parsed.script || parsed.scenes?.join("\n\n") || "",
      scenes: parsed.scenes || parsed.script?.split(/\n\n+/).filter((s: string) => s.trim()) || [],
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
