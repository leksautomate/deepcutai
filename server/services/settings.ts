interface ImageStyleSettings {
  art_style: string;
  composition: string;
  color_style: string;
  fine_details: string;
}

interface SceneSettings {
  targetWords: number;
  maxWords: number;
  minDuration: number;
  maxDuration: number;
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
}

let appSettings: AppSettings = {
  customVoices: [
    { id: "custom-steep", name: "Steep", voiceId: "fc4da0fd-52fb-4496-bd7f-b4a4e38dd57a", provider: "speechify" },
    { id: "custom-liam", name: "Liam", voiceId: "4a404804-3c9b-47d5-bd46-05d97122c841", provider: "speechify" },
  ],
  customImageStyles: [],
  sceneSettings: {
    targetWords: 50,
    maxWords: 60,
    minDuration: 15,
    maxDuration: 25,
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
};

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
  return appSettings.customImageStyles[index];
}

export function deleteCustomImageStyle(id: string): boolean {
  const index = appSettings.customImageStyles.findIndex(s => s.id === id);
  if (index === -1) return false;
  appSettings.customImageStyles.splice(index, 1);
  return true;
}

export function splitScriptIntoScenes(script: string, settings?: SceneSettings): string[] {
  const { targetWords, maxWords } = settings || appSettings.sceneSettings;
  const sentences = script.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  const scenes: string[] = [];
  let currentScene = "";
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    
    if (currentWordCount + sentenceWords <= maxWords) {
      currentScene += (currentScene ? " " : "") + sentence.trim();
      currentWordCount += sentenceWords;
    } else {
      if (currentScene) {
        scenes.push(currentScene);
      }
      currentScene = sentence.trim();
      currentWordCount = sentenceWords;
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
