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

export interface CustomVoice {
  id: string;
  name: string;
  voiceId: string;
  provider: TTSProvider;
}

export interface AppSettings {
  customVoices: CustomVoice[];
  sceneSettings: SceneSettings;
  imageStyleSettings: ImageStyleSettings;
  transitionSettings: TransitionSettings;
}

let appSettings: AppSettings = {
  customVoices: [
    { id: "custom-steep", name: "Steep", voiceId: "fc4da0fd-52fb-4496-bd7f-b4a4e38dd57a", provider: "speechify" },
    { id: "custom-liam", name: "Liam", voiceId: "4a404804-3c9b-47d5-bd46-05d97122c841", provider: "speechify" },
  ],
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
};

export function getAppSettings(): AppSettings {
  return appSettings;
}

export function updateAppSettings(updates: Partial<AppSettings>): void {
  if (updates.customVoices) appSettings.customVoices = updates.customVoices;
  if (updates.sceneSettings) appSettings.sceneSettings = { ...appSettings.sceneSettings, ...updates.sceneSettings };
  if (updates.imageStyleSettings) appSettings.imageStyleSettings = { ...appSettings.imageStyleSettings, ...updates.imageStyleSettings };
  if (updates.transitionSettings) appSettings.transitionSettings = { ...appSettings.transitionSettings, ...updates.transitionSettings };
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
