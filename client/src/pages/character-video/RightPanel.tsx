import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Mic, Loader2, Plus, Palette } from "lucide-react";
import { useCharacterVideo } from "./CharacterContext";
import { voiceOptions, inworldVoiceOptions, imageStyles } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";

export function RightPanel() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
    const [newStyleName, setNewStyleName] = useState("");
    const [newStyleDescription, setNewStyleDescription] = useState("");
    const [isImageLoading, setIsImageLoading] = useState(false);
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
        resolution,
        setResolution,
        pollinationsModel,
        setPollinationsModel,
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
                resolution: resolution,
                transition: "fade",
                ttsProvider: ttsProvider,
                imageGenerator: imageGenerator,
                pollinationsModel: pollinationsModel,
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

    const { data: globalSettings, refetch: refetchSettings } = useQuery<{ customImageStyles: any[], customVoices: any[] }>({
        queryKey: ["/api/settings"],
    });

    const activeStyleText = useMemo(() => {
        if (imageStyle === "doodle") {
            return "Pure 2D line-art storyboard style. Clean white background, thin black outlines, flat pastel fills, minimal facial features, and zero shading/3D realism.";
        }
        if (imageStyle.startsWith("custom_")) {
            return globalSettings?.customImageStyles?.find(s => s.id === imageStyle.replace("custom_", ""))?.styleText || "Loading custom style...";
        }
        return imageStyles.find(s => s.id === imageStyle)?.description || "";
    }, [imageStyle, globalSettings, imageStyles]);

    const previewImageUrl = useMemo(() => {
        if (!activeStyleText || activeStyleText === "Loading custom style...") return null;
        const basePrompt = `A stunning character portrait. ${activeStyleText}`;
        return `https://gen.pollinations.ai/image/${encodeURIComponent(basePrompt)}?model=zimage&width=800&height=450&key=sk_vLEHEXDOgyIoI49UR02sFkWo7FPlhqaU`;
    }, [activeStyleText]);

    // Force loader when URL updates
    useEffect(() => {
        if (previewImageUrl) {
            setIsImageLoading(true);
        } else {
            setIsImageLoading(false);
        }
    }, [previewImageUrl]);

    const createCustomStyleMutation = useMutation({
        mutationFn: async (data: { name: string, styleText: string }) => {
            const res = await apiRequest("POST", "/api/custom-styles", data);
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Custom Style Created",
                description: `Successfully added ${data.name} to your styles.`,
            });
            setIsStyleDialogOpen(false);
            setNewStyleName("");
            setNewStyleDescription("");
            refetchSettings().then(() => {
                setImageStyle(`custom_${data.id}`);
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to create style",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    const handleCreateCustomStyle = () => {
        if (!newStyleName.trim() || !newStyleDescription.trim()) {
            toast({ title: "Validation Error", description: "Name and description are required.", variant: "destructive" });
            return;
        }
        createCustomStyleMutation.mutate({ name: newStyleName, styleText: newStyleDescription });
    };

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
                                            : <>
                                                {globalSettings?.customVoices && globalSettings.customVoices.length > 0 && (
                                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                        Custom Voices
                                                    </div>
                                                )}
                                                {globalSettings?.customVoices?.map((v) => (
                                                    <SelectItem key={v.id} value={v.voiceId || v.id}>{v.name} (Custom)</SelectItem>
                                                ))}
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                                                    Standard Voices
                                                </div>
                                                {voiceOptions.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.accent})</SelectItem>)}
                                            </>
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

                        {imageGenerator === "pollinations" && (
                            <div className="grid gap-2 mt-2">
                                <Label>Pollinations Model</Label>
                                <Select value={pollinationsModel} onValueChange={setPollinationsModel}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Pollinations model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="flux">Flux (Default - High Quality)</SelectItem>
                                        <SelectItem value="zimage">ZImage (Fastest)</SelectItem>
                                        <SelectItem value="turbo">Turbo</SelectItem>
                                        <SelectItem value="gptimage">GPT Image</SelectItem>
                                        <SelectItem value="gptimage-large">GPT Image (Large)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Select the specific generation model within the Pollinations network.
                                </p>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label>Resolution & Format</Label>
                            <Select value={resolution} onValueChange={setResolution}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select resolution" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1080p">Landscape (16:9)</SelectItem>
                                    <SelectItem value="vertical">Portrait / Shorts (9:16)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                Portrait is ideal for Shorts/TikTok. Landscape for traditional videos.
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
                                        <SelectItem key={`custom_${style.id}`} value={`custom_${style.id}`}>
                                            {style.name} (Custom)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Visual Preview Card */}
                            <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border/50 text-sm overflow-hidden relative">
                                <div className="flex items-center gap-2 mb-2 z-10 relative">
                                    <Palette className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-foreground">Style Preview</span>
                                </div>
                                <div className="w-full aspect-video bg-black/10 rounded-md mb-2 relative overflow-hidden flex items-center justify-center">
                                    {isImageLoading && previewImageUrl && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-background/50 backdrop-blur-sm z-10 transition-opacity">
                                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                            <span className="text-xs">Generating preview...</span>
                                        </div>
                                    )}
                                    {previewImageUrl ? (
                                        <img
                                            src={previewImageUrl}
                                            alt="Style Preview"
                                            className={`w-full h-full object-cover transition-opacity duration-300 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
                                            onLoad={() => setIsImageLoading(false)}
                                            onError={() => setIsImageLoading(false)}
                                        />
                                    ) : (
                                        <span className="text-xs text-muted-foreground">No preview available</span>
                                    )}
                                </div>
                                <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                                    {activeStyleText}
                                </p>
                            </div>

                            <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full mt-1 border-dashed">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Custom Style
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create Custom Art Style</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Style Name</Label>
                                            <Input
                                                placeholder="e.g., Cyberpunk Neon, Watercolor Portrait..."
                                                value={newStyleName}
                                                onChange={e => setNewStyleName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Art Style Instructions (Prompt Logic)</Label>
                                            <Textarea
                                                placeholder="Describe the exact aesthetic rules... e.g., 'Retro 80s anime style, heavy film grain, neon pinks and blues, cel-shaded...'"
                                                className="min-h-[100px]"
                                                value={newStyleDescription}
                                                onChange={e => setNewStyleDescription(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                These exact instructions will be injected into the AI generation prompt to guide character appearance.
                                            </p>
                                        </div>
                                        <Button
                                            className="w-full"
                                            onClick={handleCreateCustomStyle}
                                            disabled={createCustomStyleMutation.isPending}
                                        >
                                            {createCustomStyleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Save & Use Style
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
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
