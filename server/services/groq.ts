import { getResolvedApiKey } from "./api-keys";
import { logInfo, logError, logWarning } from "./logger";
import { getAppSettings } from "./settings";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface ImagePromptOptions {
  sceneText: string;
  imageStyle?: string;
  customStyle?: HistoricalStyle;
}

import type { ReferenceAsset } from "@shared/schema";

export interface GroqScriptOptions {
  topic: string;
  style?: "educational" | "entertaining" | "documentary" | "storytelling";
  duration?: "30s" | "1min" | "2min" | "10min";
  userId?: string;
  customCharacters?: ReferenceAsset[];
  scenePacing?: "auto" | "sentence" | "manual";
  customScript?: boolean;
  imageStyle?: string;
}

export interface GroqSceneData {
  narration: string;
  visual: string;
}

export interface GroqGeneratedScript {
  title: string;
  script: string;
  scenes: GroqSceneData[];
}

const VIRAL_SCRIPT_SYSTEM_PROMPT = `# ROLE
You are a viral documentary scriptwriter who has created 100+ scripts with 10M+ views. Your specialty is short-form content that hooks viewers in 2 seconds and keeps them watching until the final reveal.all should be in one paragraph together

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
❌ Real names of celebrities, politicians, or public figures in the visual descriptions (anonymize them into generic physical descriptions instead)

# OUTPUT FORMAT

Return ONLY valid JSON with this exact structure:
{
  "script": "Full script with one sentence per line, paragraphs separated by blank lines",
  "scenes": [
    { 
      "narration": "Paragraph 1 text to be spoken",
      "visual": "**Style:** [Describe the art style, medium, and color palette based on the VISUAL STYLE]\\n\\n**Subject:** [Describe the characters, action, camera angle, and positioning based on the SCENE TEXT]\\n\\n**Environment & Atmosphere:** [Describe the lighting, weather, background, and mood]"
    }
  ]
}

CRITICAL: Each paragraph in "script" becomes one scene. Aim for 4-8 scenes depending on duration.`;


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

  const styleDesc = `${style.art_style}. Composition: ${style.composition}. Colors/Lighting: ${style.color_style}. Details: ${style.fine_details}`;

  const systemPrompt = `# ROLE
You are a professional AI image prompt architect creating prompts for cinematic video scene visualization.

# SCENE TEXT
"${sceneText}"

# VISUAL STYLE
"${styleDesc}"

# REQUIREMENTS
1. Create a detailed, 100-200 word prompt based on the SCENE TEXT and VISUAL STYLE.
2. You MUST strictly format your output into three distinct sections: "**Style:**", "**Subject:**", and "**Environment & Atmosphere:**".
3. Include cinematic camera angles, subject positioning, lighting direction, and rich textures.
4. Expand on the provided visual style to make the prompt highly descriptive.

# CONSTRAINTS
- Output ONLY the prompt text in the three required sections - no explanations, alternatives, or preamble.
- Format: 16:9 landscape aspect ratio.
- FORBIDDEN: text, words, letters, watermarks, signatures, logos, UI elements.
- FORBIDDEN: meta-phrases like "create an image of" or "an illustration showing".
- FORBIDDEN: real names of celebrities, public figures, politicians, or specific historical persons. You MUST anonymize them into generic physical descriptions (e.g., use "a middle-aged Roman general" instead of "Julius Caesar").

# OUTPUT FORMAT
**Style:** [Describe the art style, medium, and color palette based on the VISUAL STYLE]

**Subject:** [Describe the characters, action, camera angle, and positioning based on the SCENE TEXT]

**Environment & Atmosphere:** [Describe the lighting, weather, background, and mood]

# OUTPUT
[Your detailed image prompt here]`;

  const userPrompt = `Generate the structured image prompt now for the scene and style provided in your system instructions.`;

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
  const { topic, style = "documentary", duration = "1min", userId, customCharacters, scenePacing, customScript, imageStyle = "doodle" } = options;
  const apiKey = await getResolvedApiKey("groq", userId);

  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured. Please add it in Settings.");
  }

  let prompt = "";
  let systemContent = VIRAL_SCRIPT_SYSTEM_PROMPT;

  // Handle Character Injections
  let castInstructions = "";
  if (customCharacters && customCharacters.length > 0) {
    const castDescriptions = customCharacters.map(c => `[${c.name}]: ${c.promptText}`).join("\n");

    // Dynamically build the requested Art Style Constraints
    let styleConstraint = "";
    if (imageStyle === "doodle") {
      styleConstraint = `• Style: Simple 2D hand-drawn minimalist cartoon / doodle illustration
• Visual feel similar to basic explainer illustrations (thin black outlines, flat fills)
• NO realism, NO 3D, NO cinematic lighting
• Character centered or slightly off-center
• Clean white or very light background
• Thin or medium black outlines (not sketchy, not painterly)
• Flat pastel or muted colours with very light or no shading
• Simple facial features (round head, minimal eyes, eyebrows, mouth)
• Clear, exaggerated facial expressions matching the script line emotion`;
    } else {
      let preset = STYLE_PRESETS[imageStyle] || STYLE_PRESETS["realistic"];

      // Check for user-created custom styles if not found in hardcoded presets
      if (imageStyle.startsWith("custom_")) {
        const settings = getAppSettings();
        const customId = imageStyle.replace("custom_", "");
        const foundStyle = settings.customImageStyles?.find(s => s.id === customId);
        if (foundStyle) {
          preset = {
            art_style: foundStyle.styleText,
            composition: "Dynamic character framing",
            color_style: "Matches art style mood",
            fine_details: "High quality rendering preserving character details"
          };
        }
      }

      styleConstraint = `• Art Style: ${preset.art_style}
• Composition: ${preset.composition}
• Colors and Lighting: ${preset.color_style}
• Details: ${preset.fine_details}
• Ensure characters remain perfectly consistent in appearance across all frames using the exact provided descriptions.`;
    }

    castInstructions = `
You are a professional AI visual storyboard engineer specialising in YouTube videos.

# CAST REQUIREMENTS (CRITICAL)
The following characters are starring in this video:
${castDescriptions}

IMAGE PROMPT REQUIREMENTS (MANDATORY):
• Full-body view of the SAME character in every image based on the cast descriptions
• Head-to-toe visibility — NEVER cropped
${styleConstraint}

Character Identity (STRICT):
• The Image Prompt MUST explicitly mention the character's name and visual description at the beginning of EVERY image prompt.
• Example format: "Full-body illustration of [actor name], [actor description] standing..."
• The same styling must be used consistently across all image prompts.

Character clothing (keep identical every time):
• Plain T-shirt or hoodie
• Simple jeans or trousers
• Basic sneakers
• No logos, no patterns

Props (ONLY when relevant to the script line):
• Props must match the visual art style requested
• NO text of any kind inside the image
• Clean, uncluttered composition
• Clearly describe pose, facial expression, body language, props, and explicitly confirm full-body framing
`;
  }

  if (customScript) {
    // Custom Script Flow
    let pacingInstructions = "";
    if (scenePacing === "sentence") {
      pacingInstructions = "Break the script into visual scenes sentence-by-sentence. Every single sentence must be its own scene.";
    } else if (scenePacing === "manual") {
      pacingInstructions = "Break the script into visual scenes strictly based on the user's [SCENE] markers in the text.";
    } else {
      pacingInstructions = "Break the script into logical visual scenes that last approximately 5-7 seconds of speaking time each.";
    }

    systemContent = `You are a video script processor.
    
Your single job is to take the EXACT provided user script and format it into our required JSON structure for video generation.

${castInstructions}

# PACING RULES
${pacingInstructions}`;

    prompt = `# THE SCRIPT TO PROCESS
"${topic}"

Return your response as ONLY valid JSON:
{
  "script": "The exact script provided above, without changes to the words.",
  "scenes": [
    { 
       "narration": "The exact dialogue for this scene",
       "visual": "**Style:** [Describe the art style, medium, and color palette based on the VISUAL STYLE]\\n\\n**Subject:** [Describe the characters, action, camera angle, and positioning based on the SCENE TEXT]\\n\\n**Environment & Atmosphere:** [Describe the lighting, weather, background, and mood]"
    }
  ]
}`;
  } else {
    // Standard AI Generation Flow
    const durationGuide = getGroqDurationGuide(duration);

    systemContent = `${VIRAL_SCRIPT_SYSTEM_PROMPT}\n${castInstructions}`;

    prompt = `## YOUR TASK

Create a script about: "${topic}"

Duration: ${durationGuide}

Style: ${style === "documentary" ? "Cold, factual documentary narrator" : style === "storytelling" ? "Narrative and immersive" : style === "entertaining" ? "Engaging with energy" : "Informative and clear"}`;
  }

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
          { role: "system", content: systemContent },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
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

    let parsed: { script?: string; scenes?: (string | { text: string })[] };
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      logError("Groq", "Failed to parse JSON response", undefined, { preview: content.slice(0, 200) });
      // Fallback: treat the entire response as a script, splitting by double newlines
      const fallbackScenes = content.split("\n\n").filter(Boolean);
      return {
        title: "Generated Video",
        script: content,
        scenes: fallbackScenes.map((s: string) => ({ narration: s, visual: s }))
      };
    }

    // Normalize scenes to GroqSceneData[] (handle both string[] and object[] from AI)
    const rawScenes = parsed.scenes || [];
    const normalizedScenes: GroqSceneData[] = rawScenes.map(s => {
      if (typeof s === "string") {
        return { narration: s, visual: s };
      }
      return { narration: (s as any).narration || (s as any).text || "", visual: (s as any).visual || (s as any).text || "" };
    });

    const script = parsed.script || normalizedScenes.map(s => s.narration).join("\n\n") || "";
    const scenes = normalizedScenes.length > 0
      ? normalizedScenes
      : script.split(/\n\n+/).filter((s: string) => s.trim()).map((t: string) => ({ narration: t, visual: t }));

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

