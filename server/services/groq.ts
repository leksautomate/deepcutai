const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface ImagePromptOptions {
  sceneText: string;
  imageStyle?: string;
  customStyle?: HistoricalStyle;
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
