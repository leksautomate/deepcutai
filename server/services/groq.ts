import { getResolvedApiKey } from "./api-keys";
import { logInfo, logError, logWarning } from "./logger";

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

const VIRAL_SCRIPT_SYSTEM_PROMPT = `# ROLE
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

const DEFAULT_PIXAR_STYLE: HistoricalStyle = {
  art_style: "High-quality 3D Pixar animation in the style of a modern animated film, highly detailed stylized character design with expressive features, Pixar-inspired CGI aesthetic, rendered in Octane.",
  composition: "Macro shot with shallow depth of field and soft bokeh background, cinematic framing.",
  color_style: "Rich textures, vibrant colors, 8k resolution, cinematic volumetric lighting with warm amber glow and soft rim light.",
  fine_details: "Large expressive eyes, rounded simplified stylized features, smooth highly detailed 3D rendered surfaces, no text."
};

const STYLE_PRESETS: Record<string, HistoricalStyle> = {
  historical: DEFAULT_HISTORICAL_STYLE,
  pixar: DEFAULT_PIXAR_STYLE,
  cinematic: {
    art_style: "Cinematic film still from a Hollywood blockbuster, high-budget movie scene, dramatic chiaroscuro lighting, epic scale.",
    composition: "Wide establishing shot with rule of thirds, dynamic low or high angle camera, depth of field with bokeh background.",
    color_style: "Teal and orange color grading, rich blacks, cinematic contrast, anamorphic lens flare, moody atmosphere.",
    fine_details: "Subtle film grain, lens distortion at edges, volumetric light rays, professional production quality, 35mm film look."
  },
  anime: {
    art_style: "High-quality Japanese anime illustration, Studio Ghibli and Makoto Shinkai inspired, hand-drawn animation cel look.",
    composition: "Dynamic action poses with speed lines, expressive exaggerated gestures, detailed painted backgrounds with depth.",
    color_style: "Vibrant saturated colors with cel-shaded flat shadows, clean black outlines, glowing highlights, soft ambient lighting.",
    fine_details: "Large sparkling expressive eyes, flowing detailed hair with individual strands, intricate clothing folds, cherry blossoms or particles."
  },
  realistic: {
    art_style: "Ultra photorealistic image, professional DSLR photography, National Geographic quality, hyper-detailed.",
    composition: "Natural candid framing, golden hour lighting, perfect exposure, sharp focus on subject with natural depth of field.",
    color_style: "True-to-life accurate colors, natural sunlight or studio lighting, realistic shadows and reflections, no filters.",
    fine_details: "8K resolution textures, visible skin pores and fabric weave, authentic environments, real-world imperfections."
  },
  illustration: {
    art_style: "Modern digital illustration, trending on ArtStation, concept art by top artists, stylized semi-realistic characters.",
    composition: "Dynamic composition with strong focal point, artistic perspective, slightly exaggerated heroic proportions.",
    color_style: "Rich saturated color palette, complementary color harmony, soft gradients, ambient occlusion, rim lighting effects.",
    fine_details: "Crisp clean linework, detailed rendering, visible brushstroke texture, professional digital painting quality."
  },
  abstract: {
    art_style: "Bold abstract expressionist interpretation, modern art gallery piece, non-representational symbolic imagery.",
    composition: "Unconventional asymmetric layout, geometric shapes intersecting with organic flowing forms, visual tension.",
    color_style: "Striking complementary color contrasts, neon accents against deep tones, gradient color field transitions.",
    fine_details: "Heavy impasto texture, drip and splatter effects, layered transparency, mixed media collage elements."
  }
};



export async function generateImagePromptWithGroq(options: ImagePromptOptions): Promise<string> {
  const { sceneText, imageStyle = "historical", customStyle } = options;
  const apiKey = await getResolvedApiKey("groq");

  if (!apiKey) {
    logWarning("Groq", "GROQ_API_KEY not configured, using fallback prompt");
    return generateFallbackPrompt(sceneText, imageStyle, customStyle);
  }

  // Use custom style if provided, otherwise look up from presets
  const style = customStyle || STYLE_PRESETS[imageStyle] || DEFAULT_HISTORICAL_STYLE;

  const systemPrompt = `# ROLE
You are an expert AI image prompt engineer. Your prompts MUST strongly reflect the requested art style.

