import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Video, 
  Play, 
  Download, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Plus,
  RefreshCw,
  Grid,
  List
} from "lucide-react";
import { useState } from "react";
import type { VideoProject } from "@shared/schema";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "Unknown";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ready
        </Badge>
      );
    case "generating":
      return (
        <Badge variant="secondary">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Generating
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Clock className="w-3 h-3 mr-1" />
          Draft
        </Badge>
      );
  }
}

function ProjectCard({ 
  project, 
  onDelete, 
  isDeleting 
}: { 
  project: VideoProject; 
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  return (
    <Card className="overflow-visible" data-testid={`card-project-${project.id}`}>
      <div className="relative aspect-video bg-muted rounded-t-md overflow-hidden">
        {project.thumbnailPath ? (
          <img
            src={project.thumbnailPath}
            alt={project.title}
            className="w-full h-full object-cover"
            data-testid={`img-thumbnail-${project.id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        {project.status === "generating" && project.progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
            <Progress value={project.progress} className="h-2" />
            <p className="text-xs text-white mt-1">{project.progressMessage || "Processing..."}</p>
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-1" data-testid={`text-title-${project.id}`}>
            {project.title}
          </CardTitle>
          <StatusBadge status={project.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(project.totalDuration)}
          </span>
          <span>{formatDate(project.createdAt)}</span>
        </div>
        
        {project.errorMessage && (
          <p className="text-sm text-destructive mb-4 line-clamp-2" data-testid={`text-error-${project.id}`}>
            {project.errorMessage}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {project.status === "ready" && project.outputPath && (
            <>
              <Link href={`/?preview=${project.id}`}>
                <Button size="sm" variant="default" data-testid={`button-play-${project.id}`}>
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Play
                </Button>
              </Link>
              <a href={project.outputPath} download>
                <Button size="sm" variant="outline" data-testid={`button-download-${project.id}`}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download
                </Button>
              </a>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(project.id)}
            disabled={isDeleting}
            data-testid={`button-delete-${project.id}`}
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectListItem({ 
  project, 
  onDelete, 
  isDeleting 
}: { 
  project: VideoProject; 
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  return (
    <Card className="overflow-visible" data-testid={`row-project-${project.id}`}>
      <div className="flex items-center gap-4 p-4">
        <div className="w-24 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
          {project.thumbnailPath ? (
            <img
              src={project.thumbnailPath}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate" data-testid={`text-list-title-${project.id}`}>
              {project.title}
            </h3>
            <StatusBadge status={project.status} />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{formatDuration(project.totalDuration)}</span>
            <span>{formatDate(project.createdAt)}</span>
          </div>
          {project.status === "generating" && project.progress !== undefined && (
            <div className="mt-2 max-w-xs">
              <Progress value={project.progress} className="h-1.5" />
            </div>
          )}
          {project.errorMessage && (
            <p className="text-sm text-destructive mt-1 line-clamp-2" data-testid={`text-list-error-${project.id}`}>
              {project.errorMessage}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {project.status === "ready" && project.outputPath && (
            <>
              <Link href={`/?preview=${project.id}`}>
                <Button size="icon" variant="default" data-testid={`button-list-play-${project.id}`}>
                  <Play className="w-4 h-4" />
                </Button>
              </Link>
              <a href={project.outputPath} download>
                <Button size="icon" variant="outline" data-testid={`button-list-download-${project.id}`}>
                  <Download className="w-4 h-4" />
                </Button>
              </a>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(project.id)}
            disabled={isDeleting}
            data-testid={`button-list-delete-${project.id}`}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: projects, isLoading, refetch } = useQuery<VideoProject[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id);
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDeletingId(null);
    },
    onError: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const readyProjects = projects?.filter(p => p.status === "ready") || [];
  const generatingProjects = projects?.filter(p => p.status === "generating") || [];
  const draftProjects = projects?.filter(p => p.status === "draft") || [];
  const errorProjects = projects?.filter(p => p.status === "error") || [];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">Projects</h1>
            <p className="text-muted-foreground">
              {projects?.length || 0} total projects
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <div className="flex border rounded-md">
              <Button
                size="icon"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                onClick={() => setViewMode("grid")}
                className="rounded-r-none"
                data-testid="button-view-grid"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                onClick={() => setViewMode("list")}
                className="rounded-l-none"
                data-testid="button-view-list"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Link href="/">
              <Button data-testid="button-new-project">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-md">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-ready-count">{readyProjects.length}</p>
                  <p className="text-sm text-muted-foreground">Ready</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-md">
                  <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-generating-count">{generatingProjects.length}</p>
                  <p className="text-sm text-muted-foreground">Generating</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                  <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-draft-count">{draftProjects.length}</p>
                  <p className="text-sm text-muted-foreground">Drafts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900 rounded-md">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-error-count">{errorProjects.length}</p>
                  <p className="text-sm text-muted-foreground">Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className={viewMode === "grid" 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" 
            : "space-y-3"
          }>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i}>
                <div className="aspect-video bg-muted rounded-t-md">
                  <Skeleton className="w-full h-full" />
                </div>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={handleDelete}
                  isDeleting={deletingId === project.id}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(project => (
                <ProjectListItem
                  key={project.id}
                  project={project}
                  onDelete={handleDelete}
                  isDeleting={deletingId === project.id}
                />
              ))}
            </div>
          )
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first AI-generated video to get started
              </p>
              <Link href="/">
                <Button data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Video
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
