import { getResolvedApiKey } from "./api-keys";
import { logInfo, logError, logWarning } from "./logger";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

const MASTER_STYLE_INSTRUCTION = `High-end historical epic documentary aesthetic, 19th-century academic military realism, cinematic oil painting, thick impasto brushstrokes, visible canvas texture, muted earth tones, dramatic chiaroscuro lighting, smoky atmosphere, historical accuracy, aged parchment cartography, vintage textured infographics, hand-inked military schematics, premium documentary look, desaturated palette, immersive cinematic composition, 16:9, highly detailed.`;

export interface HistoricalStyle {
  art_style: string;
  composition: string;
  color_style: string;
  fine_details: string;
}

export interface ClaudeImagePromptOptions {
  sceneText: string;
  imageStyle?: string;
  customStyle?: HistoricalStyle;
  model?: string;
}

const STYLE_PRESETS: Record<string, HistoricalStyle> = {
  historical: {
    art_style: "Digital concept art mimicking romantic oil painting with soft, painterly brushstrokes.",
    composition: "One-point perspective leading down a central street, framed by tall buildings on both sides.",
    color_style: "Warm golden sunlight and earthy browns contrasted against cool blue clothing and shadows.",
    fine_details: "Weathered stone architecture, medieval peasant attire, and market stalls with canvas awnings."
  },
  pixar: {
    art_style: "High-quality 3D Pixar animation in the style of a modern animated film, highly detailed stylized character design with expressive features, Pixar-inspired CGI aesthetic, rendered in Octane.",
    composition: "Macro shot with shallow depth of field and soft bokeh background, cinematic framing.",
    color_style: "Rich textures, vibrant colors, 8k resolution, cinematic volumetric lighting with warm amber glow and soft rim light.",
    fine_details: "Large expressive eyes, rounded simplified stylized features, smooth highly detailed 3D rendered surfaces, no text."
  },
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

function generateClaudeFallbackPrompt(sceneText: string, imageStyle?: string, customStyle?: HistoricalStyle): string {
  if (customStyle) {
    return `${customStyle.art_style} ${customStyle.composition} ${customStyle.color_style} ${customStyle.fine_details} Scene depicting: ${sceneText}, no text or watermarks, 16:9 landscape format`;
  }

  const preset = imageStyle ? STYLE_PRESETS[imageStyle] : undefined;
  if (preset) {
    return `${preset.art_style} ${preset.composition} ${preset.color_style} ${preset.fine_details} Scene depicting: ${sceneText}, no text or watermarks, 16:9 landscape format`;
  }

  return `${MASTER_STYLE_INSTRUCTION} Scene depicting: ${sceneText}, no text or watermarks, 16:9 landscape format`;
}

export async function generateImagePromptWithClaude(options: ClaudeImagePromptOptions): Promise<string> {
  const { sceneText, imageStyle = "historical", customStyle, model = "claude-sonnet-4-6" } = options;
  const apiKey = await getResolvedApiKey("anthropic");

  if (!apiKey) {
    logWarning("Claude", "ANTHROPIC_API_KEY not configured, using fallback prompt");
    return generateClaudeFallbackPrompt(sceneText, imageStyle, customStyle);
  }

  // Determine style description
  let styleDesc: string;
  if (customStyle) {
    styleDesc = `${customStyle.art_style}. Composition: ${customStyle.composition}. Colors/Lighting: ${customStyle.color_style}. Details: ${customStyle.fine_details}`;
  } else {
    const preset = STYLE_PRESETS[imageStyle];
    if (preset) {
      styleDesc = `${preset.art_style}. Composition: ${preset.composition}. Colors/Lighting: ${preset.color_style}. Details: ${preset.fine_details}`;
    } else {
      // Use master style as fallback when no preset matches
      styleDesc = MASTER_STYLE_INSTRUCTION;
    }
  }

  const userPrompt = `# ROLE
You are a professional AI image prompt architect creating prompts for cinematic video scene visualization.

# SCENE TEXT
"${sceneText}"

# VISUAL STYLE
"${styleDesc}"

# REQUIREMENTS
1. Create a detailed, 100-200 word prompt based on the SCENE TEXT and VISUAL STYLE. Do not repeat the scene on the image — what we need is the image prompt.
2. You MUST strictly format your output into three distinct sections: "**Style:**", "**Subject:**", and "**Environment & Atmosphere:**".
3. Include cinematic camera angles, subject positioning, lighting direction, and rich textures.
4. Expand on the provided visual style to make the prompt highly descriptive.
5. No text on image, do not by any chance add this on image.

# CONSTRAINTS
- Output ONLY the prompt text in the three required sections — no explanations, alternatives, or preamble.
- Format: 16:9 landscape aspect ratio.
- FORBIDDEN: no text, words, letters, watermarks, signatures, logos, UI elements.
- FORBIDDEN: meta-phrases like "create an image of" or "an illustration showing".
- FORBIDDEN: real names of celebrities, public figures, politicians, or specific historical persons. You MUST anonymize them into generic physical descriptions (e.g., use "a middle-aged Roman general" instead of "Julius Caesar").

# OUTPUT FORMAT
**Style:** [Describe the art style, medium, and color palette based on the VISUAL STYLE and add no text on image]

**Subject:** [Describe the characters, action, camera angle, and positioning based on the SCENE TEXT]

**Environment & Atmosphere:** [Describe the lighting, weather, background, and mood]
Negative prompt : no text on image

Generate the structured image prompt now for the scene and style provided above.`;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const errorMessage = errorData?.error?.message || response.statusText;

      let friendlyError: string;
      if (response.status === 401) {
        friendlyError = "Invalid Anthropic API key. Please check your key in Settings.";
      } else if (response.status === 429) {
        friendlyError = "Claude rate limit reached (5 requests/minute). Please wait a moment.";
      } else if (response.status === 529) {
        friendlyError = "Claude is currently overloaded. Please try again in a few seconds.";
      } else {
        friendlyError = `Claude API error (status ${response.status}): ${errorMessage}`;
      }

      logError("Claude", friendlyError, undefined, { status: response.status });
      return generateClaudeFallbackPrompt(sceneText, imageStyle, customStyle);
    }

    const data = await response.json();
    const generatedPrompt = data.content?.[0]?.text?.trim();

    if (generatedPrompt) {
      logInfo("Claude", "Generated image prompt", { model, preview: generatedPrompt.slice(0, 100) });
      return generatedPrompt;
    }

    return generateClaudeFallbackPrompt(sceneText, imageStyle, customStyle);
  } catch (error) {
    logError("Claude", "Image prompt generation error", error);
    return generateClaudeFallbackPrompt(sceneText, imageStyle, customStyle);
  }
}
