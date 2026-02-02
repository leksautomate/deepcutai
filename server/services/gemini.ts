import { GoogleGenAI } from "@google/genai";
import { getResolvedApiKey } from "./api-keys";
import { logError } from "./logger";

async function getGeminiClient(userId?: string): Promise<GoogleGenAI> {
  const apiKey = await getResolvedApiKey("gemini", userId);
  if (!apiKey) {
    throw new Error(
      "Gemini API key not configured. Please add it in Settings.",
    );
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

const VIRAL_SCRIPT_PROMPT = `# ROLE
You are a viral documentary scriptwriter who has created 100+ scripts with 10M+ views. Your specialty is short-form content that hooks viewers in 2 seconds and keeps them watching until the final reveal.

# CONTEXT
You write scripts for AI-narrated documentary videos on YouTube Shorts, TikTok, and Instagram Reels. These scripts are read by TTS engines and displayed as subtitles.

# WRITING RULES

## Sentence Structure
- 3-8 words per sentence (MANDATORY)
- One idea per line
- Write for subtitle readability
- Each line break = TTS pause

## Voice & Tone
- Active voice always
- Present tense for immediacy
- Cold, factual narrator (think BBC documentary)
- Cinematic, visual language

## TTS Optimization
- Periods = 0.5s pause
- Em dashes (—) = dramatic beat
- Commas = breath pause
- Write EXACTLY as it should sound

# HOOK EXAMPLES (Follow This Pattern)

GOOD HOOK:
"In 1347, a ship docked in Sicily.
Every sailor aboard was dead.
Within weeks, half of Europe would follow."

GOOD HOOK:
"This man killed 71 people.
He was never caught.
He was a doctor."

BAD HOOK (TOO VAGUE):
"This is a story about a terrible event that changed history."

BAD HOOK (REVEALS TOO MUCH):
"Jack the Ripper killed many women in London."

# STORYTELLING STRUCTURE

1. HOOK (Lines 1-3): Mystery + consequence
2. CONTEXT (Lines 4-8): Who/Where/When
3. RISING ACTION (Lines 9-15): Escalation
4. TWIST (Lines 16-20): Unexpected turn
5. CLIMAX (Lines 21-25): Peak tension
6. REVEAL (Final lines): Impact or mystery

# FORBIDDEN ELEMENTS
❌ "Sadly," "Unfortunately," "Tragically" (emotional editorializing)
❌ "You won't believe," "This will shock you" (clickbait phrases)
❌ Long paragraphs or run-on sentences
❌ Naming the subject before the final reveal (when applicable)
❌ Internal thoughts or feelings ("He felt scared")
❌ Modern slang or colloquialisms
❌ Meta-commentary ("In this video," "Let me tell you")
❌ Questions to the audience

# OUTPUT FORMAT

Return ONLY valid JSON with this exact structure:
{
  "script": "Full script with one sentence per line, paragraphs separated by blank lines",
  "scenes": ["Paragraph 1 text", "Paragraph 2 text", ...]
}

CRITICAL: Each paragraph in "script" becomes one visual scene. Aim for 4-8 scene paragraphs depending on duration.`;

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

/**
 * Generates a video script using Google Gemini based on the provided topic and options.
 *
 * @param options - Configuration options for the script generation
 * @returns The generated script, title, and scene breakdown
 * @throws Error if API key is missing or generation fails
 */
export async function generateScript(
  options: GenerateScriptOptions,
): Promise<GeneratedScript> {
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

    let parsed: { script?: string; scenes?: string[] };
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      logError("Gemini", "Failed to parse JSON response", {
        textPreview: text.slice(0, 200),
      });
      // Fallback: treat the entire response as the script
      return {
        title: `Video about ${topic}`,
        script: text,
        scenes: text.split(/\n\n+/).filter((s: string) => s.trim()),
      };
    }

    const script = parsed.script || parsed.scenes?.join("\n\n") || "";
    const scenes =
      parsed.scenes ||
      script.split(/\n\n+/).filter((s: string) => s.trim()) ||
      [];

    return {
      title: `Video about ${topic}`,
      script,
      scenes,
    };
  } catch (error) {
    logError("Gemini", "Script generation error", error);
    if (
      error instanceof Error &&
      error.message?.includes("API key not configured")
    ) {
      throw error;
    }
    throw new Error("Failed to generate script with AI");
  }
}

export interface ImageStyleSettings {
  art_style: string;
  composition: string;
  color_style: string;
  fine_details: string;
}

/**
 * Generates an optimized AI image prompt based on scene text and style settings.
 *
 * @param sceneText - The text content of the scene to visualize
 * @param imageStyle - The general visual style (e.g. "cinematic", "anime")
 * @param userId - Optional user ID for API key resolution
 * @param customStyle - Advanced style settings override
 * @returns A detailed image prompt string optimized for generation
 */
export async function generateImagePrompt(
  sceneText: string,
  imageStyle: string,
  userId?: string,
  customStyle?: ImageStyleSettings,
): Promise<string> {
  // Base style from Visual Style selector
  const styleDescriptions: Record<string, string> = {
    cinematic:
      "cinematic, high-quality, dramatic lighting, movie-like composition",
    anime: "anime style, Japanese animation, vibrant colors, detailed",
    realistic:
      "photorealistic, detailed, natural lighting, professional photography",
    illustration:
      "A high-quality 3D pixar  animation in the style of a modern animated film.. Cinematic volumetric lighting with a warm amber glow and soft rim light. Highly detailed stylized character design with expressive features. Macro shot with shallow depth of field and soft bokeh background. Rich textures, vibrant colors, 8k resolution, Pixar-inspired CGI aesthetic, rendered in Octane, no text.",
    abstract: "abstract artistic visuals, creative composition, bold colors",
    historical:
      "romantic oil painting style, aged textures, warm golden lighting",
  };

  const baseStyle =
    styleDescriptions[imageStyle] || styleDescriptions.cinematic;

  // Combine with custom Image Style Settings if provided
  let styleDesc: string;
  if (customStyle && customStyle.art_style) {
    // Visual Style + Custom Settings work together
    styleDesc = `${baseStyle}. Additional style: ${customStyle.art_style} ${customStyle.composition} ${customStyle.color_style} ${customStyle.fine_details}`;
  } else {
    styleDesc = baseStyle;
  }

  const prompt = `# ROLE
You are a professional AI image prompt architect creating prompts for cinematic video scene visualization.

# SCENE TEXT
"${sceneText}"

# VISUAL STYLE
${styleDesc}

# REQUIREMENTS
1. Create a single, detailed prompt (100-200 words) describing the exact visual
2. Include: subject positioning, lighting direction, camera angle, atmosphere, textures
3. Use cinematic language: "golden hour lighting", "shallow depth of field", "wide establishing shot"
4. Blend the style naturally into the scene description

# CONSTRAINTS
- Output ONLY the prompt text - no explanations, alternatives, or preamble
- Format: 16:9 landscape aspect ratio
- FORBIDDEN: text, words, letters, watermarks, signatures, logos, UI elements
- FORBIDDEN: meta-phrases like "create an image of" or "an illustration showing"
- Begin directly with the scene description

# OUTPUT
[Your detailed image prompt here]`;

  try {
    const ai = await getGeminiClient(userId);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return (
      response.text?.trim() || `${styleDesc} scene depicting: ${sceneText}`
    );
  } catch (error) {
    logError("Gemini", "Image prompt generation error", error);
    return `${styleDesc} visual representation of: ${sceneText}`;
  }
}