# CRITICAL: ART STYLE IS MANDATORY
You MUST generate an image prompt in this EXACT style:
**${style.art_style}**

The image MUST have:
- Composition: ${style.composition}
- Colors/Lighting: ${style.color_style}
- Details: ${style.fine_details}

# INSTRUCTIONS
1. START the prompt with the art style keywords (e.g., "3D Pixar animation", "anime illustration", "photorealistic")
2. Describe the scene subjects, actions, and setting
3. Include specific visual details: lighting, camera angle, atmosphere
4. Keep the prompt 100-200 words
5. no mordern tools orequipemnt or UI allowed 
6. no text or watermarks, no mordern army or uniform is allow each prompt must be detailed and protrat the story without issues

# CONSTRAINTS
- Output ONLY the image prompt - no explanations
- 16:9 landscape format
- NEVER include text, watermarks, or UI elements
- NEVER use "create an image of" - describe directly`;

  const userPrompt = `# SCENE TO VISUALIZE
"${sceneText}"

# MANDATORY ART STYLE (you MUST apply this style)
${style.art_style}

# YOUR OUTPUT
Generate ONE image prompt. START with the art style, then describe the scene.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
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
      logError("Groq", "Groq API error", undefined, { status: response.status, error: errorText.slice(0, 200) });
      return generateFallbackPrompt(sceneText, imageStyle, customStyle);
    }

    const data = await response.json();
    const generatedPrompt = data.choices?.[0]?.message?.content?.trim();

    if (generatedPrompt) {
      logInfo("Groq", "Generated image prompt", { preview: generatedPrompt.slice(0, 100) });
      return generatedPrompt;
    }

    return generateFallbackPrompt(sceneText, imageStyle, customStyle);
  } catch (error) {
    logError("Groq", "Image prompt generation error", error);
    return generateFallbackPrompt(sceneText, imageStyle, customStyle);
  }
}

function generateFallbackPrompt(sceneText: string, imageStyle: string, customStyle?: HistoricalStyle): string {
  // If custom style settings are provided, use them
  if (customStyle) {
    return `${customStyle.art_style} ${customStyle.composition} ${customStyle.color_style} ${customStyle.fine_details} Scene depicting: ${sceneText}, no text or watermarks, 16:9 landscape format`;
  }

  // Try to get style from presets
  const preset = STYLE_PRESETS[imageStyle];
  if (preset) {
    return `${preset.art_style} ${preset.composition} ${preset.color_style} ${preset.fine_details} Scene depicting: ${sceneText}, no text or watermarks, 16:9 landscape format`;
  }

  // Fallback to simple descriptions if no preset found
  const styleDescriptions: Record<string, string> = {
    historical: "romantic oil painting style, aged textures, warm golden lighting, period-appropriate architecture and clothing, subdued color palette",
    cinematic: "cinematic, high-quality, dramatic lighting, movie-like composition",
    anime: "anime style, Japanese animation, vibrant colors, detailed",
    realistic: "photorealistic, detailed, natural lighting, professional photography",
    illustration: "digital illustration, artistic, clean lines, modern design",
    pixar: "high-quality 3D Pixar animation, expressive characters, vibrant colors, cinematic lighting, Pixar-inspired CGI aesthetic",
    abstract: "abstract artistic visuals, creative composition, bold colors",
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
        model: "openai/gpt-oss-120b",
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
      logError("Groq", "Script API error", undefined, { status: response.status, error: errorText.slice(0, 200) });
      throw new Error("Groq API request failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in Groq response");
    }

    let parsed: { script?: string; scenes?: string[] };
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      logError("Groq", "Failed to parse JSON response", undefined, { preview: content.slice(0, 200) });
      // Fallback: treat the entire response as the script
      return {
        title: `Video about ${topic}`,
        script: content,
        scenes: content.split(/\n\n+/).filter((s: string) => s.trim()),
      };
    }

    const script = parsed.script || parsed.scenes?.join("\n\n") || "";
    const scenes = parsed.scenes || script.split(/\n\n+/).filter((s: string) => s.trim()) || [];

    return {
      title: `Video about ${topic}`,
      script,
      scenes,
    };
  } catch (error: any) {
    logError("Groq", "Script generation error", error);
    if (error.message?.includes("API key not configured")) {
      throw error;
    }
    throw new Error("Failed to generate script with Groq");
  }
}
