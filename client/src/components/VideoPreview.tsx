import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Clock, Image as ImageIcon, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { VideoManifest } from "@shared/schema";

interface VideoPreviewProps {
  manifest?: VideoManifest;
  projectId?: string;
  onUpdateManifest?: (manifest: VideoManifest) => void;
}

export function VideoPreview({ manifest, projectId, onUpdateManifest }: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const regenerateImageMutation = useMutation({
    mutationFn: async ({ sceneId, sceneIndex }: { sceneId: string; sceneIndex: number }) => {
      if (!manifest || !projectId) throw new Error("Missing manifest or project ID");

      setRegeneratingSceneId(sceneId);
      const scene = manifest.scenes[sceneIndex];

      const response = await apiRequest("POST", "/api/regenerate-scene-image", {
        projectId,
        sceneId,
        sceneIndex,
        text: scene.text,
        width: manifest.width,
        height: manifest.height,
      });

      return response.json();
    },
    onSuccess: (data) => {
      setRegeneratingSceneId(null);
      if (manifest && onUpdateManifest) {
        const updatedScenes = manifest.scenes.map((scene) =>
          scene.id === data.sceneId ? { ...scene, imageFile: data.imageFile } : scene
        );
        onUpdateManifest({ ...manifest, scenes: updatedScenes });
      }
      toast({
        title: "Image Regenerated",
        description: "Scene image has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      setRegeneratingSceneId(null);
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate image. Please try again.",
        variant: "destructive",
      });
    },
  });



  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (!manifest) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const activeScene = manifest.scenes[activeSceneIndex];
    if (activeScene?.audioFile && isPlaying) {
      const audio = new Audio(activeScene.audioFile);
      audioRef.current = audio;
      audio.volume = isMuted ? 0 : volume / 100;

      audio.onended = () => {
        if (activeSceneIndex < manifest.scenes.length - 1) {
          setActiveSceneIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
        }
      };

      audio.ontimeupdate = () => {
        const sceneStart = manifest.scenes.slice(0, activeSceneIndex).reduce((sum, s) => sum + s.durationInSeconds, 0);
        setCurrentTime(sceneStart + audio.currentTime);
      };

      audio.play().catch(err => console.error("Audio playback error:", err));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [activeSceneIndex, isPlaying, manifest]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!manifest || manifest.scenes.length === 0) {
    return (
      <Card className="flex items-center justify-center min-h-[400px]">
        <CardContent className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Preview Available</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Generate assets in the previous step to preview your video
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalDuration = manifest.scenes.reduce((sum, scene) => sum + scene.durationInSeconds, 0);
  const activeScene = manifest.scenes[activeSceneIndex];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevScene = () => {
    setActiveSceneIndex(Math.max(0, activeSceneIndex - 1));
  };

  const handleNextScene = () => {
    setActiveSceneIndex(Math.min(manifest.scenes.length - 1, activeSceneIndex + 1));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <div className="lg:col-span-3 space-y-4">
        <Card className="overflow-hidden">
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {activeScene?.imageFile ? (
              <img
                src={activeScene.imageFile}
                alt={`Scene ${activeSceneIndex + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-white/50 text-center">
                <ImageIcon className="w-16 h-16 mx-auto mb-2" />
                <p>Scene {activeSceneIndex + 1} Preview</p>
              </div>
            )}

            {activeScene && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <p className="text-white text-center text-lg font-medium leading-relaxed max-w-3xl mx-auto">
                  {activeScene.text}
                </p>
              </div>
            )}
          </div>

          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Button size="icon" variant="ghost" onClick={handlePrevScene} data-testid="button-prev-scene">
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button size="icon" onClick={handlePlayPause} data-testid="button-play-pause">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={handleNextScene} data-testid="button-next-scene">
                <SkipForward className="w-5 h-5" />
              </Button>

              <div className="flex-1 mx-4">
                <Slider
                  value={[currentTime]}
                  max={totalDuration}
                  step={0.1}
                  onValueChange={([val]) => setCurrentTime(val)}
                  data-testid="slider-timeline"
                />
              </div>

              <span className="text-sm font-mono text-muted-foreground min-w-[80px]">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsMuted(!isMuted)}
                data-testid="button-mute"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>

              <div className="w-24">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={([val]) => setVolume(val)}
                  data-testid="slider-volume"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scene Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {manifest.scenes.map((scene, index) => (
                <button
                  key={scene.id}
                  onClick={() => setActiveSceneIndex(index)}
                  className={`flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${index === activeSceneIndex
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent hover:border-muted-foreground/20"
                    }`}
                  data-testid={`scene-thumbnail-${index}`}
                >
                  <div className="w-32 aspect-video bg-muted flex items-center justify-center relative">
                    {scene.imageFile ? (
                      <img
                        src={scene.imageFile}
                        alt={`Scene ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Scene {index + 1}</span>
                    )}
                    <div className="absolute bottom-1 right-1">
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {scene.durationInSeconds.toFixed(1)}s
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Scenes</CardTitle>
          <CardDescription>{manifest.scenes.length} scenes</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-2">
              {manifest.scenes.map((scene, index) => (
                <div
                  key={scene.id}
                  className={`w-full text-left p-3 rounded-md transition-all ${index === activeSceneIndex
                    ? "bg-primary/10 border border-primary/20"
                    : "hover-elevate"
                    }`}
                >
                  <button
                    onClick={() => setActiveSceneIndex(index)}
                    className="w-full text-left"
                    data-testid={`scene-item-${index}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{scene.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {scene.durationInSeconds.toFixed(1)}s
                          </span>
                          {scene.motion && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {scene.motion}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        regenerateImageMutation.mutate({ sceneId: scene.id, sceneIndex: index });
                      }}
                      disabled={regeneratingSceneId === scene.id || !projectId}
                      data-testid={`button-regenerate-image-${index}`}
                    >
                      {regeneratingSceneId === scene.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1" />
                      )}
                      <span className="text-xs">Regenerate Image</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
