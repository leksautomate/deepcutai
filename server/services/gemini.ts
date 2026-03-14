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
  scenePacing?: "auto" | "sentence" | "manual";
  customScript?: boolean; // If true, the `topic` acts as the exact text
}

export interface SceneData {
  narration: string;
  visual: string;
}

export interface GeneratedScript {
  title: string;
  script: string;
  scenes: SceneData[];
}

const VIRAL_SCRIPT_PROMPT = `# ROLE
You are a viral documentary scriptwriter who has created 100+ scripts with 10M+ views. Your specialty is short-form content that hooks viewers in 2 seconds and keeps them watching until the final reveal.

# CONTEXT
You write scripts for AI-narrated documentary videos on YouTube Shorts, TikTok, and Instagram Reels. These scripts are read by TTS engines and displayed as subtitles.all should be in one paragraph together

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
  "scenes": [
    { 
      "narration": "Paragraph 1 text to be spoken",
      "visual": "Detailed visual description of Paragraph 1"
    }
  ]
}

CRITICAL: Each paragraph in "script" becomes one scene. Aim for 4-8 scenes depending on duration.`;

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
  const { topic, style = "documentary", duration = "1min", userId, scenePacing, customScript } = options;

  let prompt = "";

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

    prompt = `You are a video script processor.

Your single job is to take the EXACT provided user script and format it into our required JSON structure for video generation.

# PACING RULES
${pacingInstructions}

# THE SCRIPT TO PROCESS
"${topic}"

Return your response as ONLY valid JSON:
{
  "script": "The exact script provided above, without changes to the words.",
  "scenes": [
    { 
       "narration": "The exact dialogue for this scene",
       "visual": "Detailed visual description of what is visible in the scene"
    }
  ]
}`;
  } else {
    // Standard AI Generation Flow
    const durationGuide = getDurationGuide(duration);

    prompt = `${VIRAL_SCRIPT_PROMPT}

## YOUR TASK

Create a script about: "${topic}"

Duration: ${durationGuide}

Style: ${style === "documentary" ? "Cold, factual documentary narrator" : style === "storytelling" ? "Narrative and immersive" : style === "entertaining" ? "Engaging with energy" : "Informative and clear"}

**REMEMBER: Output ONLY the script text and scenes. No titles, no labels, no explanations.**

Return your response as JSON:
{
  "script": "The full script with each sentence on its own line",
  "scenes": [
    { 
       "narration": "The exact dialogue for this scene",
       "visual": "Detailed visual description of what is visible in the scene"
    }
  ]
}`;
  }

  try {
    const ai = await getGeminiClient(userId);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("RAW GEMINI RESPONSE TEXT:", text);

    let parsed: { script?: string; scenes?: (string | { text: string })[] };
    try {
      if (text.trim().startsWith('{')) {
        parsed = JSON.parse(text);
      } else {
        // Find JSON block if there's markdown
        const match = text.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
      }
    } catch (parseError) {
      logError("Gemini", "Failed to parse JSON response", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        textPreview: text.slice(0, 500),
      });
      // Fallback: treat the entire response as the script
      const fallbackScenes = text.split(/\n\n+/).filter((s: string) => s.trim());
      return {
        title: `Video about ${topic}`,
        script: text,
        scenes: fallbackScenes.map(t => ({ narration: t, visual: t })),
      };
    }

    // Normalize scenes to SceneData[] (handle both string[] and object[] from AI)
    const rawScenes = parsed.scenes || [];
    const normalizedScenes: SceneData[] = rawScenes.map(s => {
      if (typeof s === "string") {
        return { narration: s, visual: s };
      }
      return { narration: (s as any).narration || (s as any).text || "", visual: (s as any).visual || (s as any).text || "" };
    });

    const script = parsed.script || normalizedScenes.map(s => s.narration).join("\n\n") || "";
    const scenes = normalizedScenes.length > 0
      ? normalizedScenes
      : script.split(/\n\n+/).filter((s: string) => s.trim()).map(t => ({ narration: t, visual: t }));

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

  const prompt = `ROLE
You are a professional AI image prompt architect creating prompts for cinematic video scene visualization.

# SCENE TEXT
"${sceneText}"

# VISUAL STYLE
"${styleDesc}"

# REQUIREMENTS
1. Create a detailed, 100-200 word prompt based on the SCENE TEXT and VISUAL STYLE.dont repeat the scene on the image what we need it the image prompt
2. You MUST strictly format your output into three distinct sections: "**Style:**", "**Subject:**", and "**Environment & Atmosphere:**".
3. Include cinematic camera angles, subject positioning, lighting direction, and rich textures.
4. Expand on the provided visual style to make the prompt highly descriptive.
5. Not text on image , do not by any chance add this on image

# CONSTRAINTS
- Output ONLY the prompt text in the three required sections - no explanations, alternatives, or preamble.
- Format: 16:9 landscape aspect ratio.
- FORBIDDEN: no text, words, letters, watermarks, signatures, logos, UI elements.
- FORBIDDEN: meta-phrases like "create an image of" or "an illustration showing".
- FORBIDDEN: real names of celebrities, public figures, politicians, or specific historical persons. You MUST anonymize them into generic physical descriptions (e.g., use "a middle-aged Roman general" instead of "Julius Caesar").

# OUTPUT FORMAT
**Style:** [Describe the art style, medium, and color palette based on the VISUAL STYLE and add no text on image]

**Subject:** [Describe the characters, action, camera angle, and positioning based on the SCENE TEXT]

**Environment & Atmosphere:** [Describe the lighting, weather, background, and mood]
Negative prompt : no text on image

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

// =============================================
// Script Wizard — 4-step guided generation
// =============================================

/**
 * Step 1: Generate 10 unusual/surprising angles for a topic.
 */
export async function wizardGenerateAngles(
  topic: string,
  userId?: string,
): Promise<string[]> {
  const prompt = `Hey, I've been thinking about this lately: "${topic}".
