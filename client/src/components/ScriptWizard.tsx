import { useState } from "react";
import { Sparkles, Loader2, ChevronLeft, RefreshCw, Zap, Lightbulb, Target, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ScriptWizardProps {
  onScriptGenerated: (script: string, title: string) => void;
}

const STEP_LABELS = [
  { label: "Topic", icon: Sparkles },
  { label: "Angles", icon: Lightbulb },
  { label: "Ideas", icon: Target },
  { label: "Hook", icon: Zap },
];

export function ScriptWizard({ onScriptGenerated }: ScriptWizardProps) {
  const { toast } = useToast();

  const [wizardStep, setWizardStep] = useState(1);

  // Step 1
  const [topic, setTopic] = useState("");

  // Step 2
  const [angles, setAngles] = useState<string[]>([]);

  // Step 3
  const [selectedAngle, setSelectedAngle] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);

  // Step 4
  const [selectedIdea, setSelectedIdea] = useState("");
  const [hook, setHook] = useState("");

  // Step 1: Topic -> Angles
  const anglesMutation = useMutation({
    mutationFn: async (topicText: string) => {
      const response = await apiRequest("POST", "/api/script-wizard", {
        step: 1,
        topic: topicText,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAngles(data.angles || []);
      setSelectedAngle("");
      setIdeas([]);
      setSelectedIdea("");
      setHook("");
      setWizardStep(2);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate angles", description: error.message, variant: "destructive" });
    },
  });

  // Step 2: Angle -> Ideas
  const ideasMutation = useMutation({
    mutationFn: async (angle: string) => {
      const response = await apiRequest("POST", "/api/script-wizard", {
        step: 2,
        topic,
        selectedAngle: angle,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIdeas(data.ideas || []);
      setSelectedIdea("");
      setHook("");
      setWizardStep(3);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate ideas", description: error.message, variant: "destructive" });
    },
  });

  // Step 3: Idea -> Hook
  const hookMutation = useMutation({
    mutationFn: async (idea: string) => {
      const response = await apiRequest("POST", "/api/script-wizard", {
        step: 3,
        topic,
        selectedIdea: idea,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setHook(data.hook || "");
      setWizardStep(4);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate hook", description: error.message, variant: "destructive" });
    },
  });

  // Step 4: Hook -> Full Script
  const scriptMutation = useMutation({
    mutationFn: async ({ approvedHook, idea }: { approvedHook: string; idea: string }) => {
      const response = await apiRequest("POST", "/api/script-wizard", {
        step: 4,
        topic,
        selectedIdea: idea,
        approvedHook,
      });
      return response.json();
    },
    onSuccess: (data) => {
      onScriptGenerated(data.script, data.title);
      toast({ title: "Script Generated", description: "Your AI-crafted script is ready for review." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate script", description: error.message, variant: "destructive" });
    },
  });

  const isLoading =
    anglesMutation.isPending ||
    ideasMutation.isPending ||
    hookMutation.isPending ||
    scriptMutation.isPending;

  const handleStartOver = () => {
    setWizardStep(1);
    setAngles([]);
    setSelectedAngle("");
    setIdeas([]);
    setSelectedIdea("");
    setHook("");
  };

  return (
    <Card className="lg:row-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          AI Script Wizard
        </CardTitle>
        <CardDescription>
          Guided 4-step process to craft the perfect viral script
        </CardDescription>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 pt-2">
          {STEP_LABELS.map((s, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === wizardStep;
            const isDone = stepNum < wizardStep;
            return (
              <div key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <div className={`w-6 h-px ${isDone ? "bg-primary" : "bg-border"}`} />
                )}
                <button
                  onClick={() => stepNum < wizardStep && setWizardStep(stepNum)}
                  disabled={stepNum >= wizardStep}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <s.icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{stepNum}</span>
                </button>
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ===== STEP 1: Topic Input ===== */}
        {wizardStep === 1 && (
          <>
            <div>
              <Label htmlFor="wizard-topic">What's your video about?</Label>
              <Input
                id="wizard-topic"
                placeholder="e.g., The invention of Coffee, Napoleon, Cyberpunk 2077..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-1.5"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && topic.trim() && !isLoading) {
                    anglesMutation.mutate(topic.trim());
                  }
                }}
                data-testid="wizard-topic-input"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => anglesMutation.mutate(topic.trim())}
              disabled={!topic.trim() || isLoading}
              data-testid="wizard-discover-angles"
            >
              {anglesMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Discover 10 Angles
                </>
              )}
            </Button>
          </>
        )}

        {/* ===== STEP 2: Pick an Angle ===== */}
        {wizardStep === 2 && (
          <>
            <p className="text-sm text-muted-foreground">
              Based on: <span className="text-foreground font-medium">"{topic}"</span>
            </p>

            {anglesMutation.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {angles.map((angle, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedAngle(angle);
                      ideasMutation.mutate(angle);
                    }}
                    disabled={isLoading}
                    className="w-full text-left group p-3.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all flex items-start gap-3"
                    data-testid={`wizard-angle-${i}`}
                  >
                    <span className="font-mono text-primary/50 text-xs mt-0.5">
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-sm font-medium group-hover:text-foreground">
                      {angle}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleStartOver}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => anglesMutation.mutate(topic.trim())}
                disabled={isLoading}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
              </Button>
            </div>
          </>
        )}

        {/* ===== STEP 3: Pick an Idea ===== */}
        {wizardStep === 3 && (
          <>
            <div className="p-3 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground italic">
              Angle: {selectedAngle}
            </div>

            {ideasMutation.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {ideas.map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedIdea(idea);
                      hookMutation.mutate(idea);
                    }}
                    disabled={isLoading}
                    className="w-full text-left group p-3.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all flex items-start gap-3"
                    data-testid={`wizard-idea-${i}`}
                  >
                    <span className="font-mono text-primary/50 text-xs mt-0.5">
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-sm font-medium group-hover:text-foreground">
                      {idea}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setWizardStep(2)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => ideasMutation.mutate(selectedAngle)}
                disabled={isLoading}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
              </Button>
            </div>
          </>
        )}

        {/* ===== STEP 4: Review Hook & Generate Script ===== */}
        {wizardStep === 4 && (
          <>
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Review the Hook</h3>
              <p className="text-xs text-muted-foreground">This will be the opening of your video.</p>
            </div>

            {hookMutation.isPending ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : (
              <div className="relative p-5 bg-gradient-to-br from-muted/50 to-background border border-primary/20 rounded-xl">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-xl" />
                <p className="text-base leading-relaxed pl-3 italic">
                  "{hook}"
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => hookMutation.mutate(selectedIdea)}
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Regenerate Hook
              </Button>
              <Button
                className="flex-[2]"
                onClick={() => {
                  scriptMutation.mutate({
                    approvedHook: hook,
                    idea: selectedIdea,
                  });
                }}
                disabled={!hook || isLoading}
                data-testid="wizard-generate-script"
              >
                {scriptMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Writing Script...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve & Write Script
                  </>
                )}
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={() => setWizardStep(3)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to Ideas
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
