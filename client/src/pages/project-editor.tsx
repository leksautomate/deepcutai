import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Image, Play, Video, Loader2, RefreshCw, Save } from "lucide-react";
import type { VideoProject, VideoManifest } from "@shared/schema";
import { ScriptInput } from "@/components/ScriptInput";
import { AssetConfig } from "@/components/AssetConfig";
import { VideoPreview } from "@/components/VideoPreview";
import { RenderPanel } from "@/components/RenderPanel";

export default function ProjectEditor() {
  const [, params] = useRoute("/project/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const projectId = params?.id;

  const [activeTab, setActiveTab] = useState("preview");
  const [editedScript, setEditedScript] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [voiceId, setVoiceId] = useState("george");
  const [imageStyle, setImageStyle] = useState("cinematic");
  const [resolution, setResolution] = useState("1080p");
  const [imageGenerator, setImageGenerator] = useState("wavespeed");
  const [customStyleText, setCustomStyleText] = useState("");
  const [manifest, setManifest] = useState<VideoManifest | undefined>();

  const { data: project, isLoading } = useQuery<VideoProject>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project) {
      setEditedScript(project.script || "");
      setEditedTitle(project.title || "");
      setVoiceId(project.voiceId || "george");
      setImageStyle(project.imageStyle || "cinematic");
      setImageGenerator((project as any).imageGenerator || "wavespeed");
      setManifest(project.manifest as VideoManifest | undefined);
    }
  }, [project]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/projects/${projectId}`, {
        title: editedTitle,
        script: editedScript,
        voiceId,
        imageStyle,
        imageGenerator,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Changes saved" });
    },
    onError: () => {
      toast({ title: "Failed to save changes", variant: "destructive" });
    },
  });

  const handleAssetsGenerated = useCallback((_newProjectId: string, newManifest: VideoManifest) => {
    setManifest(newManifest);
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    setActiveTab("preview");
    toast({ title: "Assets regenerated", description: "Your video is ready for preview." });
  }, [projectId, toast]);

  const handleRenderComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Project not found</h3>
            <Button onClick={() => setLocation("/my-videos")} data-testid="button-back-to-videos">
              Back to My Videos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasChanges = editedScript !== project.script || editedTitle !== project.title;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-4 p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/my-videos")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-project-title">
                {project.title || "Untitled Project"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">
                  {project.status}
                </Badge>
                {manifest && (
                  <span className="text-xs text-muted-foreground">
                    {manifest.scenes.length} scenes
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="preview" className="gap-2" data-testid="tab-preview">
                <Play className="w-4 h-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="script" className="gap-2" data-testid="tab-script">
                <FileText className="w-4 h-4" />
                Edit Script
              </TabsTrigger>
              <TabsTrigger value="assets" className="gap-2" data-testid="tab-assets">
                <Image className="w-4 h-4" />
                Regenerate
              </TabsTrigger>
              <TabsTrigger value="render" className="gap-2" data-testid="tab-render">
                <Video className="w-4 h-4" />
                Render
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              <VideoPreview
                manifest={manifest}
                projectId={projectId}
                onUpdateManifest={setManifest}
              />
            </TabsContent>

            <TabsContent value="script">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Edit Script
                    </CardTitle>
                    <CardDescription>
                      Modify your script. After saving, go to "Regenerate" to create new assets.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <ScriptInput
                  script={editedScript}
                  title={editedTitle}
                  onScriptChange={setEditedScript}
                  onTitleChange={setEditedTitle}
                />
              </div>
            </TabsContent>

            <TabsContent value="assets">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5" />
                      Regenerate Assets
                    </CardTitle>
                    <CardDescription>
                      Generate new voice and images for your video. This will replace existing assets.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <AssetConfig
                  voiceId={voiceId}
                  imageStyle={imageStyle}
                  customStyleText={customStyleText}
                  resolution={resolution}
                  imageGenerator={imageGenerator}
                  onVoiceChange={setVoiceId}
                  onImageStyleChange={setImageStyle}
                  onCustomStyleChange={setCustomStyleText}
                  onResolutionChange={setResolution}
                  onImageGeneratorChange={setImageGenerator}
                  onGenerateAssets={handleAssetsGenerated}
                  script={editedScript || project.script}
                  projectId={projectId}
                />
              </div>
            </TabsContent>

            <TabsContent value="render">
              <RenderPanel
                manifest={manifest}
                projectId={projectId}
                onRenderComplete={handleRenderComplete}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