Can you give me 10 unusual, surprising, or underexplored reasons why this happened / existed / became important?
Please number them clearly. I'm looking for story angles that most people don't talk about.

IMPORTANT: Return ONLY a valid JSON array of strings. No markdown, no introduction.
Example: ["Reason 1 text", "Reason 2 text"]`;

  try {
    const ai = await getGeminiClient(userId);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = response.text || "[]";
    const parsed = JSON.parse(text);
    const angles: string[] = (Array.isArray(parsed) ? parsed : parsed.angles || []).map(
      (a: any) => typeof a === "string" ? a : a.angle || a.text || String(a)
    );
    return angles.slice(0, 10);
  } catch (error) {
    logError("Gemini", "Wizard step 1 (angles) error", error);
    if (error instanceof Error && error.message?.includes("API key not configured")) throw error;
    throw new Error("Failed to generate angles");
  }
}

/**
 * Step 2: Generate 5 specific ideas from a selected angle.
 */
export async function wizardGenerateIdeas(
  topic: string,
  angle: string,
  userId?: string,
): Promise<string[]> {
  const prompt = `Topic: ${topic}
I think reason number "${angle}" is really interesting.
Can you break down that one reason into 5 short, specific ideas — events, turning points, contradictions, or facts — that are shocking, emotional, or visually powerful?
Keep them tightly related to that reason.

IMPORTANT: Return ONLY a valid JSON array of strings. No markdown.
Example: ["Idea 1 text", "Idea 2 text"]`;

  try {
    const ai = await getGeminiClient(userId);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = response.text || "[]";
    const parsed = JSON.parse(text);
    const ideas: string[] = (Array.isArray(parsed) ? parsed : parsed.ideas || []).map(
      (i: any) => typeof i === "string" ? i : i.title || i.text || String(i)
    );
    return ideas.slice(0, 5);
  } catch (error) {
    logError("Gemini", "Wizard step 2 (ideas) error", error);
    if (error instanceof Error && error.message?.includes("API key not configured")) throw error;
    throw new Error("Failed to generate ideas");
  }
}

/**
 * Step 3: Generate a single dramatic hook for a selected idea.
 */
export async function wizardGenerateHook(
  topic: string,
  idea: string,
  userId?: string,
): Promise<string> {
  const prompt = `I want you to help me create a short, dramatic hook for "${idea}" related to topic: ${topic}.
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

IMPORTANT: Return ONLY the hook text. No explanations, no JSON, no markdown.`;

  try {
    const ai = await getGeminiClient(userId);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return (response.text || "").trim();
  } catch (error) {
    logError("Gemini", "Wizard step 3 (hook) error", error);
    if (error instanceof Error && error.message?.includes("API key not configured")) throw error;
    throw new Error("Failed to generate hook");
  }
}

/**
 * Step 4: Generate the full script from an approved hook and idea.
 */
export async function wizardGenerateFullScript(
  topic: string,
  idea: string,
  hook: string,
  userId?: string,
): Promise<GeneratedScript> {
  const prompt = `Write a dramatic short story in this exact format and pacing for the following topic "${idea}" (related to: ${topic}).
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

Return ONLY valid JSON: { "script": "full script text with paragraphs separated by blank lines", "scenes": [{ "narration": "dialogue", "visual": "visuals" }] }`;

  try {
    const ai = await getGeminiClient(userId);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = response.text || "";
    let parsed: { script?: string; scenes?: (string | { text: string })[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      const fallbackScenes = text.split(/\n\n+/).filter((s: string) => s.trim());
      return {
        title: idea.split(/[.!?]/)[0] || "Untitled",
        script: text,
        scenes: fallbackScenes.map(t => ({ narration: t, visual: t })),
      };
    }

    const rawScenes = parsed.scenes || [];
    const normalizedScenes: SceneData[] = rawScenes.map(s => {
      if (typeof s === "string") return { narration: s, visual: s };
      return { narration: (s as any).narration || (s as any).text || "", visual: (s as any).visual || (s as any).text || "" };
    });

    const script = parsed.script || normalizedScenes.map(s => s.narration).join("\n\n") || "";
    const scenes = normalizedScenes.length > 0
      ? normalizedScenes
      : script.split(/\n\n+/).filter((s: string) => s.trim()).map(t => ({ narration: t, visual: t }));

    return {
      title: idea.split(/[.!?]/)[0] || "Untitled",
      script,
      scenes,
    };
  } catch (error) {
    logError("Gemini", "Wizard step 4 (full script) error", error);
    if (error instanceof Error && error.message?.includes("API key not configured")) throw error;
    throw new Error("Failed to generate script");
  }
}
