import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Loader2, Download, Sparkles, Image as ImageIcon } from "lucide-react";
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

export default function ImageGeneratorPage() {
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
        title: "Image Forged!",
        description: "Your masterwork is ready.",
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
    <div className="flex flex-col h-full overflow-auto relative bg-background">
      {/* Ambient background glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10 relative z-10">
        <div className="mb-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-blue-300 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Image Synthesis</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-white/60 drop-shadow-sm flex items-center justify-center gap-3">
            <Wand2 className="w-10 h-10 text-cyan-400" />
            AI Art Studio
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Generate breathtaking neural network art directly into your workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-4">
            <Card className="p-6 bg-black/40 backdrop-blur-2xl border-white/10 shadow-2xl relative group overflow-hidden transition-all duration-500 hover:border-cyan-500/30">
              {/* Subtle hover gradient inside card */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

              <div className="space-y-6 relative z-10">
                <div className="space-y-3">
                  <Label htmlFor="prompt" className="text-sm font-semibold text-white/90">Master Prompt</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe the image you want to generate (English or Chinese)..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-24 bg-black/50 border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20 placeholder:text-white/20 resize-none"
                    data-testid="input-image-prompt"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="generator" className="text-sm font-semibold text-white/90">Synthesis Engine</Label>
                  <Select value={generator} onValueChange={setGenerator}>
                    <SelectTrigger className="bg-black/50 border-white/10 focus:ring-cyan-500/20 data-[state=open]:border-cyan-500/50" data-testid="select-generator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-white/10">
                      <SelectItem value="pollinations" className="focus:bg-white/5 cursor-pointer">Grand Image (Pollinations)</SelectItem>
                      <SelectItem value="seedream" className="focus:bg-white/5 cursor-pointer">Seedream (Freepik)</SelectItem>
                      <SelectItem value="wavespeed" className="focus:bg-white/5 cursor-pointer">WaveSpeed</SelectItem>
                      <SelectItem value="runpod" className="focus:bg-white/5 cursor-pointer">RunPod Native</SelectItem>
                      <SelectItem value="whisk" className="focus:bg-white/5 cursor-pointer">Whisk (Google IMAGEN 3.5)</SelectItem>
                    </SelectContent>
                  </Select>
                  {!hasApiKey && (
                    <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 mt-2">
                      <p className="text-xs text-destructive font-medium flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                        API key not configured in settings
                      </p>
                    </div>
                  )}
                </div>

                {generator === "pollinations" && (
                  <div className="space-y-3">
                    <Label htmlFor="pollinations-model" className="text-sm font-semibold text-white/90">Neural Mode</Label>
                    <Select value={pollinationsModel} onValueChange={setPollinationsModel}>
                      <SelectTrigger className="bg-black/50 border-white/10 focus:ring-cyan-500/20 data-[state=open]:border-cyan-500/50" data-testid="select-pollinations-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-white/10">
                        {POLLINATIONS_MODELS.map((model) => (
                          <SelectItem key={model.value} value={model.value} className="focus:bg-white/5 cursor-pointer">
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1 text-center">API key optional (for higher limits)</p>
                  </div>
                )}

                <div className="space-y-5 pt-2">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="width" className="text-sm font-semibold text-white/90">Width Target</Label>
                      <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">{width}px</span>
                    </div>
                    <Slider
                      value={[width]}
                      min={256}
                      max={1536}
                      step={64}
                      onValueChange={([val]) => setWidth(val)}
                      className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-cyan-500 [&_[role=slider]]:shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="height" className="text-sm font-semibold text-white/90">Height Target</Label>
                      <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">{height}px</span>
                    </div>
                    <Slider
                      value={[height]}
                      min={256}
                      max={1536}
                      step={64}
                      onValueChange={([val]) => setHeight(val)}
                      className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-cyan-500 [&_[role=slider]]:shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="seed" className="text-sm font-semibold text-white/90">Seed (-1 for random)</Label>
                  <Input
                    id="seed"
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    className="bg-black/50 border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20 placeholder:text-white/20"
                    data-testid="input-seed"
                  />
                </div>

                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!prompt || !hasApiKey || generateMutation.isPending}
                  className="w-full mt-6 h-12 text-sm md:text-base font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 hover:opacity-90 transition-all duration-300 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] border-0 disabled:opacity-50 disabled:shadow-none"
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Forging Pixels...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      Generate Masterpiece
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-8 h-full min-h-[500px]">
            <Card className="h-full p-2 bg-black/40 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden relative flex flex-col items-center justify-center group pointer-events-auto">
              {generatedImage ? (
                <div className="w-full h-full relative rounded-xl overflow-hidden bg-black/80 flex flex-col group/image border border-white/5 transition-all duration-500 hover:border-white/20">
                  <img
                    src={generatedImage}
                    alt="Generated Masterpiece"
                    className="w-full h-full object-contain max-h-[70vh] rounded-xl"
                    data-testid="img-generated"
                  />

                  {/* Floating Action Bar overlay on image */}
                  <div className="absolute top-4 right-4 flex opacity-0 group-hover/image:opacity-100 transition-opacity duration-300">
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="bg-black/60 backdrop-blur-md hover:bg-black/80 text-white border-white/10 shadow-xl"
                      data-testid="button-download"
                    >
                      <a href={generatedImage} download>
                        <Download className="w-4 h-4 mr-2" />
                        Save High-Res
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center w-full h-full min-h-[400px]">
                  <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/30 rounded-2xl animate-pulse blur-xl" />
                    <div className="relative flex items-center justify-center w-full h-full bg-black/50 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl group-hover:border-white/20 transition-all duration-500">
                      <ImageIcon className="w-10 h-10 text-white/40 group-hover:text-white/60 transition-colors duration-500" />
                    </div>
                  </div>
                  <h3 className="text-xl font-medium text-white/90 mb-2">Neural Canvas</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Enter a dynamic portrait description and synthesize high-fidelity image artifacts instantly.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
