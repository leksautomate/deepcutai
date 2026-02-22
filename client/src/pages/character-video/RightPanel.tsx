import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Mic, Loader2 } from "lucide-react";
import { useCharacterVideo } from "./CharacterContext";
import { voiceOptions, inworldVoiceOptions, imageStyles } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export function RightPanel() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const {
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
        characters,
        setGeneratedScript,
        setGeneratedScenes,
    } = useCharacterVideo();

    const generateBackgroundMutation = useMutation({
        mutationFn: async (data: { script: string, scenes: any[] }) => {
            const response = await apiRequest("POST", "/api/generate-background", {
                script: data.script,
                title: `Character Video ${Date.now().toString(36)}`,
                voiceId: voiceId,
                imageStyle: imageStyle,
                resolution: "1080p",
                transition: "fade",
                ttsProvider: ttsProvider,
                imageGenerator: imageGenerator,
                scenes: data.scenes,
                customCharacters: characters.map(c => ({ id: c.id, name: c.name, category: c.category, promptText: c.promptText })),
            });
            return response.json();
        },
        onSuccess: () => {
            toast({
                title: "Video Generation Started",
                description: "Your video is being generated in the background. Track progress in My Videos.",
            });
            setLocation("/my-videos");
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to Start Generation",
                description: error.message || "Please try again.",
                variant: "destructive",
            });
        },
    });

    const generateScriptMutation = useMutation({
        mutationFn: async () => {
            const response = await apiRequest("POST", "/api/generate-script", {
                topic: topicOrScript,
                customScript: inputMethod === "script",
                scenePacing,
                imageStyle,
                customCharacters: characters.map(c => ({ id: c.id, name: c.name, category: c.category, promptText: c.promptText })),
            });
            return response.json();
        },
        onSuccess: (data) => {
            setGeneratedScript(data.script);
            setGeneratedScenes(data.scenes);
            toast({ title: "Script Generated", description: "Now starting video generation..." });
            generateBackgroundMutation.mutate({ script: data.script, scenes: data.scenes });
        },
        onError: (err: Error) => {
            toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
        }
    });

    const { data: globalSettings } = useQuery<{ customImageStyles: any[] }>({
        queryKey: ["/api/settings"],
    });

    const handleCreate = () => {
        if (!topicOrScript.trim()) {
            toast({ title: "Missing Input", description: "Please enter a topic or script.", variant: "destructive" });
            return;
        }
        generateScriptMutation.mutate();
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">The Content</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Write your story and choose how the scenes flow. The AI will weave your cast into the script.
                </p>
            </div>

            <Card className="flex-1 border-border/50 bg-black/20 flex flex-col overflow-hidden">
                <CardContent className="p-4 flex-1 flex flex-col gap-6 overflow-y-auto">

                    {/* Input Method Toggle */}
                    <div className="space-y-3">
                        <Label>Input Method</Label>
                        <Tabs
                            value={inputMethod}
                            onValueChange={(val) => setInputMethod(val as "topic" | "script")}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="topic">Topic (AI Writes)</TabsTrigger>
                                <TabsTrigger value="script">Custom Script</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Textarea
                            placeholder={inputMethod === "topic"
                                ? "e.g., A funny argument between Alex and Bob fighting over the last slice of pizza..."
                                : "Paste your exact script here..."}
                            className="min-h-[200px] resize-y text-base"
                            value={topicOrScript}
                            onChange={(e) => setTopicOrScript(e.target.value)}
                        />
                    </div>

                    {/* Scene Pacing (Only visible/relevant for Custom Script) */}
                    {inputMethod === "script" && (
                        <div className="space-y-3 p-4 bg-muted/40 rounded-md border border-border/50">
                            <div className="space-y-1">
                                <Label>Scene Break Mechanics</Label>
                                <p className="text-xs text-muted-foreground">How should the system split your script into visual scenes?</p>
                            </div>
                            <Select value={scenePacing} onValueChange={(val: any) => setScenePacing(val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto (Narrative Flow, ~5 secs)</SelectItem>
                                    <SelectItem value="sentence">By Sentence (Punctuation break)</SelectItem>
                                    <SelectItem value="manual">Manual Markers (Use [SCENE])</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Voice Selection */}
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2 border-b border-border/50 pb-2">
                            <Mic className="w-4 h-4 text-primary" />
                            Primary Voice
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>TTS Engine</Label>
                                <Select value={ttsProvider} onValueChange={(val: any) => setTtsProvider(val)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="inworld">Inworld AI (Dynamic)</SelectItem>
                                        <SelectItem value="speechify">Speechify (Premium)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Voice</Label>
                                <Select value={voiceId} onValueChange={setVoiceId}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ttsProvider === "inworld"
                                            ? inworldVoiceOptions.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)
                                            : voiceOptions.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.accent})</SelectItem>)
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border/30">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Wand2 className="w-5 h-5 text-primary" />
                            Visual Settings
                        </h3>

                        <div className="grid gap-2">
                            <Label>Image Generator</Label>
                            <Select value={imageGenerator} onValueChange={setImageGenerator}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a generator" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="wavespeed">WaveSpeed (Default - Fast)</SelectItem>
                                    <SelectItem value="whisk">Google Whisk (Imagen 3.5)</SelectItem>
                                    <SelectItem value="runpod">RunPod (Custom Models)</SelectItem>
                                    <SelectItem value="pollinations">Pollinations.ai (Free)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                Choose the AI engine for the visual elements of your character scenes. Whisk allows conversational persistence, WaveSpeed is fastest.
                            </p>
                        </div>

                        <div className="grid gap-2 mt-2">
                            <Label>Image Style</Label>
                            <Select value={imageStyle} onValueChange={setImageStyle}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select art style" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="doodle">Simple 2D Doodle (Default Storyboard)</SelectItem>
                                    {imageStyles.filter(s => s.id !== "custom").map(style => (
                                        <SelectItem key={style.id} value={style.id}>
                                            {style.name}
                                        </SelectItem>
                                    ))}
                                    {globalSettings?.customImageStyles?.map((style) => (
                                        <SelectItem key={`custom-${style.id}`} value={`custom_${style.id}`}>
                                            {style.name} (Custom)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                Choose the artistic vibe of your generated actors. Custom styles from Settings will appear here.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Button
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity font-bold shadow-lg shadow-primary/20"
                onClick={handleCreate}
                disabled={generateScriptMutation.isPending || generateBackgroundMutation.isPending}
            >
                {generateScriptMutation.isPending || generateBackgroundMutation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                    <Wand2 className="mr-2 h-5 w-5" />
                )}
                {generateScriptMutation.isPending ? "Generating Scripts & Scene Prompts..."
                    : generateBackgroundMutation.isPending ? "Starting Video Engine..."
                        : "Generate Character Video"}
            </Button>
        </div>
    );
}
