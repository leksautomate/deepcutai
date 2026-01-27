import { useState } from "react";
import { Video, Download, Loader2, Check, AlertCircle, FileVideo, Clock, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { VideoManifest } from "@shared/schema";
import { exportQualities } from "@shared/schema";

interface RenderPanelProps {
  manifest?: VideoManifest;
  projectId?: string;
  onRenderComplete?: (outputPath: string) => void;
}

const renderSteps = [
  { id: "prepare", name: "Preparing assets", icon: FileVideo },
  { id: "audio", name: "Processing audio", icon: Clock },
  { id: "video", name: "Rendering video", icon: Video },
  { id: "export", name: "Exporting MP4", icon: HardDrive },
];

export function RenderPanel({ manifest, projectId, onRenderComplete }: RenderPanelProps) {
  const [renderProgress, setRenderProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [exportQuality, setExportQuality] = useState<string>("1080p");
  const { toast } = useToast();

  const selectedQuality = exportQualities.find(q => q.id === exportQuality) || exportQualities[1];

  const renderMutation = useMutation({
    mutationFn: async () => {
      if (!manifest) throw new Error("No manifest available");

      setCurrentStep("prepare");
      setRenderProgress(10);

      const response = await apiRequest("POST", "/api/render-video", {
        manifest,
        projectId,
        exportQuality,
      });

      return response.json();
    },
    onSuccess: (data) => {
      setRenderProgress(100);
      setCurrentStep(null);
      setOutputUrl(data.outputUrl);
      onRenderComplete?.(data.outputUrl);
      toast({
        title: "Video Rendered",
        description: "Your video is ready to download!",
      });
    },
    onError: (error: Error) => {
      setCurrentStep(null);
      setRenderProgress(0);
      toast({
        title: "Render Failed",
        description: error.message || "Failed to render video. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!manifest) {
    return (
      <Card className="flex items-center justify-center min-h-[400px]">
        <CardContent className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Video to Render</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Please generate assets in the previous steps first
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalDuration = manifest.scenes.reduce((sum, scene) => sum + scene.durationInSeconds, 0);
  const estimatedRenderTime = Math.ceil(totalDuration * 0.5);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Render Video
          </CardTitle>
          <CardDescription>
            Export your video as a high-quality MP4 file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="export-quality">Export Quality</Label>
              <Select
                value={exportQuality}
                onValueChange={setExportQuality}
                disabled={renderMutation.isPending}
              >
                <SelectTrigger className="mt-1.5" data-testid="select-export-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exportQualities.map((quality) => (
                    <SelectItem key={quality.id} value={quality.id}>
                      {quality.label} ({quality.width}x{quality.height})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Output Resolution</p>
                <p className="font-mono text-sm">{selectedQuality.width}x{selectedQuality.height}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Frame Rate</p>
                <p className="font-mono text-sm">{manifest.fps} FPS</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-mono text-sm">{totalDuration.toFixed(1)} seconds</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scenes</p>
                <p className="font-mono text-sm">{manifest.scenes.length} scenes</p>
              </div>
            </div>
          </div>

          {renderMutation.isPending ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Rendering...</span>
                <span className="text-sm text-muted-foreground">{renderProgress}%</span>
              </div>
              <Progress value={renderProgress} className="h-2" />

              <div className="space-y-2">
                {renderSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = step.id === currentStep;
                  const isComplete = renderSteps.findIndex(s => s.id === currentStep) > index;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-2 rounded-md ${isActive ? "bg-primary/10" : ""
                        }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${isComplete
                            ? "bg-primary text-primary-foreground"
                            : isActive
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                      >
                        {isComplete ? (
                          <Check className="w-4 h-4" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <StepIcon className="w-4 h-4" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${isActive ? "font-medium" : "text-muted-foreground"
                          }`}
                      >
                        {step.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : outputUrl ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium">Render Complete!</p>
                  <p className="text-sm text-muted-foreground">Your video is ready</p>
                </div>
              </div>

              <Button className="w-full" size="lg" asChild data-testid="button-download">
                <a href={outputUrl} download>
                  <Download className="w-5 h-5 mr-2" />
                  Download Video
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Estimated render time: ~{estimatedRenderTime} seconds</span>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => renderMutation.mutate()}
                data-testid="button-render"
              >
                <Video className="w-5 h-5 mr-2" />
                Start Rendering
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Render Summary</CardTitle>
          <CardDescription>Final video composition details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {manifest.scenes.slice(0, 5).map((scene, index) => (
              <div key={scene.id} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-1">{scene.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {scene.durationInSeconds.toFixed(1)}s
                    </Badge>
                    {scene.motion && (
                      <Badge variant="secondary" className="text-[10px]">
                        {scene.motion}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {manifest.scenes.length > 5 && (
              <p className="text-sm text-muted-foreground text-center">
                +{manifest.scenes.length - 5} more scenes
              </p>
            )}

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Duration</span>
                <span className="font-mono">{totalDuration.toFixed(1)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Output Format</span>
                <span className="font-mono">MP4 (H.264)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Audio</span>
                <span className="font-mono">AAC 128kbps</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
