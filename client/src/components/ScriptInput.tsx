import { useState } from "react";
import { Sparkles, FileText, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ScriptInputProps {
  script: string;
  title: string;
  onScriptChange: (script: string) => void;
  onTitleChange: (title: string) => void;
}

export function ScriptInput({ script, title, onScriptChange, onTitleChange }: ScriptInputProps) {
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("documentary");
  const [duration, setDuration] = useState("1min");
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-script", {
        topic,
        style,
        duration,
      });
      return response.json();
    },
    onSuccess: (data) => {
      onScriptChange(data.script);
      if (data.title) {
        onTitleChange(data.title);
      }
      toast({
        title: "Script Generated",
        description: "Your AI-generated script is ready for review.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate script. Please try again.",
        variant: "destructive",
      });
    },
  });

  const characterCount = script.length;
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estimatedDuration = Math.ceil(wordCount / 150);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:row-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Script Editor
          </CardTitle>
          <CardDescription>
            Write or paste your video script. Each paragraph will become a scene.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Video Title</Label>
            <Input
              id="title"
              placeholder="Enter your video title..."
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="mt-1.5"
              data-testid="input-title"
            />
          </div>

          <div>
            <Label htmlFor="script">Script Content</Label>
            <Textarea
              id="script"
              placeholder="Write your script here. Separate scenes with blank lines...

Example:
Welcome to our video about artificial intelligence.

AI is transforming how we live and work every day.

From smart assistants to self-driving cars, AI is everywhere."
              value={script}
              onChange={(e) => onScriptChange(e.target.value)}
              className="mt-1.5 min-h-[400px] font-mono text-sm resize-none"
              data-testid="textarea-script"
            />
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
            <div className="flex gap-4">
              <span className="text-muted-foreground">{characterCount.toLocaleString()} chars</span>
              <span className="text-muted-foreground">{wordCount.toLocaleString()} words</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estimatedDuration < 0.5 ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" :
                  estimatedDuration > 5 ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                    "bg-green-500/10 text-green-500 border border-green-500/20"
                }`}>
                Est. {estimatedDuration} min
              </span>
            </div>
          </div>

          {/* Validation Feedback */}
          {wordCount > 0 && wordCount < 50 && (
            <p className="text-xs text-yellow-500 flex items-center gap-1.5 bg-yellow-500/5 p-2 rounded border border-yellow-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              Script might be too short for a good video. Aim for at least 150 words.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Script Generator
          </CardTitle>
          <CardDescription>
            Let AI create a script based on your topic
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="topic">Topic or Subject</Label>
            <Input
              id="topic"
              placeholder="e.g., The history of space exploration"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1.5"
              data-testid="input-topic"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="style">Content Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="mt-1.5" data-testid="select-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="entertaining">Entertaining</SelectItem>
                  <SelectItem value="documentary">Documentary</SelectItem>
                  <SelectItem value="storytelling">Storytelling</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="duration">Video Length</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="mt-1.5" data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30s">30 Seconds</SelectItem>
                  <SelectItem value="1min">1 Minute</SelectItem>
                  <SelectItem value="2min">2 Minutes</SelectItem>
                  <SelectItem value="10min">10 Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => generateMutation.mutate()}
            disabled={!topic.trim() || generateMutation.isPending}
            data-testid="button-generate-script"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Script...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Script with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Script Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              Keep sentences concise for better TTS quality
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              Use blank lines to separate scenes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              Each scene gets its own image and audio
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              Aim for 15-30 words per scene for best results
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">5.</span>
              Avoid special characters that might affect pronunciation
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
