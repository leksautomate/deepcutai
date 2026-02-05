import * as fs from "fs";
import * as path from "path";
import { logInfo } from "./logger";
import type { WordAlignment } from "../../shared/schema";

export interface CaptionStyle {
  id: string;
  name: string;
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  backColor: string;
  outline: number;
  shadow: number;
  alignment: number;
  marginV: number;
  bold: boolean;
  italic: boolean;
}

export const CAPTION_STYLES: CaptionStyle[] = [
  {
    id: "classic",
    name: "Classic White",
    fontName: "Arial",
    fontSize: 48,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&H80000000",
    outline: 2,
    shadow: 1,
    alignment: 2,
    marginV: 50,
    bold: false,
    italic: false,
  },
  {
    id: "bold-yellow",
    name: "Bold Yellow",
    fontName: "Impact",
    fontSize: 52,
    primaryColor: "&H00FFFF",
    outlineColor: "&H000000",
    backColor: "&H00000000",
    outline: 3,
    shadow: 2,
    alignment: 2,
    marginV: 40,
    bold: true,
    italic: false,
  },
  {
    id: "minimal",
    name: "Minimal",
    fontName: "Helvetica",
    fontSize: 42,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H00000000",
    backColor: "&H00000000",
    outline: 0,
    shadow: 0,
    alignment: 2,
    marginV: 60,
    bold: false,
    italic: false,
  },
  {
    id: "netflix",
    name: "Netflix Style",
    fontName: "Arial",
    fontSize: 46,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&H80000000",
    outline: 0,
    shadow: 0,
    alignment: 2,
    marginV: 45,
    bold: true,
    italic: false,
  },
  {
    id: "karaoke",
    name: "Karaoke Pop",
    fontName: "Comic Sans MS",
    fontSize: 50,
    primaryColor: "&H00FF00",
    outlineColor: "&HFF00FF",
    backColor: "&H00000000",
    outline: 3,
    shadow: 2,
    alignment: 2,
    marginV: 50,
    bold: true,
    italic: false,
  },
  {
    id: "documentary",
    name: "Documentary",
    fontName: "Georgia",
    fontSize: 44,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H404040",
    backColor: "&H00000000",
    outline: 2,
    shadow: 1,
    alignment: 2,
    marginV: 55,
    bold: false,
    italic: true,
  },
  {
    id: "tiktok",
    name: "TikTok Viral",
    fontName: "Arial Black",
    fontSize: 56,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&H00000000",
    outline: 4,
    shadow: 0,
    alignment: 2,
    marginV: 35,
    bold: true,
    italic: false,
  },
  {
    id: "boxed",
    name: "Boxed",
    fontName: "Arial",
    fontSize: 44,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&HCC000000",
    outline: 0,
    shadow: 0,
    alignment: 2,
    marginV: 50,
    bold: true,
    italic: false,
  },
];

export function getCaptionStyle(styleId: string): CaptionStyle {
  return CAPTION_STYLES.find(s => s.id === styleId) || CAPTION_STYLES[0];
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(2);
  return `${h}:${m.toString().padStart(2, "0")}:${s.padStart(5, "0")}`;
}

// Split text into max 2 lines for display (no dashes added)
function splitIntoTwoLines(text: string): string {
  const words = text.split(/\s+/).filter(w => w.trim());
  if (words.length <= 4) {
    // Short text: display on one line
    return words.join(" ");
  }
  // Split roughly in half for two lines
  const midpoint = Math.ceil(words.length / 2);
  const line1 = words.slice(0, midpoint).join(" ");
  const line2 = words.slice(midpoint).join(" ");
  return `${line1}\\N${line2}`;
}

// Split text into chunks of maxWords (8-10 words per caption)
function splitTextByWordCount(text: string, maxWords: number = 8): string[] {
  const words = text.split(/\s+/).filter(w => w.trim());
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords).join(" ");
    if (chunk) chunks.push(chunk);
  }
  
  return chunks;
}

export interface SceneWithAlignment {
  text: string;
  duration: number;
  wordAlignment?: WordAlignment;
}

