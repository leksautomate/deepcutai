import { useState, useCallback, useEffect } from "react";
import { Check, FileText, Settings, Zap, ChevronRight, ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScriptInput } from "./ScriptInput";
import { AssetConfig } from "./AssetConfig";
import { VideoPreview } from "./VideoPreview";
import { RenderPanel } from "./RenderPanel";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VideoProject, VideoManifest, GenerationProgress } from "@shared/schema";

const steps = [
  { id: 1, name: "Script", icon: FileText, description: "Create or generate your script" },
  { id: 2, name: "Settings", icon: Settings, description: "Configure voice and visuals" },
  { id: 3, name: "Review", icon: Check, description: "Review and edit generated assets" },
  { id: 4, name: "Generate", icon: Zap, description: "Generate & export video" },
];

interface ProjectState {
  id?: string;
  title: string;
  script: string;
  voiceId: string;
  imageStyle: string;
  customStyleText: string;
  resolution: string;
  imageGenerator?: string;
  pollinationsModel?: string;
  videoGenerator?: string;
  manifest?: VideoManifest;
  sceneSettings?: {
    firstPageFrequency: number;
    restFrequency: number;
    firstPageCharacterLimit: number;
  };
  ttsProvider?: string;
  status: "draft" | "generating" | "queued" | "ready" | "error";
  progress?: number | null;
  progressMessage?: string | null;
}

