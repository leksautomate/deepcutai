import { getResolvedApiKey } from "./api-keys";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface ImagePromptOptions {
  sceneText: string;
  imageStyle?: string;
  customStyle?: HistoricalStyle;
}

export interface GroqScriptOptions {
  topic: string;
  style?: "educational" | "entertaining" | "documentary" | "storytelling";
  duration?: "short" | "medium" | "long";
  userId?: string;
}

export interface GroqGeneratedScript {
  title: string;
  script: string;
  scenes: string[];
}

export interface HistoricalStyle {
  art_style: string;
  composition: string;
  color_style: string;
  fine_details: string;
}

const DEFAULT_HISTORICAL_STYLE: HistoricalStyle = {
  art_style: "Digital concept art mimicking romantic oil painting with soft, painterly brushstrokes.",
  composition: "One-point perspective leading down a central street, framed by tall buildings on both sides.",
  color_style: "Warm golden sunlight and earthy browns contrasted against cool blue clothing and shadows.",
  fine_details: "Weathered stone architecture, medieval peasant attire, and market stalls with canvas awnings."
};

const STYLE_ENHANCEMENTS = `
Apply aged textures, subdued color palettes, and period-appropriate lighting to transport viewers into another era.
Use old architecture, clothing, and props with consistent color grading, texture, and lighting based on the script.
Use aged effects and period-appropriate color grading to give contemporary scenes the appearance of centuries-old masterpieces.
Capture movement, emotion, and chaos to immerse viewers in the era.
Capture medieval markets, village life, or early industrial scenes to bring social history to the forefront.
`;

export async function generateImagePromptWithGroq(options: ImagePromptOptions): Promise<string> {
  const { sceneText, imageStyle = "historical", customStyle } = options;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn("GROQ_API_KEY not configured, using fallback prompt");
    return `Historical scene depicting: ${sceneText}, aged oil painting style, warm golden lighting, period-appropriate details`;
  }

  const style = customStyle || DEFAULT_HISTORICAL_STYLE;

  const systemPrompt = `You are an expert image prompt engineer specializing in historical and period-accurate visual imagery. Your task is to create detailed, evocative image prompts for AI image generators.

Style Guidelines:
- Art Style: ${style.art_style}
- Composition: ${style.composition}
- Color Style: ${style.color_style}
- Fine Details: ${style.fine_details}

${STYLE_ENHANCEMENTS}

Rules:
1. Create vivid, detailed prompts that capture the essence of the scene
2. Include period-appropriate details (architecture, clothing, lighting)
3. Apply aged textures and subdued color palettes
4. Optimized for 16:9 landscape format
5. NO text, words, letters, or watermarks in the image
6. Return ONLY the image prompt, nothing else`;

  const userPrompt = `Create a detailed image prompt for this scene:

"${sceneText}"

Style preference: ${imageStyle}

Generate a single, detailed image prompt that brings this scene to life with historical authenticity and artistic beauty.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-maverick-17b-128e-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      return generateFallbackPrompt(sceneText, imageStyle);
    }

    const data = await response.json();
    const generatedPrompt = data.choices?.[0]?.message?.content?.trim();

    if (generatedPrompt) {
      console.log("Groq generated prompt:", generatedPrompt.slice(0, 100) + "...");
      return generatedPrompt;
    }

    return generateFallbackPrompt(sceneText, imageStyle);
  } catch (error) {
    console.error("Groq image prompt error:", error);
    return generateFallbackPrompt(sceneText, imageStyle);
  }
}

function generateFallbackPrompt(sceneText: string, imageStyle: string): string {
  const styleDescriptions: Record<string, string> = {
    historical: "romantic oil painting style, aged textures, warm golden lighting, period-appropriate architecture and clothing, subdued color palette",
    cinematic: "cinematic, high-quality, dramatic lighting, movie-like composition",
    anime: "anime style, Japanese animation, vibrant colors, detailed",
    realistic: "photorealistic, detailed, natural lighting, professional photography",
    illustration: "digital illustration, artistic, clean lines, modern design",
  };

  const styleDesc = styleDescriptions[imageStyle] || styleDescriptions.historical;
  return `${styleDesc}, scene depicting: ${sceneText}, no text or watermarks, 16:9 landscape format`;
}

export { DEFAULT_HISTORICAL_STYLE };

export async function generateScriptWithGroq(options: GroqScriptOptions): Promise<GroqGeneratedScript> {
  const { topic, style = "educational", duration = "medium", userId } = options;
  
  const apiKey = await getResolvedApiKey("groq", userId);
  if (!apiKey) {
    throw new Error("Groq API key not configured. Please add it in Settings.");
  }

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

  const systemPrompt = `You are a professional video script writer. You create engaging, natural-sounding scripts for faceless YouTube videos.

Requirements:
1. Write in a natural, conversational tone suitable for text-to-speech
2. Each paragraph will become a separate scene with its own image
3. Keep paragraphs concise (15-30 words each) for better pacing
4. Start with a hook to grab attention
5. End with a clear conclusion or call to action
6. Avoid special characters, abbreviations, or anything that might confuse TTS
7. Do NOT include scene numbers, timestamps, or stage directions

You MUST respond with valid JSON only.`;

  const userPrompt = `Create a script for a faceless YouTube video about: "${topic}"

Style: ${styleGuide[style]}
Length: ${durationGuide[duration]}

Return your response as JSON with this exact structure:
{
  "title": "Video Title",
  "script": "Full script with paragraphs separated by double newlines",
  "scenes": ["Scene 1 text", "Scene 2 text", ...]
}`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq script API error:", response.status, errorText);
      throw new Error("Groq API request failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in Groq response");
    }

    const parsed = JSON.parse(content);

    return {
      title: parsed.title || `Video about ${topic}`,
      script: parsed.script || parsed.scenes?.join("\n\n") || "",
      scenes: parsed.scenes || parsed.script?.split(/\n\n+/).filter((s: string) => s.trim()) || [],
    };
  } catch (error: any) {
    console.error("Groq script generation error:", error);
    if (error.message?.includes("API key not configured")) {
      throw error;
    }
    throw new Error("Failed to generate script with Groq");
  }
}