export function generateAssSubtitles(
  scenes: SceneWithAlignment[],
  style: CaptionStyle,
  width: number = 1920,
  height: number = 1080,
  position?: string
): string {
  // Map position to ASS alignment value (default: bottom-center = 2)
  const positionToAlignment: Record<string, number> = {
    "bottom-left": 1,
    "bottom-center": 2,
    "bottom-right": 3,
    "middle-center": 5,
    "top-left": 7,
    "top-center": 8,
    "top-right": 9,
  };
  const alignment = position ? (positionToAlignment[position] || style.alignment) : style.alignment;
  
  // Adjust marginV based on position
  let marginV = style.marginV;
  if (position?.startsWith("top")) {
    marginV = 50; // margin from top
  } else if (position?.startsWith("middle")) {
    marginV = Math.floor(height / 4); // approximate center margin
  }

  const header = `[Script Info]
Title: DeepCut AI Captions
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},${style.backColor},${style.bold ? -1 : 0},${style.italic ? -1 : 0},0,0,100,100,0,0,${style.backColor !== "&H00000000" ? 3 : 1},${style.outline},${style.shadow},${alignment},20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let currentTime = 0;
  const events: string[] = [];
  const MAX_WORDS_PER_CAPTION = 8; // Limit captions to 8-10 words

  for (const scene of scenes) {
    if (!scene.text || scene.text.trim() === "") {
      currentTime += scene.duration;
      continue;
    }

    // Use word alignment for precise timing if available and valid
    const hasValidWordAlignment = scene.wordAlignment && 
      scene.wordAlignment.words.length > 0 &&
      scene.wordAlignment.wordStartTimeSeconds.length === scene.wordAlignment.words.length &&
      scene.wordAlignment.wordEndTimeSeconds.length === scene.wordAlignment.words.length;
    
    if (hasValidWordAlignment) {
      const { words, wordStartTimeSeconds, wordEndTimeSeconds } = scene.wordAlignment!;
      
      // Group words into chunks of max 8 words with precise timing
      for (let i = 0; i < words.length; i += MAX_WORDS_PER_CAPTION) {
        const chunkWords = words.slice(i, i + MAX_WORDS_PER_CAPTION);
        const chunkText = chunkWords.join(" ");
        if (!chunkText.trim()) continue;
        
        // Safely get timing with fallback
        const chunkStartTime = currentTime + (wordStartTimeSeconds[i] ?? 0);
        const lastWordIndex = Math.min(i + MAX_WORDS_PER_CAPTION - 1, words.length - 1);
        const chunkEndTime = currentTime + (wordEndTimeSeconds[lastWordIndex] ?? scene.duration);
        
        // Validate timing is sane
        if (chunkStartTime >= chunkEndTime || isNaN(chunkStartTime) || isNaN(chunkEndTime)) {
          continue; // Skip invalid timing, fallback will handle
        }
        
        const displayText = splitIntoTwoLines(chunkText);
        
        events.push(
          `Dialogue: 0,${formatAssTime(chunkStartTime)},${formatAssTime(chunkEndTime)},Default,,0,0,0,,${displayText}`
        );
      }
    } else {
      // Fallback: Split scene text into word-based chunks (max 8 words each)
      const chunks = splitTextByWordCount(scene.text, MAX_WORDS_PER_CAPTION);

      if (chunks.length === 0) {
        currentTime += scene.duration;
        continue;
      }

      const timePerChunk = scene.duration / chunks.length;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        if (!chunk) continue;

        // Display on one line or split to two lines (no dashes)
        const displayText = splitIntoTwoLines(chunk);

        const startTime = currentTime + i * timePerChunk;
        const endTime = startTime + timePerChunk - 0.05;

        events.push(
          `Dialogue: 0,${formatAssTime(startTime)},${formatAssTime(endTime)},Default,,0,0,0,,${displayText}`
        );
      }
    }

    currentTime += scene.duration;
  }

  return header + events.join("\n");
}

export function saveAssFile(
  projectDir: string,
  scenes: SceneWithAlignment[],
  styleId: string,
  width: number = 1920,
  height: number = 1080,
  position?: string
): string {
  const style = getCaptionStyle(styleId);
  const assContent = generateAssSubtitles(scenes, style, width, height, position);
  
  const assPath = path.join(projectDir, "captions.ass");
  fs.writeFileSync(assPath, assContent, "utf-8");
  
  logInfo("Captions", `Generated ASS file with style: ${style.name} (word-aligned: ${scenes.some(s => s.wordAlignment)})`);
  
  
  return assPath;
}
