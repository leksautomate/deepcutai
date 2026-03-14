import * as fs from "fs";
import * as path from "path";

interface ImageStyleSettings {
  art_style: string;
  composition: string;
  color_style: string;
  fine_details: string;
}

interface SceneSettings {
  firstPageFrequency: number;
  restFrequency: number;
  firstPageCharacterLimit?: number;
}

interface TransitionSettings {
  defaultTransition: string;
  transitionDuration: number;
}

type TTSProvider = "speechify" | "inworld";
export type ScriptProvider = "gemini" | "groq";

export interface CustomVoice {
  id: string;
  name: string;
  voiceId: string;
  provider: TTSProvider;
}

export interface CustomImageStyle {
  id: string;
  name: string;
  styleText: string;
  createdAt: string;
}

export interface AppSettings {
  customVoices: CustomVoice[];
  customImageStyles: CustomImageStyle[];
  sceneSettings: SceneSettings;
  imageStyleSettings: ImageStyleSettings;
  transitionSettings: TransitionSettings;
  scriptProvider: ScriptProvider;
  defaultImageGenerator: string;
  defaultPollinationsModel: string;
}

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

const DEFAULT_SETTINGS: AppSettings = {
  customVoices: [
    { id: "custom-steep", name: "Steep", voiceId: "fc4da0fd-52fb-4496-bd7f-b4a4e38dd57a", provider: "speechify" },
    { id: "custom-liam", name: "Liam", voiceId: "4a404804-3c9b-47d5-bd46-05d97122c841", provider: "speechify" },
  ],
  customImageStyles: [],
  sceneSettings: {
    firstPageFrequency: 5,
    restFrequency: 60,
    firstPageCharacterLimit: 3000,
  },
  imageStyleSettings: {
    art_style: "Digital concept art mimicking romantic oil painting with soft, painterly brushstrokes.",
    composition: "One-point perspective leading down a central street, framed by tall buildings on both sides.",
    color_style: "Warm golden sunlight and earthy browns contrasted against cool blue clothing and shadows.",
    fine_details: "Weathered stone architecture, medieval peasant attire, and market stalls with canvas awnings.",
  },
  transitionSettings: {
    defaultTransition: "fade",
    transitionDuration: 0.5,
  },
  scriptProvider: "gemini",
  defaultImageGenerator: "wavespeed",
  defaultPollinationsModel: "flux",
};

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const saved = JSON.parse(data);
      // Deep merge with defaults to handle new fields/arrays added in updates
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        sceneSettings: { ...DEFAULT_SETTINGS.sceneSettings, ...(saved.sceneSettings || {}) },
        imageStyleSettings: { ...DEFAULT_SETTINGS.imageStyleSettings, ...(saved.imageStyleSettings || {}) },
        transitionSettings: { ...DEFAULT_SETTINGS.transitionSettings, ...(saved.transitionSettings || {}) },
        customVoices: saved.customVoices || DEFAULT_SETTINGS.customVoices,
        customImageStyles: saved.customImageStyles || DEFAULT_SETTINGS.customImageStyles,
        defaultImageGenerator: saved.defaultImageGenerator || DEFAULT_SETTINGS.defaultImageGenerator,
        defaultPollinationsModel: saved.defaultPollinationsModel || DEFAULT_SETTINGS.defaultPollinationsModel,
      };
    }
  } catch (err) {
    console.error("[SETTINGS] Failed to load settings file, using defaults:", err);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(): void {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2), "utf-8");
  } catch (err) {
    console.error("[SETTINGS] Failed to save settings:", err);
  }
}

let appSettings: AppSettings = loadSettings();

export function getAppSettings(): AppSettings {
  return appSettings;
}

export function updateAppSettings(updates: Partial<AppSettings>): void {
  if (updates.customVoices) appSettings.customVoices = updates.customVoices;
  if (updates.customImageStyles) appSettings.customImageStyles = updates.customImageStyles;
  if (updates.sceneSettings) appSettings.sceneSettings = { ...appSettings.sceneSettings, ...updates.sceneSettings };
  if (updates.imageStyleSettings) appSettings.imageStyleSettings = { ...appSettings.imageStyleSettings, ...updates.imageStyleSettings };
  if (updates.transitionSettings) appSettings.transitionSettings = { ...appSettings.transitionSettings, ...updates.transitionSettings };
  if (updates.scriptProvider) appSettings.scriptProvider = updates.scriptProvider;
  saveSettings();
}

export function getCustomImageStyles(): CustomImageStyle[] {
  return appSettings.customImageStyles;
}

export function addCustomImageStyle(name: string, styleText: string): CustomImageStyle {
  const id = `style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const style: CustomImageStyle = {
    id,
    name,
    styleText,
    createdAt: new Date().toISOString(),
  };
  appSettings.customImageStyles.push(style);
  saveSettings();
  return style;
}

export function updateCustomImageStyle(id: string, name: string, styleText: string): CustomImageStyle | null {
  const index = appSettings.customImageStyles.findIndex(s => s.id === id);
  if (index === -1) return null;
  appSettings.customImageStyles[index] = {
    ...appSettings.customImageStyles[index],
    name,
    styleText,
  };
  saveSettings();
  return appSettings.customImageStyles[index];
}

export function deleteCustomImageStyle(id: string): boolean {
  const index = appSettings.customImageStyles.findIndex(s => s.id === id);
  if (index === -1) return false;
  appSettings.customImageStyles.splice(index, 1);
  saveSettings();
  return true;
}

export function splitScriptIntoScenes(script: string, settings?: SceneSettings): string[] {
  const { firstPageFrequency, restFrequency, firstPageCharacterLimit } = settings || appSettings.sceneSettings;
  const sentences = script.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  const scenes: string[] = [];
  let currentScene = "";
  let currentWordCount = 0;
  let accumulatedCharacters = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    // Calculate target words based on current character position
    // If under 3000 chars (approx 1 page), use firstPageFrequency, else use restFrequency
    // Assume 2.5 words per second
    const targetFrequency = accumulatedCharacters < (firstPageCharacterLimit || 3000) ? firstPageFrequency : restFrequency;
    const targetWords = Math.max(10, Math.round(targetFrequency * 2.5)); // min 10 words to avoid tiny scenes

    // Fallback limit for exceptionally long scenes
    const maxWords = Math.max(targetWords * 1.5, targetWords + 20);

    if (currentWordCount + sentenceWords <= maxWords) {
      currentScene += (currentScene ? " " : "") + sentence.trim();
      currentWordCount += sentenceWords;
      accumulatedCharacters += sentence.trim().length + 1; // +1 for the space
    } else {
      if (currentScene) {
        scenes.push(currentScene);
      }
      currentScene = sentence.trim();
      currentWordCount = sentenceWords;
      accumulatedCharacters += sentence.trim().length;
    }

    if (currentWordCount >= targetWords && currentWordCount <= maxWords) {
      scenes.push(currentScene);
      currentScene = "";
      currentWordCount = 0;
    }
  }

  if (currentScene) {
    scenes.push(currentScene);
  }

  return scenes.filter(s => s.trim().length > 0);
}
