import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Mic, Image, Settings, Loader2, Sparkles, Volume2, Pause, Zap, SlidersHorizontal, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { voiceOptions, imageStyles, resolutionOptions, type VideoManifest, motionEffects, inworldVoiceOptions, type TTSProvider, pollinationsModels } from "@shared/schema";

interface CustomImageStyle {
  id: string;
  name: string;
  styleText: string;
  createdAt: string;
}

interface CustomVoice {
  id: string;
  name: string;
  voiceId: string;
  provider?: TTSProvider;
}

interface VoicesResponse {
  defaultVoices: Array<{ id: string; name: string; voiceId: string }>;
  customVoices: CustomVoice[];
}

interface AssetConfigProps {
  voiceId: string;
  imageStyle: string;
  resolution: string;
  imageGenerator?: string;
  ttsProvider?: TTSProvider;
  customStyleText?: string;
  onVoiceChange: (voiceId: string) => void;
  onImageStyleChange: (imageStyle: string) => void;
  onResolutionChange: (resolution: string) => void;
  onImageGeneratorChange?: (generator: string) => void;
  onTtsProviderChange?: (provider: TTSProvider) => void;
  onCustomStyleChange?: (styleText: string) => void;
  onGenerateAssets: (projectId: string, manifest: VideoManifest) => void;
  script: string;
  projectId?: string;
}