// =============================================
// Script Wizard — 4-step guided generation (Groq)
// =============================================

export async function groqJsonRequest(
  systemPrompt: string,
  userPrompt: string,
  userId?: string,
  maxTokens: number = 2000
): Promise<any> {
  const apiKey = await getResolvedApiKey("groq", userId);
  if (!apiKey) {
    throw new Error("Groq API key not configured. Please add it in Settings.");
  }

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
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logError("Groq", "Wizard API error", undefined, { status: response.status, error: errorText.slice(0, 200) });
    throw new Error("Groq API request failed");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in Groq response");
  return JSON.parse(content);
}

async function groqTextRequest(systemPrompt: string, userPrompt: string, userId?: string, maxTokens = 2000): Promise<string> {
  const apiKey = await getResolvedApiKey("groq", userId);
  if (!apiKey) {
    throw new Error("Groq API key not configured. Please add it in Settings.");
  }

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
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logError("Groq", "Text API error", undefined, { status: response.status, error: errorText.slice(0, 200) });
    throw new Error("Groq API request failed");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in Groq response");
  return content;
}

/**
 * Step 1: Generate 10 unusual/surprising angles for a topic (Groq).
 */
export async function wizardGenerateAnglesWithGroq(
  topic: string,
  userId?: string,
): Promise<string[]> {
  const systemPrompt = "You are a viral content strategist. Return ONLY valid JSON arrays.";
  const userPrompt = `Hey, I've been thinking about this lately: "${topic}".
Can you give me 10 unusual, surprising, or underexplored reasons why this happened / existed / became important?
I'm looking for story angles that most people don't talk about.

Return as JSON: { "angles": ["Reason 1 text", "Reason 2 text", ...] }`;

  try {
    const parsed = await groqJsonRequest(systemPrompt, userPrompt, userId);
    const angles: string[] = (Array.isArray(parsed) ? parsed : parsed.angles || []).map(
      (a: any) => typeof a === "string" ? a : a.angle || a.text || String(a)
    );
    return angles.slice(0, 10);
  } catch (error: any) {
    logError("Groq", "Wizard step 1 (angles) error", error);
    if (error.message?.includes("API key not configured")) throw error;
    throw new Error("Failed to generate angles with Groq");
  }
}

