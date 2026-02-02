import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Trash2, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface SystemLogEntry {
  id: string;
  level: "info" | "warn" | "error" | "debug";
  category: string;
  message: string;
  details?: Record<string, unknown>;
  projectId?: string;
  createdAt: string;
}

export default function LogsDashboard() {
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: logs = [], isLoading, refetch } = useQuery<SystemLogEntry[]>({
    queryKey: ["/api/logs", levelFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("limit", "200");
      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/logs");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warn":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "debug":
        return <Bug className="h-4 w-4 text-gray-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return <Badge variant="destructive">ERROR</Badge>;
      case "warn":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">WARN</Badge>;
      case "info":
        return <Badge variant="secondary">INFO</Badge>;
      case "debug":
        return <Badge variant="outline">DEBUG</Badge>;
      default:
        return <Badge variant="outline">{level.toUpperCase()}</Badge>;
    }
  };

  const categories = ["all", "image", "tts", "script", "render", "api", "system", "server", "auth", "queue", "cleanup", "regenerate"];
  const levels = ["all", "error", "warn", "info", "debug"];

  const errorCount = logs.filter(l => l.level === "error").length;
  const warnCount = logs.filter(l => l.level === "warn").length;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-logs-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">System Logs</h1>
          <p className="text-muted-foreground">Monitor errors and system activity</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-logs"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => clearLogsMutation.mutate()}
            disabled={clearLogsMutation.isPending}
            data-testid="button-clear-logs"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{errorCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-500">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{warnCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-24" data-testid="select-level-filter">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                {levels.map(level => (
                  <SelectItem key={level} value={level}>
                    {level === "all" ? "All Levels" : level.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-28" data-testid="select-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "all" ? "All Categories" : cat.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Info className="h-8 w-8 mb-2" />
                <p>No logs found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${
                      log.level === "error"
                        ? "border-red-500/30 bg-red-500/5"
                        : log.level === "warn"
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-border bg-muted/30"
                    }`}
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="flex items-start gap-3">
                      {getLevelIcon(log.level)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getLevelBadge(log.level)}
                          <Badge variant="outline" className="text-xs">
                            {log.category.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.createdAt), "HH:mm:ss")}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium">{log.message}</p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <pre className="mt-2 text-xs bg-background p-2 rounded overflow-x-auto max-h-32">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
