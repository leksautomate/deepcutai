import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, Video, Clock, AlertCircle, CheckCircle, Loader2, ImagePlus, Sparkles, Play, Edit } from "lucide-react";
import { Link } from "wouter";
import type { VideoProject, VideoManifest } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { RenderPanel } from "@/components/RenderPanel";

function getStatusConfig(status: string) {
  switch (status) {
    case "ready":
      return { label: "Ready", variant: "default" as const, icon: CheckCircle };
    case "generating":
      return { label: "Generating", variant: "secondary" as const, icon: Loader2 };
    case "queued":
      return { label: "Queued", variant: "outline" as const, icon: Clock };
    case "error":
      return { label: "Error", variant: "destructive" as const, icon: AlertCircle };
    default:
      return { label: "Draft", variant: "outline" as const, icon: Video };
  }
}

function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="aspect-video rounded-md overflow-hidden bg-muted">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}

function RenderVideoDialog({ project }: { project: VideoProject }) {
  const [open, setOpen] = useState(false);

  const handleRenderComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    setOpen(false);
  };

  if (!project.manifest) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid={`button-render-${project.id}`}>
          <Play className="w-4 h-4 mr-2" />
          Render
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Render Video: {project.title}
          </DialogTitle>
        </DialogHeader>
        <RenderPanel
          manifest={project.manifest as VideoManifest}
          projectId={project.id}
          onRenderComplete={handleRenderComplete}
        />
      </DialogContent>
    </Dialog>
  );
}

function ThumbnailDesigner({ project, onGenerated }: { project: VideoProject; onGenerated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/projects/${project.id}/thumbnail-ai`, {
        style,
        customPrompt: customPrompt || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Thumbnail generated" });
      setOpen(false);
      onGenerated();
    },
    onError: () => {
      toast({ title: "Failed to generate thumbnail", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-thumbnail-${project.id}`}>
          <ImagePlus className="w-4 h-4 mr-2" />
          Thumbnail
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Design Thumbnail
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {project.thumbnailPath && (
            <div className="aspect-video rounded-md overflow-hidden bg-muted">
              <img src={project.thumbnailPath} alt="Current thumbnail" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Style</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger data-testid="select-thumbnail-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cinematic">Cinematic</SelectItem>
                <SelectItem value="anime">Anime</SelectItem>
                <SelectItem value="realistic">Realistic</SelectItem>
                <SelectItem value="illustration">Illustration</SelectItem>
                <SelectItem value="abstract">Abstract</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Custom Prompt (optional)</Label>
            <Textarea
              placeholder="Describe the thumbnail you want..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="resize-none"
              data-testid="input-thumbnail-prompt"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to auto-generate based on video title
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-thumbnail"
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Generate Thumbnail
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ project, onDelete }: { project: VideoProject; onDelete: (id: string) => void }) {
  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;
  const isGenerating = project.status === "generating" || project.status === "queued";

  return (
    <Card className="card-hover transition-all" data-testid={`card-project-${project.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base truncate" data-testid={`text-title-${project.id}`}>
            {project.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {project.createdAt ? formatDistanceToNow(new Date(project.createdAt), { addSuffix: true }) : "Just now"}
          </p>
        </div>
        <Badge variant={statusConfig.variant} className="shrink-0">
          <StatusIcon className={`w-3 h-3 mr-1 ${isGenerating ? "animate-spin" : ""}`} />
          {statusConfig.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating && (
          <div className="space-y-2">
            <Progress value={project.progress || 0} className="h-2" />
            <p className="text-xs text-muted-foreground" data-testid={`text-progress-${project.id}`}>
              {project.progressMessage || "Starting..."}
            </p>
          </div>
        )}

        {project.status === "error" && project.errorMessage && (
          <p className="text-xs text-destructive" data-testid={`text-error-${project.id}`}>
            {project.errorMessage}
          </p>
        )}

        {project.thumbnailPath && (
          <div className="aspect-video rounded-md overflow-hidden bg-muted">
            <img
              src={project.thumbnailPath}
              alt={project.title}
              className="w-full h-full object-cover"
              data-testid={`img-thumbnail-${project.id}`}
            />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {project.status === "ready" && project.outputPath && (
            <>
              <Button
                size="sm"
                asChild
                data-testid={`button-download-${project.id}`}
              >
                <a href={project.outputPath} download>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </a>
              </Button>
              <ThumbnailDesigner project={project} onGenerated={() => { }} />
            </>
          )}
          {project.status === "draft" && project.manifest ? (
            <RenderVideoDialog project={project} />
          ) : null}
          <Link href={`/project/${project.id}`}>
            <Button
              size="sm"
              variant="outline"
              data-testid={`button-edit-${project.id}`}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(project.id)}
            data-testid={`button-delete-${project.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyVideos() {
  const { toast } = useToast();

  const { data: projects = [], isLoading, refetch } = useQuery<VideoProject[]>({
    queryKey: ["/api/projects"],
    refetchInterval: (query) => {
      const data = query.state.data as VideoProject[] | undefined;
      const hasGenerating = data?.some(p => p.status === "generating" || p.status === "queued");
      return hasGenerating ? 3000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete project", variant: "destructive" });
    },
  });

  const sortedProjects = [...projects].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const generatingCount = projects.filter(p => p.status === "generating" || p.status === "queued").length;
  const readyCount = projects.filter(p => p.status === "ready").length;

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold">My Videos</h1>
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">My Videos</h1>
            <p className="text-sm text-muted-foreground">
              {projects.length === 0
                ? "No videos yet"
                : `${readyCount} ready, ${generatingCount} generating`}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            Refresh
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No videos yet</h3>
              <p className="text-sm text-muted-foreground">
                Create your first video from the home page
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