/**
 * Step 2: Generate 5 specific ideas from a selected angle (Groq).
 */
export async function wizardGenerateIdeasWithGroq(
  topic: string,
  angle: string,
  userId?: string,
): Promise<string[]> {
  const systemPrompt = "You are a viral video concept developer. Return ONLY valid JSON.";
  const userPrompt = `Topic: ${topic}
I think reason number "${angle}" is really interesting.
Can you break down that one reason into 5 short, specific ideas — events, turning points, contradictions, or facts — that are shocking, emotional, or visually powerful?
Keep them tightly related to that reason.

Return as JSON: { "ideas": ["Idea 1 text", "Idea 2 text", ...] }`;

  try {
    const parsed = await groqJsonRequest(systemPrompt, userPrompt, userId);
    const ideas: string[] = (Array.isArray(parsed) ? parsed : parsed.ideas || []).map(
      (i: any) => typeof i === "string" ? i : i.title || i.text || String(i)
    );
    return ideas.slice(0, 5);
  } catch (error: any) {
    logError("Groq", "Wizard step 2 (ideas) error", error);
    if (error.message?.includes("API key not configured")) throw error;
    throw new Error("Failed to generate ideas with Groq");
  }
}

/**
 * Step 3: Generate a single dramatic hook for a selected idea (Groq).
 */