export function PipelineWizard() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [project, setProject] = useState<ProjectState>({
    title: "",
    script: "",
    voiceId: "george",
    imageStyle: "cinematic",
    customStyleText: "",
    resolution: "1080p",
    imageGenerator: "wavespeed",
    videoGenerator: "",
    status: "draft",
  });

  const { data: polledProject } = useQuery<VideoProject>({
    queryKey: ["/api/projects", project.id],
    enabled: !!project.id && (project.status === "generating" || project.status === "error"),
    refetchInterval: (query) => {
      const data = query.state.data as VideoProject | undefined;
      return (data?.status === "generating" || data?.status === "queued" || !data) ? 3000 : false;
    },
  });

  useEffect(() => {
    if (polledProject && polledProject.status !== project.status) {
      setProject(prev => ({
        ...prev,
        title: polledProject.title || prev.title,
        status: polledProject.status as any,
        manifest: polledProject.manifest as any,
        progress: polledProject.progress as any,
      }));
    } else if (polledProject && polledProject.progress !== project.progress) {
      setProject(prev => ({
        ...prev,
        progress: polledProject.progress as any,
      }));
    }
  }, [polledProject, project.status, project.progress]);

  const generateAssetsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-background", {
        script: project.script,
        title: project.title || undefined,
        voiceId: project.voiceId,
        imageStyle: project.imageStyle,
        customStyleText: project.imageStyle === "custom" ? project.customStyleText : undefined,
        resolution: project.resolution,
        imageGenerator: project.imageGenerator || undefined,
        pollinationsModel: project.pollinationsModel || undefined,
        ttsProvider: project.ttsProvider || "inworld",
        sceneSettings: project.sceneSettings,
        generateAssetsOnly: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setProject((prev) => ({
        ...prev,
        title: data.title || prev.title,
        id: data.projectId,
        status: "generating",
      }));
      setCurrentStep(3);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Start Generation",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return project.script.trim().length > 10;
      case 2:
        return project.voiceId && project.imageStyle;
      case 3:
        return project.status === "ready" && project.manifest !== undefined;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep === 2 && (project.status === "draft" || project.status === "error")) {
      generateAssetsMutation.mutate();
    } else if (currentStep < 4 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateProject = useCallback((updates: Partial<ProjectState>) => {
    setProject((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleAssetsGenerated = useCallback((projectId: string, manifest: VideoManifest) => {
    setProject((prev) => ({
      ...prev,
      id: projectId,
      manifest,
      status: "ready",
    }));
    setCurrentStep(3);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <nav aria-label="Progress">
            <ol className="flex items-center justify-between gap-2">
              {steps.map((step, index) => (
                <li key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                    disabled={step.id > currentStep}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all w-full ${step.id === currentStep
                      ? "bg-primary/10 border border-primary/20"
                      : step.id < currentStep
                        ? "hover-elevate cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                      }`}
                    data-testid={`step-${step.id}`}
                  >
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full ${step.id < currentStep
                        ? "bg-primary text-primary-foreground"
                        : step.id === currentStep
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {step.id < currentStep ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-left hidden md:block">
                      <p
                        className={`text-sm font-medium ${step.id === currentStep ? "text-foreground" : "text-muted-foreground"
                          }`}
                      >
                        {step.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </button>
                  {index < steps.length - 1 && (
                    <ChevronRight className="w-5 h-5 text-muted-foreground mx-2 hidden lg:block" />
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          {currentStep === 1 && (
            <ScriptInput
              script={project.script}
              title={project.title}
              onScriptChange={(script) => updateProject({ script })}
              onTitleChange={(title) => updateProject({ title })}
            />
          )}

          {currentStep === 2 && (
            <AssetConfig
              voiceId={project.voiceId}
              imageStyle={project.imageStyle}
              customStyleText={project.customStyleText}
              resolution={project.resolution}
              imageGenerator={project.imageGenerator}
              pollinationsModel={project.pollinationsModel}
              onVoiceChange={(voiceId) => updateProject({ voiceId })}
              onImageStyleChange={(imageStyle) => updateProject({ imageStyle })}
              onCustomStyleChange={(customStyleText) => updateProject({ customStyleText })}
              onResolutionChange={(resolution) => updateProject({ resolution })}
              onImageGeneratorChange={(imageGenerator) => updateProject({ imageGenerator })}
              onPollinationsModelChange={(pollinationsModel) => updateProject({ pollinationsModel })}
              onSceneSettingsChange={(sceneSettings) => updateProject({ sceneSettings })}
              onGenerateAssets={handleAssetsGenerated}
              script={project.script}
              projectId={project.id}
              sceneSettings={project.sceneSettings}
            />
          )}

          {currentStep === 3 && (project.status === "generating" || project.status === "queued" || project.status === "draft") && (
            <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground bg-card rounded-xl border border-border">
              <Loader2 className="w-12 h-12 mb-6 animate-spin text-primary" />
              <h3 className="text-xl font-medium text-foreground">Generating Assets...</h3>
              <p className="max-w-md mt-2">
                We are creating your voiceovers and images. Depending on the script length, this may take a few minutes.
              </p>
              {project.progress !== undefined && (
                <p className="mt-4 text-sm font-medium text-primary">Progress: {project.progress}%</p>
              )}
            </div>
          )}

          {currentStep === 3 && project.status === "error" && (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-card rounded-xl border border-destructive/50">
              <AlertCircle className="w-12 h-12 mb-6 text-destructive" />
              <h3 className="text-xl font-medium text-destructive">Generation Failed</h3>
              <p className="max-w-md mt-2 text-muted-foreground">
                We could not generate the assets for your script. This is likely an API token error.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => setCurrentStep(2)}>
                Go Back to Settings
              </Button>
            </div>
          )}

          {currentStep === 3 && project.status === "ready" && project.manifest && (
            <div className="space-y-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold">Review Generated Assets</h2>
                <p className="text-muted-foreground">Preview your video scenes, adjust text for regeneration if needed, and proceed to render when satisfied.</p>
              </div>
              <VideoPreview
                manifest={project.manifest}
                projectId={project.id}
                onUpdateManifest={(manifest) => updateProject({ manifest })}
              />
            </div>
          )}

          {currentStep === 4 && (
            <RenderPanel
              manifest={project.manifest}
              projectId={project.id}
              projectTitle={project.title}
              onRenderComplete={(_outputPath) => updateProject({ status: "ready" })}
              onGoToAssets={() => setCurrentStep(2)}
            />
          )}
        </div>
      </div>

      <div className="border-t bg-card px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {steps.length}
            </span>
          </div>

          <Button
            onClick={handleNext}
            disabled={(!canProceed() && currentStep !== 2) || currentStep === 4 || generateAssetsMutation.isPending}
            data-testid="button-next"
          >
            {generateAssetsMutation.isPending ? "Generating..." : (currentStep === 2 && (project.status === "draft" || project.status === "error") ? "Generate Assets" : "Next")}
            {!generateAssetsMutation.isPending && <ChevronRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
