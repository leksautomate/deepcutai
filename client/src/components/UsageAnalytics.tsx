import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Video, Film, FileText, Image, AudioLines, Clock, TrendingUp, Calendar } from "lucide-react";
import type { UsageStats } from "@shared/schema";

export function UsageAnalytics() {
  const { data: stats, isLoading } = useQuery<UsageStats>({
    queryKey: ["/api/usage/stats"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      label: "Total Videos",
      value: stats?.totalVideos || 0,
      icon: Video,
      color: "text-blue-500",
    },
    {
      label: "Videos Rendered",
      value: stats?.totalRendered || 0,
      icon: Film,
      color: "text-green-500",
    },
    {
      label: "Scripts Generated",
      value: stats?.totalScriptsGenerated || 0,
      icon: FileText,
      color: "text-purple-500",
    },
    {
      label: "Images Generated",
      value: stats?.totalImagesGenerated || 0,
      icon: Image,
      color: "text-orange-500",
    },
    {
      label: "Audio Generated",
      value: stats?.totalAudioGenerated || 0,
      icon: AudioLines,
      color: "text-pink-500",
    },
    {
      label: "Total Duration",
      value: `${stats?.totalDurationMinutes || 0} min`,
      icon: Clock,
      color: "text-cyan-500",
    },
    {
      label: "Today's Videos",
      value: stats?.todayVideos || 0,
      icon: Calendar,
      color: "text-amber-500",
    },
    {
      label: "Today's Renders",
      value: stats?.todayRendered || 0,
      icon: TrendingUp,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <Card key={item.label} data-testid={`stat-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