export async function wizardGenerateHookWithGroq(
  topic: string,
  idea: string,
  userId?: string,
): Promise<string> {
  const systemPrompt = "You are an expert hook writer for viral short-form videos. You create instant mystery and tension. Return ONLY the hook text, nothing else.";
  const userPrompt = `I want you to help me create a short, dramatic hook for "${idea}" related to topic: ${topic}.
Don't mention names, countries, or places directly. Use words like this man, this woman, this city, this village, etc.

Here's the structure I want:

Start with: "This [character type]" (e.g. "This girl," "This soldier")
Add a short phrase describing where or when, in parentheses: (e.g. "(in a war-torn village)")
Then, add one powerful trait or unique detail that makes them special
Then, describe one key action they did
Then, pause (add a line break or em dash)
Finally, give a twist or consequence. A reversal. Something unexpected, ironic, tragic, or mysterious.

Example Output:
This girl (in medieval France) dressed like a soldier, claimed she spoke to God, and led an army — just to be betrayed by the king she fought for.

IMPORTANT: Return ONLY the hook text. No explanations.`;

  try {
    const text = await groqTextRequest(systemPrompt, userPrompt, userId);
    return text.trim();
  } catch (error: any) {
    logError("Groq", "Wizard step 3 (hook) error", error);
    if (error.message?.includes("API key not configured")) throw error;
    throw new Error("Failed to generate hook with Groq");
  }
}

/**
 * Step 4: Generate the full script from an approved hook and idea (Groq).
 */
export async function wizardGenerateFullScriptWithGroq(
  topic: string,
  idea: string,
  hook: string,
  userId?: string,
): Promise<GroqGeneratedScript> {
  const systemPrompt = VIRAL_SCRIPT_SYSTEM_PROMPT;
  const userPrompt = `Write a dramatic short story in this exact format and pacing for the following topic "${idea}" (related to: ${topic}).
Each sentence should be short and cinematic — like subtitles. No long paragraphs.

The approved hook to use as the opening: "${hook}"

Follow this 7-part structure exactly:

CONTEXT (PART 1)
Start with the date and place: "It's [year]. [City or country]."
Introduce characters and setup in simple, factual lines
Add a cultural or shocking historical norm

SMALL TWIST (PART 2)
Use a transitional line like "And for a while… it worked."
Add a sentence or two showing early success or tension building

PLOT TWIST (PART 3)
Show what went wrong
Add betrayal, ambition, or power struggle
End with a dramatic shift (exile, downfall, turning point)

CONTEXT (PART 4)
Show how the main character responded
Use short action sentences (e.g. "She camped outside the walls. Built an army.")
Mention an important alliance if relevant

SMALL TWIST (PART 5)
Use a quiet tension line (e.g. "And one night… she snuck back in.")
Do not overexplain — it's a stealth or setup move

FINAL CONSEQUENCE (PART 6)
Reveal the major event or fallout
Keep it mysterious ("No one knows how." "But one thing was clear…")

REVEAL (PART 7)
Final punchline with identity:
"And the [girl/man/place] who did it… was [name]."

Tone should be visual, cold, and factual — like a narrated historical scene.
No internal thoughts. No explanations. Just actions and outcomes. Do not include the Headers (like "CONTEXT (PART 1)"), just the script text.

Return as JSON: { "script": "full script text with paragraphs separated by blank lines", "scenes": [{ "text": "paragraph" }] }`;

  try {
    const parsed = await groqJsonRequest(systemPrompt, userPrompt, userId, 8000);

    const rawScenes = parsed.scenes || [];
    const normalizedScenes: GroqSceneData[] = rawScenes.map((s: any) => {
      if (typeof s === "string") return { narration: s, visual: s };
      return { narration: s.narration || s.text || "", visual: s.visual || s.text || "" };
    });

    const script = parsed.script || normalizedScenes.map(s => s.narration).join("\n\n") || "";
    const scenes = normalizedScenes.length > 0
      ? normalizedScenes
      : script.split(/\n\n+/).filter((s: string) => s.trim()).map((t: string) => ({ narration: t, visual: t }));

    return {
      title: idea.split(/[.!?]/)[0] || "Untitled",
      script,
      scenes,
    };
  } catch (error: any) {
    logError("Groq", "Wizard step 4 (full script) error", error);
    if (error.message?.includes("API key not configured")) throw error;
    throw new Error("Failed to generate script with Groq");
  }
}
