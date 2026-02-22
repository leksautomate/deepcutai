import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { ReferenceAsset, TTSProvider } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export type ScenePacing = "auto" | "sentence" | "manual";

export interface CharacterVideoState {
    // Cast Management
    characters: ReferenceAsset[];
    addCharacter: () => void;
    updateCharacter: (id: string, updates: Partial<ReferenceAsset>) => void;
    removeCharacter: (id: string) => void;

    // Content Generation
    inputMethod: "topic" | "script";
    setInputMethod: (method: "topic" | "script") => void;
    topicOrScript: string;
    setTopicOrScript: (text: string) => void;
    scenePacing: ScenePacing;
    setScenePacing: (pacing: ScenePacing) => void;

    // Settings
    ttsProvider: TTSProvider;
    setTtsProvider: (provider: TTSProvider) => void;
    voiceId: string;
    setVoiceId: (id: string) => void;
    imageGenerator: string;
    setImageGenerator: (generator: string) => void;
    imageStyle: string;
    setImageStyle: (style: string) => void;
    resolution: string;
    setResolution: (res: string) => void;
    syncToBackend?: () => void;

    // Generation Results
    generatedScript: string | null;
    setGeneratedScript: (script: string | null) => void;
    generatedScenes: any[] | null;
    setGeneratedScenes: (scenes: any[] | null) => void;
}

interface PartialAppSettings {
    customCharacters?: ReferenceAsset[];
    [key: string]: any;
}

const CharacterVideoContext = createContext<CharacterVideoState | null>(null);

export function CharacterVideoProvider({ children }: { children: ReactNode }) {
    const [characters, setCharacters] = useState<ReferenceAsset[]>([
        {
            id: uuidv4(),
            name: "Actor 1",
            category: "SUBJECT",
            promptText: "",
        }
    ]);

    const [inputMethod, setInputMethod] = useState<"topic" | "script">("topic");
    const [topicOrScript, setTopicOrScript] = useState("");
    const [scenePacing, setScenePacing] = useState<ScenePacing>("auto");
    const [ttsProvider, setTtsProvider] = useState<TTSProvider>("inworld");
    const [voiceId, setVoiceId] = useState("Alex");
    const [imageGenerator, setImageGenerator] = useState("wavespeed");
    const [imageStyle, setImageStyle] = useState("doodle");
    const [resolution, setResolution] = useState("vertical");

    const [generatedScript, setGeneratedScript] = useState<string | null>(null);
    const [generatedScenes, setGeneratedScenes] = useState<any[] | null>(null);

    const { data: settings, isLoading } = useQuery<PartialAppSettings>({
        queryKey: ["/api/settings"],
    });

    const saveSettingsMutation = useMutation({
        mutationFn: async (newCharacters: ReferenceAsset[]) => {
            if (!settings) return;
            return await apiRequest("POST", "/api/settings", {
                ...settings,
                customCharacters: newCharacters,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        },
    });

    // Sync internal state with fetched settings once they load
    useEffect(() => {
        if (settings?.customCharacters) {
            if (settings.customCharacters.length > 0) {
                setCharacters(settings.customCharacters);
            } else {
                // If empty, maintain the default Actor 1
                setCharacters([
                    {
                        id: uuidv4(),
                        name: "Actor 1",
                        category: "SUBJECT",
                        promptText: "",
                    }
                ]);
            }
        }
    }, [settings?.customCharacters]);

    const addCharacter = () => {
        const newChar: ReferenceAsset = {
            id: uuidv4(),
            name: `Actor ${characters.length + 1}`,
            category: "SUBJECT",
            promptText: "",
        };
        const updated = [...characters, newChar];
        setCharacters(updated);
        saveSettingsMutation.mutate(updated);
    };

    const updateCharacter = (id: string, updates: Partial<ReferenceAsset>) => {
        const updated = characters.map(char => char.id === id ? { ...char, ...updates } : char);
        setCharacters(updated);
        // Debounce this in a real app, but for now we sync directly.
        // However, text inputs will spam this, so let's only mutate local state immediately,
        // and rely on a 'save' or unmount for backend sync if it gets too noisy. 
        // Actually, to prevent lag, we won't auto-save on every keystroke. 
        // We will let the "Generate" button or a dedicated "Save Actor" button handle persistence, 
        // but for smooth UX we can just debounce the mutation or let local state run free.
    };

    const removeCharacter = (id: string) => {
        const updated = characters.filter(char => char.id !== id);
        setCharacters(updated);
        saveSettingsMutation.mutate(updated);
    };

    // Add a dedicated save method to expose to the UI (e.g., when clicking "Generate")
    const syncToBackend = () => {
        saveSettingsMutation.mutate(characters);
    };

    if (isLoading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <CharacterVideoContext.Provider value={{
            characters,
            addCharacter,
            updateCharacter,
            removeCharacter,
            inputMethod,
            setInputMethod,
            topicOrScript,
            setTopicOrScript,
            scenePacing,
            setScenePacing,
            ttsProvider,
            setTtsProvider,
            voiceId,
            setVoiceId,
            imageGenerator,
            setImageGenerator,
            imageStyle,
            setImageStyle,
            resolution,
            setResolution,
            syncToBackend,
            generatedScript,
            setGeneratedScript,
            generatedScenes,
            setGeneratedScenes,
        }}>
            {children}
        </CharacterVideoContext.Provider>
    );
}

export function useCharacterVideo() {
    const context = useContext(CharacterVideoContext);
    if (!context) {
        throw new Error("useCharacterVideo must be used within a CharacterVideoProvider");
    }
    return context;
}
