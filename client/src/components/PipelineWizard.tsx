import { useState, useCallback } from "react";
import { Check, FileText, Image, Play, Video, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScriptInput } from "./ScriptInput";
import { AssetConfig } from "./AssetConfig";
import { VideoPreview } from "./VideoPreview";
import { RenderPanel } from "./RenderPanel";
import type { VideoManifest, GenerationProgress } from "@shared/schema";

const steps = [
  { id: 1, name: "Script", icon: FileText, description: "Create or generate your script" },
  { id: 2, name: "Assets", icon: Image, description: "Configure voice and visuals" },
  { id: 3, name: "Preview", icon: Play, description: "Review your video" },
  { id: 4, name: "Render", icon: Video, description: "Export final video" },
];

interface ProjectState {
  id?: string;
  title: string;
  script: string;
  voiceId: string;
  imageStyle: string;
  customStyleText: string;
  resolution: string;
  manifest?: VideoManifest;
  status: "draft" | "generating" | "ready" | "error";
  progress?: GenerationProgress;
}

export function PipelineWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [project, setProject] = useState<ProjectState>({
    title: "",
    script: "",
    voiceId: "george",
    imageStyle: "cinematic",
    customStyleText: "",
    resolution: "1080p",
    status: "draft",
  });

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return project.script.trim().length > 10;
      case 2:
        return project.voiceId && project.imageStyle;
      case 3:
        return project.manifest !== undefined;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
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
              onVoiceChange={(voiceId) => updateProject({ voiceId })}
              onImageStyleChange={(imageStyle) => updateProject({ imageStyle })}
              onCustomStyleChange={(customStyleText) => updateProject({ customStyleText })}
              onResolutionChange={(resolution) => updateProject({ resolution })}
              onGenerateAssets={handleAssetsGenerated}
              script={project.script}
              projectId={project.id}
            />
          )}

          {currentStep === 3 && (
            <VideoPreview
              manifest={project.manifest}
              onUpdateManifest={(manifest) => updateProject({ manifest })}
            />
          )}

          {currentStep === 4 && (
            <RenderPanel
              manifest={project.manifest}
              projectId={project.id}
              onRenderComplete={(_outputPath) => updateProject({ status: "ready" })}
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
            disabled={!canProceed() || currentStep === 4}
            data-testid="button-next"
          >
            {currentStep === 3 ? "Continue to Render" : "Next"}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
