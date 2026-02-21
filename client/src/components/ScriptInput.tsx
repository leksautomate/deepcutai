import { FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScriptWizard } from "./ScriptWizard";

interface ScriptInputProps {
  script: string;
  title: string;
  onScriptChange: (script: string) => void;
  onTitleChange: (title: string) => void;
}

export function ScriptInput({ script, title, onScriptChange, onTitleChange }: ScriptInputProps) {
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

      <ScriptWizard
        onScriptGenerated={(generatedScript, generatedTitle) => {
          onScriptChange(generatedScript);
          onTitleChange(generatedTitle);
        }}
      />
    </div>
  );
}