export function AssetConfig({
  voiceId,
  imageStyle,
  resolution,
  imageGenerator = "wavespeed",
  ttsProvider = "inworld",
  customStyleText = "",
  onVoiceChange,
  onImageStyleChange,
  onResolutionChange,
  onImageGeneratorChange,
  onTtsProviderChange,
  onCustomStyleChange,
  onGenerateAssets,
  script,
  projectId: _projectId,
}: AssetConfigProps) {
  const [, setLocation] = useLocation();
  const [motionEffect, setMotionEffect] = useState<string>("zoom-in");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedGenerator, setSelectedGenerator] = useState(imageGenerator);
  const [selectedTtsProvider, setSelectedTtsProvider] = useState<TTSProvider>(ttsProvider);
  const [pollinationsModel, setPollinationsModel] = useState("flux");
  const [targetWords, setTargetWords] = useState<number | undefined>(undefined);
  const [maxWords, setMaxWords] = useState<number | undefined>(undefined);
  const [minDuration, setMinDuration] = useState<number | undefined>(undefined);
  const [maxDuration, setMaxDuration] = useState<number | undefined>(undefined);
  const [selectedSavedStyle, setSelectedSavedStyle] = useState<string>("");
  const [newStyleName, setNewStyleName] = useState<string>("");

  // Fetch global settings to use as defaults
  const { data: globalSettings } = useQuery<{
    sceneSettings: {
      targetWords: number;
      maxWords: number;
      minDuration: number;
      maxDuration: number;
    };
  }>({
    queryKey: ["/api/settings"],
  });

  // Initialize scene settings from global settings when loaded
  const effectiveTargetWords = targetWords ?? globalSettings?.sceneSettings?.targetWords ?? 30;
  const effectiveMaxWords = maxWords ?? globalSettings?.sceneSettings?.maxWords ?? 60;
  const effectiveMinDuration = minDuration ?? globalSettings?.sceneSettings?.minDuration ?? 3;
  const effectiveMaxDuration = maxDuration ?? globalSettings?.sceneSettings?.maxDuration ?? 15;

  const { data: voicesData, isLoading: isLoadingVoices } = useQuery<VoicesResponse>({
    queryKey: ["/api/voices"],
  });

  // Fetch custom image styles
  const { data: customStylesData } = useQuery<{ styles: CustomImageStyle[] }>({
    queryKey: ["/api/custom-styles"],
  });

  const savedStyles = customStylesData?.styles || [];

  // Save custom style mutation
  const saveStyleMutation = useMutation({
    mutationFn: async ({ name, styleText }: { name: string; styleText: string }) => {
      const response = await apiRequest("POST", "/api/custom-styles", { name, styleText });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-styles"] });
      setNewStyleName("");
      toast({
        title: "Style Saved",
        description: "Your custom style has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save custom style.",
        variant: "destructive",
      });
    },
  });

  // Delete custom style mutation
  const deleteStyleMutation = useMutation({
    mutationFn: async (styleId: string) => {
      const response = await apiRequest("DELETE", `/api/custom-styles/${styleId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-styles"] });
      setSelectedSavedStyle("");
      toast({
        title: "Style Deleted",
        description: "Custom style has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete custom style.",
        variant: "destructive",
      });
    },
  });

  // Handle selecting a saved style
  const handleSavedStyleSelect = (styleId: string) => {
    setSelectedSavedStyle(styleId);
    const style = savedStyles.find(s => s.id === styleId);
    if (style) {
      onCustomStyleChange?.(style.styleText);
    }
  };

  // Handle saving current custom style
  const handleSaveStyle = () => {
    if (!newStyleName.trim() || !customStyleText.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a style name and style description.",
        variant: "destructive",
      });
      return;
    }
    saveStyleMutation.mutate({ name: newStyleName, styleText: customStyleText });
  };

  const speechifyVoices = voiceOptions.map(v => ({ ...v, isCustom: false, provider: "speechify" as TTSProvider }));
  const inworldVoices = inworldVoiceOptions.map(v => ({ ...v, accent: "Standard", isCustom: false, provider: "inworld" as TTSProvider }));
  const customVoices = (voicesData?.customVoices || []).map(v => ({
    id: v.id,
    name: v.name,
    gender: "custom" as const,
    accent: "Custom",
    isCustom: true,
    provider: (v.provider || "speechify") as TTSProvider,
  }));

  const allVoices = selectedTtsProvider === "inworld"
    ? [...inworldVoices, ...customVoices.filter(v => v.provider === "inworld")]
    : [...speechifyVoices, ...customVoices.filter(v => v.provider === "speechify")];

  const generateMutation = useMutation({
    mutationFn: async () => {
      setGenerationProgress(0);
      setCurrentTask("Preparing script...");

      const response = await apiRequest("POST", "/api/generate-assets", {
        script,
        voiceId,
        imageStyle,
        customStyleText: imageStyle === "custom" ? customStyleText : undefined,
        resolution,
        motionEffect,
        imageGenerator: selectedGenerator,
        pollinationsModel: selectedGenerator === "pollinations" ? pollinationsModel : undefined,
        ttsProvider: selectedTtsProvider,
        sceneSettings: {
          targetWords: effectiveTargetWords,
          maxWords: effectiveMaxWords,
          minDuration: effectiveMinDuration,
          maxDuration: effectiveMaxDuration,
        },
      });

      return response.json();
    },
    onSuccess: (data) => {
      setGenerationProgress(100);
      setCurrentTask("Complete!");
      onGenerateAssets(data.projectId, data.manifest);
      toast({
        title: "Assets Generated",
        description: "All audio and images have been created successfully.",
      });
    },
    onError: (error: Error) => {
      setCurrentTask("");
      setGenerationProgress(0);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate assets. Please try again.",
        variant: "destructive",
      });
    },
  });

  const backgroundMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-background", {
        script,
        title: `Video ${Date.now().toString(36)}`,
        voiceId,
        imageStyle,
        customStyleText: imageStyle === "custom" ? customStyleText : undefined,
        resolution,
        transition: "fade",
        imageGenerator: selectedGenerator,
        pollinationsModel: selectedGenerator === "pollinations" ? pollinationsModel : undefined,
        ttsProvider: selectedTtsProvider,
      });
      return response.json();
    },
    onSuccess: (_data) => {
      toast({
        title: "Video Generation Started",
        description: "Your video is being generated in the background. You can track progress in My Videos.",
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

  const previewMutation = useMutation({
    mutationFn: async (voiceIdToPreview: string) => {
      const response = await apiRequest("POST", "/api/tts-preview", {
        voiceId: voiceIdToPreview,
        ttsProvider: selectedTtsProvider,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPreviewPlaying(false);
      audio.onerror = () => {
        setIsPreviewPlaying(false);
        toast({
          title: "Playback Error",
          description: "Failed to play voice preview.",
          variant: "destructive",
        });
      };
      audio.play();
      setIsPreviewPlaying(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate voice preview.",
        variant: "destructive",
      });
    },
  });

  const handlePreviewVoice = () => {
    if (isPreviewPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewMutation.mutate(voiceId);
    }
  };

  const selectedVoice = allVoices.find((v) => v.id === voiceId);

  const selectedResolution = resolutionOptions.find((r) => r.id === resolution);

  const sceneCount = script.split(/\n\n+/).filter((s) => s.trim()).length;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Voice Settings
          </CardTitle>
          <CardDescription>Choose a voice for narration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="tts-provider">TTS Provider</Label>
            <Select
              value={selectedTtsProvider}
              onValueChange={(value: TTSProvider) => {
                setSelectedTtsProvider(value);
                onTtsProviderChange?.(value);
                if (allVoices.length > 0) {
                  onVoiceChange(value === "inworld" ? inworldVoiceOptions[0].id : voiceOptions[0].id);
                }
              }}
              disabled={generateMutation.isPending || backgroundMutation.isPending}
            >
              <SelectTrigger className="mt-1.5" data-testid="select-tts-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="speechify">Speechify</SelectItem>
                <SelectItem value="inworld">Inworld TTS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoadingVoices ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <RadioGroup value={voiceId} onValueChange={onVoiceChange} className="space-y-3 max-h-48 overflow-y-auto">
              {allVoices.map((voice) => (
                <div key={voice.id} className="flex items-center space-x-3">
                  <RadioGroupItem value={voice.id} id={voice.id} data-testid={`radio-voice-${voice.id}`} />
                  <Label htmlFor={voice.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{voice.name}</span>
                      <div className="flex gap-1">
                        {voice.isCustom ? (
                          <Badge variant="default" className="text-xs bg-primary">
                            Custom
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="secondary" className="text-xs">
                              {voice.gender}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {voice.accent}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {selectedVoice && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handlePreviewVoice}
              disabled={previewMutation.isPending}
              data-testid="button-preview-voice"
            >
              {previewMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isPreviewPlaying ? (
                <Pause className="w-4 h-4 mr-2" />
              ) : (
                <Volume2 className="w-4 h-4 mr-2" />
              )}
              {previewMutation.isPending
                ? "Generating..."
                : isPreviewPlaying
                  ? "Stop Preview"
                  : `Preview ${selectedVoice.name}'s Voice`}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            Visual Style
          </CardTitle>
          <CardDescription>Select image generation style</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={imageStyle} onValueChange={onImageStyleChange} className="space-y-3">
            {imageStyles.map((style) => (
              <div key={style.id} className="flex items-center space-x-3">
                <RadioGroupItem value={style.id} id={style.id} data-testid={`radio-style-${style.id}`} />
                <Label htmlFor={style.id} className="flex-1 cursor-pointer">
                  <div>
                    <span className="font-medium">{style.name}</span>
                    <p className="text-xs text-muted-foreground">{style.description}</p>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>

          {imageStyle === "custom" && (
            <div className="mt-4 space-y-4">
              {savedStyles.length > 0 && (
                <div className="space-y-2">
                  <Label>Saved Styles</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedSavedStyle}
                      onValueChange={handleSavedStyleSelect}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a saved style..." />
                      </SelectTrigger>
                      <SelectContent>
                        {savedStyles.map((style) => (
                          <SelectItem key={style.id} value={style.id}>
                            {style.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSavedStyle && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteStyleMutation.mutate(selectedSavedStyle)}
                        disabled={deleteStyleMutation.isPending}
                      >
                        {deleteStyleMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="custom-style">Your Custom Style</Label>
                <Textarea
                  id="custom-style"
                  placeholder="Paste your custom style description here... e.g., 'Digital concept art with soft brushstrokes, warm golden lighting, period-appropriate architecture, aged textures...'"
                  value={customStyleText}
                  onChange={(e) => {
                    setSelectedSavedStyle("");
                    onCustomStyleChange?.(e.target.value);
                  }}
                  className="min-h-[100px] text-sm"
                  data-testid="textarea-custom-style"
                />
                <p className="text-xs text-muted-foreground">
                  Describe the visual style you want for your images. Be specific about art style, colors, lighting, and details.
                </p>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="style-name">Save as New Style</Label>
                  <Input
                    id="style-name"
                    placeholder="Enter style name..."
                    value={newStyleName}
                    onChange={(e) => setNewStyleName(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleSaveStyle}
                  disabled={saveStyleMutation.isPending || !customStyleText.trim() || !newStyleName.trim()}
                >
                  {saveStyleMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Video Settings
          </CardTitle>
          <CardDescription>Configure output options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="image-generator">Image Generator</Label>
            <Select
              value={selectedGenerator}
              onValueChange={(value) => {
                setSelectedGenerator(value);
                onImageGeneratorChange?.(value);
              }}
              disabled={generateMutation.isPending || backgroundMutation.isPending}
            >
              <SelectTrigger className="mt-1.5" data-testid="select-image-generator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seedream">Seedream (Freepik)</SelectItem>
                <SelectItem value="wavespeed">WaveSpeed</SelectItem>
                <SelectItem value="runpod">RunPod</SelectItem>
                <SelectItem value="pollinations">Grand Image (Pollinations)</SelectItem>
                <SelectItem value="whisk">Whisk (Google IMAGEN 3.5)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedGenerator === "pollinations" && (
            <div>
              <Label htmlFor="pollinations-model">Pollinations Model</Label>
              <Select
                value={pollinationsModel}
                onValueChange={setPollinationsModel}
                disabled={generateMutation.isPending || backgroundMutation.isPending}
              >
                <SelectTrigger className="mt-1.5" data-testid="select-pollinations-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pollinationsModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model.charAt(0).toUpperCase() + model.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Choose AI model for image generation
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="resolution">Resolution</Label>
            <Select
              value={resolution}
              onValueChange={onResolutionChange}
              disabled={generateMutation.isPending || backgroundMutation.isPending}
            >
              <SelectTrigger className="mt-1.5" data-testid="select-resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolutionOptions.map((res) => (
                  <SelectItem key={res.id} value={res.id}>
                    {res.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="motion">Ken Burns Effect</Label>
            <Select
              value={motionEffect}
              onValueChange={setMotionEffect}
              disabled={generateMutation.isPending || backgroundMutation.isPending}
            >
              <SelectTrigger className="mt-1.5" data-testid="select-motion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {motionEffects.map((effect) => (
                  <SelectItem key={effect} value={effect}>
                    {effect.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Scenes to generate:</span>
              <span className="font-medium">{sceneCount}</span>
            </div>
            {selectedResolution && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Output size:</span>
                <span className="font-mono text-xs">
                  {selectedResolution.width}x{selectedResolution.height}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" />
            Scene Settings
          </CardTitle>
          <CardDescription>Control how the script is split into scenes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="targetWords">Target Words per Scene</Label>
              <Input
                id="targetWords"
                type="number"
                min={1}
                max={200}
                value={effectiveTargetWords.toString()}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) setTargetWords(val);
                  else if (e.target.value === "") setTargetWords(0);
                }}
                onBlur={() => setTargetWords(Math.max(5, Math.min(200, effectiveTargetWords || 30)))}
                className="mt-1.5"
                disabled={generateMutation.isPending || backgroundMutation.isPending}
                data-testid="input-target-words"
              />
              <p className="text-xs text-muted-foreground mt-1">Aim for this many words per scene</p>
            </div>
            <div>
              <Label htmlFor="maxWords">Maximum Words per Scene</Label>
              <Input
                id="maxWords"
                type="number"
                min={1}
                max={300}
                value={effectiveMaxWords.toString()}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) setMaxWords(val);
                  else if (e.target.value === "") setMaxWords(0);
                }}
                onBlur={() => setMaxWords(Math.max(effectiveTargetWords, Math.min(300, effectiveMaxWords || 60)))}
                className="mt-1.5"
                disabled={generateMutation.isPending || backgroundMutation.isPending}
                data-testid="input-max-words"
              />
              <p className="text-xs text-muted-foreground mt-1">Hard limit per scene</p>
            </div>
            <div>
              <Label htmlFor="minDuration">Min Duration (sec)</Label>
              <Input
                id="minDuration"
                type="number"
                min={1}
                max={60}
                value={effectiveMinDuration.toString()}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) setMinDuration(val);
                  else if (e.target.value === "") setMinDuration(0);
                }}
                onBlur={() => setMinDuration(Math.max(1, Math.min(60, effectiveMinDuration || 3)))}
                className="mt-1.5"
                disabled={generateMutation.isPending || backgroundMutation.isPending}
                data-testid="input-min-duration"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum scene duration</p>
            </div>
            <div>
              <Label htmlFor="maxDuration">Max Duration (sec)</Label>
              <Input
                id="maxDuration"
                type="number"
                min={1}
                max={120}
                value={effectiveMaxDuration.toString()}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) setMaxDuration(val);
                  else if (e.target.value === "") setMaxDuration(0);
                }}
                onBlur={() => setMaxDuration(Math.max(effectiveMinDuration, Math.min(120, effectiveMaxDuration || 15)))}
                className="mt-1.5"
                disabled={generateMutation.isPending || backgroundMutation.isPending}
                data-testid="input-max-duration"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum scene duration</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Generate Assets
          </CardTitle>
          <CardDescription>
            Create audio narration and images for all {sceneCount} scenes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generateMutation.isPending ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm font-medium">{currentTask}</span>
              </div>
              <Progress value={generationProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                This may take a few minutes depending on the number of scenes
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1"
                size="lg"
                onClick={() => generateMutation.mutate()}
                disabled={sceneCount === 0}
                data-testid="button-generate-assets"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Now
              </Button>
              <Button
                className="flex-1"
                size="lg"
                variant="secondary"
                onClick={() => backgroundMutation.mutate()}
                disabled={sceneCount === 0 || backgroundMutation.isPending}
                data-testid="button-generate-background"
              >
                {backgroundMutation.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-5 h-5 mr-2" />
                )}
                Generate in Background
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
