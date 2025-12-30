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
  duration?: "30s" | "1min" | "2min" | "10min";
  userId?: string;
}

export interface GroqGeneratedScript {
  title: string;
  script: string;
  scenes: string[];
}

const VIRAL_SCRIPT_SYSTEM_PROMPT = `You are an expert viral short-form content creator specializing in documentary scripts for YouTube Shorts, TikTok, Instagram Reels, and YouTube videos. Your scripts are optimized for maximum retention, emotional impact, and shareability.

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
- Em dashes for dramatic breaks
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
- Each paragraph becomes a separate scene

You MUST respond with valid JSON only.`;

function getGroqDurationGuide(duration: string): string {
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
  const { topic, style = "documentary", duration = "1min", userId } = options;
  
  const apiKey = await getResolvedApiKey("groq", userId);
  if (!apiKey) {
    throw new Error("Groq API key not configured. Please add it in Settings.");
  }

  const durationGuide = getGroqDurationGuide(duration);
  
  const styleText = style === "documentary" 
    ? "Cold, factual documentary narrator" 
    : style === "storytelling" 
    ? "Narrative and immersive" 
    : style === "entertaining" 
    ? "Engaging with energy" 
    : "Informative and clear";

  const userPrompt = `Create a script about: "${topic}"

Duration: ${durationGuide}

Style: ${styleText}

**REMEMBER: Output ONLY the script. No titles, no labels, no explanations. Just the clean script text with one sentence per line.**

Return your response as JSON:
{
  "script": "The full script with each sentence on its own line",
  "scenes": ["Scene 1 paragraph", "Scene 2 paragraph", ...]
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
          { role: "system", content: VIRAL_SCRIPT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 8000,
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

    const script = parsed.script || parsed.scenes?.join("\n\n") || "";
    const scenes = parsed.scenes || script.split(/\n\n+/).filter((s: string) => s.trim()) || [];

    return {
      title: `Video about ${topic}`,
      script,
      scenes,
    };
  } catch (error: any) {
    console.error("Groq script generation error:", error);
    if (error.message?.includes("API key not configured")) {
      throw error;
    }
    throw new Error("Failed to generate script with Groq");
  }
}
