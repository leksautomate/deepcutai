import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Loader2, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const POLLINATIONS_MODELS = [
  { value: "flux", label: "Flux (Default)" },
  { value: "zimage", label: "Z-Image" },
  { value: "turbo", label: "Turbo (Fast)" },
  { value: "gptimage", label: "GPT Image" },
  { value: "gptimage-large", label: "GPT Image Large" },
  { value: "kontext", label: "Kontext" },
  { value: "seedream", label: "Seedream" },
  { value: "seedream-pro", label: "Seedream Pro" },
  { value: "nanobanana", label: "Nanobanana" },
  { value: "nanobanana-pro", label: "Nanobanana Pro" },
];

export default function ImageGenerator() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [generator, setGenerator] = useState("wavespeed");
  const [pollinationsModel, setPollinationsModel] = useState("flux");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(576);
  const [seed, setSeed] = useState(-1);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);



  const { data: apiStatus } = useQuery({
    queryKey: ["/api/settings/status"],
  });



  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-image", {
        prompt,
        generator,
        pollinationsModel: generator === "pollinations" ? pollinationsModel : undefined,
        width,
        height,
        seed: seed === -1 ? -1 : parseInt(seed.toString()),
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setGeneratedImage(data.imageUrl);
      toast({
        title: "Image generated successfully!",
        description: "Your image is ready.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate image",
        variant: "destructive",
      });
    },
  });

  // Pollinations API key is optional (works without it but with rate limits)
  const hasApiKey = generator === "pollinations"
    ? true
    : (apiStatus as any)?.[generator === "seedream" ? "freepik" : generator] === true;

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      <div className="flex-1 max-w-6xl mx-auto w-full p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Image Generator</h1>
          <p className="text-muted-foreground">Generate beautiful 16:9 aspect ratio images with AI</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="prompt" className="text-sm font-medium mb-2 block">Prompt</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe the image you want to generate (English or Chinese)..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-24"
                    data-testid="input-image-prompt"
                  />
                </div>

                <div>
                  <Label htmlFor="generator" className="text-sm font-medium mb-2 block">Generator</Label>
                  <Select value={generator} onValueChange={setGenerator}>
                    <SelectTrigger data-testid="select-generator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pollinations">Grand Image (Pollinations)</SelectItem>
                      <SelectItem value="seedream">Seedream (Freepik)</SelectItem>
                      <SelectItem value="wavespeed">WaveSpeed</SelectItem>
                      <SelectItem value="runpod">RunPod</SelectItem>
                      <SelectItem value="whisk">Whisk (Google IMAGEN 3.5)</SelectItem>
                    </SelectContent>
                  </Select>
                  {!hasApiKey && (
                    <p className="text-xs text-destructive mt-1">API key not configured</p>
                  )}
                </div>

                {generator === "pollinations" && (
                  <div>
                    <Label htmlFor="pollinations-model" className="text-sm font-medium mb-2 block">AI Model</Label>
                    <Select value={pollinationsModel} onValueChange={setPollinationsModel}>
                      <SelectTrigger data-testid="select-pollinations-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLLINATIONS_MODELS.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      API key optional (for higher rate limits)
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="width" className="text-sm font-medium mb-2 block">Width: {width}px</Label>
                  <input
                    id="width"
                    type="range"
                    min="256"
                    max="1536"
                    step="64"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="w-full"
                    data-testid="slider-width"
                  />
                </div>

                <div>
                  <Label htmlFor="height" className="text-sm font-medium mb-2 block">Height: {height}px</Label>
                  <input
                    id="height"
                    type="range"
                    min="256"
                    max="1536"
                    step="64"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full"
                    data-testid="slider-height"
                  />
                </div>

                <div>
                  <Label htmlFor="seed" className="text-sm font-medium mb-2 block">Seed (-1 for random)</Label>
                  <Input
                    id="seed"
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    data-testid="input-seed"
                  />
                </div>

                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!prompt || !hasApiKey || generateMutation.isPending}
                  className="w-full"
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Image
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              {generatedImage ? (
                <div className="space-y-4">
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-full rounded-lg"
                    data-testid="img-generated"
                  />
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full"
                    data-testid="button-download"
                  >
                    <a href={generatedImage} download>
                      <Download className="w-4 h-4 mr-2" />
                      Download Image
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
                  <div className="text-center">
                    <Wand2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">Your generated image will appear here</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
