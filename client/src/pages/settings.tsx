import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Key, Mic, Image, Sparkles, Plus, Trash2, Save, CheckCircle, XCircle, Loader2, ArrowLeft, Palette, Settings2, Film, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transitionEffects, type TransitionEffect, voiceOptions, inworldVoiceOptions } from "@shared/schema";
import { Link } from "wouter";
import { UsageAnalytics } from "@/components/UsageAnalytics";

interface CustomVoice {
  id: string;
  name: string;
  voiceId: string;
  provider: "speechify" | "inworld";
}

interface ImageStyleSettings {
  art_style: string;
  composition: string;
  color_style: string;
  fine_details: string;
}

interface TransitionSettings {
  defaultTransition: TransitionEffect;
  transitionDuration: number;
}

type ScriptProvider = "gemini" | "groq";

interface AppSettings {
  customVoices: CustomVoice[];
  sceneSettings: {
    targetWords: number;
    maxWords: number;
    minDuration: number;
    maxDuration: number;
  };
  imageStyleSettings: ImageStyleSettings;
  transitionSettings: TransitionSettings;
  scriptProvider: ScriptProvider;
}

const defaultSettings: AppSettings = {
  customVoices: [],
  sceneSettings: {
    targetWords: 50,
    maxWords: 60,
    minDuration: 15,
    maxDuration: 25,
  },
  imageStyleSettings: {
    art_style: "Digital concept art mimicking romantic oil painting with soft, painterly brushstrokes.",
    composition: "One-point perspective leading down a central street, framed by tall buildings on both sides.",
    color_style: "Warm golden sunlight and earthy browns contrasted against cool blue clothing and shadows.",
    fine_details: "Weathered stone architecture, medieval peasant attire, and market stalls with canvas awnings.",
  },
  transitionSettings: {
    defaultTransition: "fade",
    transitionDuration: 0.5,
  },
  scriptProvider: "gemini",
};

// Danger Zone Component
function DangerZone() {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const confirmPhrase = "DELETE ALL";

  const wipeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/danger-zone/wipe-all");
      return res.json();
    },
    onSuccess: (data: { deletedProjects: number; deletedFiles: number; freedMB: number }) => {
      queryClient.invalidateQueries();
      setConfirmText("");
      toast({
        title: "All Assets Wiped",
        description: `Deleted ${data.deletedProjects} projects, ${data.deletedFiles} files. Freed ${data.freedMB} MB.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Wipe Failed",
        description: error.message || "Failed to wipe assets",
        variant: "destructive",
      });
    },
  });

  const canWipe = confirmText === confirmPhrase;

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible actions that will permanently delete data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
          <h4 className="font-medium text-destructive mb-2">Wipe All Generated Assets</h4>
          <p className="text-sm text-muted-foreground mb-4">
            This will permanently delete:
          </p>
          <ul className="text-sm text-muted-foreground mb-4 list-disc list-inside space-y-1">
            <li>All video projects from the database</li>
            <li>All generated images and audio files</li>
            <li>All TTS output files</li>
            <li>All rendered videos</li>
          </ul>
          <p className="text-sm text-destructive font-medium mb-4">
            ⚠️ This action cannot be undone!
          </p>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="confirmWipe" className="text-sm">
                Type <code className="px-1.5 py-0.5 bg-muted rounded font-mono">{confirmPhrase}</code> to confirm:
              </Label>
              <Input
                id="confirmWipe"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE ALL to confirm"
                className="max-w-xs"
                data-testid="input-confirm-wipe"
              />
            </div>

            <Button
              variant="destructive"
              onClick={() => wipeMutation.mutate()}
              disabled={!canWipe || wipeMutation.isPending}
              data-testid="button-wipe-all"
            >
              {wipeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wiping...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Wipe All Assets
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [newVoiceName, setNewVoiceName] = useState("");
  const [newVoiceId, setNewVoiceId] = useState("");
  const [newVoiceProvider, setNewVoiceProvider] = useState<"speechify" | "inworld">("inworld");
  const [apiKeys, setApiKeys] = useState({
    gemini: "",
    groq: "",
    speechify: "",
    freepik: "",
    wavespeed: "",
    runpod: "",
    pollinations: "",
    inworld: "",
    whisk: "",
  });
  const [showApiKeys, setShowApiKeys] = useState(false);

  const { data: serverSettings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: apiStatus } = useQuery<{
    gemini: boolean;
    groq: boolean;
    speechify: boolean;
    freepik: boolean;
    wavespeed: boolean;
    runpod: boolean;
    pollinations: boolean;
    inworld: boolean;
    whisk: boolean;
    whiskStatus?: {
      isValid: boolean;
      isExpired: boolean;
      expirationDate: string | null;
      expiresIn: string | null;
      error: string | null;
    };
  }>({
    queryKey: ["/api/settings/status"],
  });

  useEffect(() => {
    if (serverSettings) {
      setSettings(serverSettings);
    }
  }, [serverSettings]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      const response = await apiRequest("POST", "/api/settings", newSettings);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings.",
        variant: "destructive",
      });
    },
  });

  const saveApiKeysMutation = useMutation({
    mutationFn: async (keys: typeof apiKeys) => {
      const response = await apiRequest("POST", "/api/settings/api-keys", keys);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/status"] });
      setApiKeys({ gemini: "", groq: "", speechify: "", freepik: "", wavespeed: "", runpod: "", pollinations: "", inworld: "", whisk: "" });
      setShowApiKeys(false);
      toast({
        title: "API Keys Updated",
        description: "Your API keys have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save API keys.",
        variant: "destructive",
      });
    },
  });

  const handleSaveApiKeys = () => {
    const hasKeys = Object.values(apiKeys).some(k => k.trim());
    if (!hasKeys) {
      toast({
        title: "No Keys Entered",
        description: "Please enter at least one API key.",
        variant: "destructive",
      });
      return;
    }
    saveApiKeysMutation.mutate(apiKeys);
  };

  const handleAddVoice = () => {
    if (!newVoiceName.trim() || !newVoiceId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both a name and voice ID.",
        variant: "destructive",
      });
      return;
    }

    const newVoice: CustomVoice = {
      id: `custom-${Date.now()}`,
      name: newVoiceName.trim(),
      voiceId: newVoiceId.trim(),
      provider: newVoiceProvider,
    };

    setSettings((prev) => ({
      ...prev,
      customVoices: [...prev.customVoices, newVoice],
    }));

    setNewVoiceName("");
    setNewVoiceId("");
  };

  const handleRemoveVoice = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      customVoices: prev.customVoices.filter((v) => v.id !== id),
    }));
  };

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const StatusIcon = ({ connected }: { connected?: boolean }) => {
    if (connected === undefined) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    return connected ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-destructive" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6 pb-20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Configure API connections and video generation settings</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-settings">
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save All Settings
          </Button>
        </div>

        <Tabs defaultValue="api" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="api" className="flex items-center gap-2" data-testid="tab-api">
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="voices" className="flex items-center gap-2" data-testid="tab-voices">
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">Voices</span>
            </TabsTrigger>
            <TabsTrigger value="scenes" className="flex items-center gap-2" data-testid="tab-scenes">
              <Film className="w-4 h-4" />
              <span className="hidden sm:inline">Scenes</span>
            </TabsTrigger>
            <TabsTrigger value="style" className="flex items-center gap-2" data-testid="tab-style">
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Image Style</span>
            </TabsTrigger>
            <TabsTrigger value="transitions" className="flex items-center gap-2" data-testid="tab-transitions">
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Transitions</span>
            </TabsTrigger>
            <TabsTrigger value="danger" className="flex items-center gap-2 text-destructive" data-testid="tab-danger">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Danger</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-6">
            {/* Dedicated Whisk Cookie Section */}
            <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-white dark:from-purple-950 dark:to-background">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="w-5 h-5 text-purple-600" />
                  Google Whisk (IMAGEN 3.5)
                </CardTitle>
                <CardDescription>
                  Cookie-based authentication for Google's advanced image generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-background border">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium">Cookie Status:</span>
                      {apiStatus?.whiskStatus ? (
                        apiStatus.whiskStatus.isExpired ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            EXPIRED - Please update cookie
                          </Badge>
                        ) : apiStatus.whiskStatus.isValid ? (
                          <Badge className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
                            <CheckCircle className="w-3 h-3" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Not Configured
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline">Loading...</Badge>
                      )}
                    </div>
                    {apiStatus?.whiskStatus?.isValid && !apiStatus.whiskStatus.isExpired && apiStatus.whiskStatus.expiresIn && (
                      <p className="text-sm text-muted-foreground">
                        Expires in: <span className="font-medium text-green-600">{apiStatus.whiskStatus.expiresIn}</span>
                      </p>
                    )}
                    {apiStatus?.whiskStatus?.expirationDate && (
                      <p className="text-xs text-muted-foreground">
                        Expiration: {new Date(apiStatus.whiskStatus.expirationDate).toLocaleDateString()} at {new Date(apiStatus.whiskStatus.expirationDate).toLocaleTimeString()}
                      </p>
                    )}
                    {apiStatus?.whiskStatus?.error && (
                      <p className="text-sm text-destructive mt-1">{apiStatus.whiskStatus.error}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whiskCookieMain">Paste Cookie JSON</Label>
                  <Textarea
                    id="whiskCookieMain"
                    placeholder='Paste the JSON array exported from browser (e.g., [{"name": "__Secure-1PSID", "value": "xxx", ...}])'
                    value={apiKeys.whisk}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, whisk: e.target.value }))}
                    className="font-mono text-xs h-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    1. Install "EditThisCookie" or similar browser extension | 2. Go to labs.google and sign in | 3. Export cookies as JSON | 4. Paste here and save
                  </p>
                </div>

                <Button
                  onClick={handleSaveApiKeys}
                  disabled={saveApiKeysMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {saveApiKeysMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Whisk Cookie
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API Status
                </CardTitle>
                <CardDescription>
                  Connection status for all external services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Gemini AI</p>
                        <p className="text-xs text-muted-foreground">Script Generation</p>
                      </div>
                    </div>
                    <StatusIcon connected={apiStatus?.gemini} />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="font-medium">Groq AI</p>
                        <p className="text-xs text-muted-foreground">Image Prompts</p>
                      </div>
                    </div>
                    <StatusIcon connected={apiStatus?.groq} />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="font-medium">Speechify</p>
                        <p className="text-xs text-muted-foreground">Text-to-Speech</p>
                      </div>
                    </div>
                    <StatusIcon connected={apiStatus?.speechify} />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5 text-cyan-500" />
                      <div>
                        <p className="font-medium">Inworld</p>
                        <p className="text-xs text-muted-foreground">Text-to-Speech</p>
                      </div>
                    </div>
                    <StatusIcon connected={apiStatus?.inworld} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Image className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium">Freepik/Seedream</p>
                        <p className="text-xs text-muted-foreground">Image Generation</p>
                      </div>
                    </div>
                    <StatusIcon connected={apiStatus?.freepik} />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Image className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="font-medium">WaveSpeed</p>
                        <p className="text-xs text-muted-foreground">Image Generation</p>
                      </div>
                    </div>
                    <StatusIcon connected={apiStatus?.wavespeed} />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Image className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="font-medium">RunPod</p>
                        <p className="text-xs text-muted-foreground">Image Generation</p>
                      </div>
                    </div>
                    <StatusIcon connected={apiStatus?.runpod} />
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Script Generation Provider</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Choose which AI to use for generating video scripts. If the primary fails, it will automatically try the other.
                    </p>
                    <div className="flex items-center gap-4">
                      <Select
                        value={settings.scriptProvider || "gemini"}
                        onValueChange={(v) => setSettings(prev => ({ ...prev, scriptProvider: v as ScriptProvider }))}
                      >
                        <SelectTrigger className="w-[200px]" data-testid="select-script-provider">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Gemini AI (Primary)</SelectItem>
                          <SelectItem value="groq">Groq AI (Primary)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant="outline">
                        Fallback: {settings.scriptProvider === "groq" ? "Gemini" : "Groq"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    {showApiKeys ? "Enter your API keys below:" : "Configure API keys for external services"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiKeys(!showApiKeys)}
                    data-testid="button-toggle-api-keys"
                  >
                    <Settings2 className="w-4 h-4 mr-2" />
                    {showApiKeys ? "Hide" : "Configure Keys"}
                  </Button>
                </div>

                {showApiKeys && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="geminiKey">Gemini API Key</Label>
                        <Input
                          id="geminiKey"
                          type="password"
                          placeholder={apiStatus?.gemini ? "Key configured" : "Enter API key"}
                          value={apiKeys.gemini}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, gemini: e.target.value }))}
                          data-testid="input-gemini-key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="groqKey">Groq API Key</Label>
                        <Input
                          id="groqKey"
                          type="password"
                          placeholder={apiStatus?.groq ? "Key configured" : "Enter API key"}
                          value={apiKeys.groq}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, groq: e.target.value }))}
                          data-testid="input-groq-key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="speechifyKey">Speechify API Key</Label>
                        <Input
                          id="speechifyKey"
                          type="password"
                          placeholder={apiStatus?.speechify ? "Key configured" : "Enter API key"}
                          value={apiKeys.speechify}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, speechify: e.target.value }))}
                          data-testid="input-speechify-key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inworldKey">Inworld TTS API Key</Label>
                        <Input
                          id="inworldKey"
                          type="password"
                          placeholder={apiStatus?.inworld ? "Key configured" : "Enter API key"}
                          value={apiKeys.inworld}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, inworld: e.target.value }))}
                          data-testid="input-inworld-key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="freepikKey">Freepik/Seedream API Key</Label>
                        <Input
                          id="freepikKey"
                          type="password"
                          placeholder={apiStatus?.freepik ? "Key configured" : "Enter API key"}
                          value={apiKeys.freepik}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, freepik: e.target.value }))}
                          data-testid="input-freepik-key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wavespeedKey">WaveSpeed API Key</Label>
                        <Input
                          id="wavespeedKey"
                          type="password"
                          placeholder={apiStatus?.wavespeed ? "Key configured" : "Enter API key"}
                          value={apiKeys.wavespeed}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, wavespeed: e.target.value }))}
                          data-testid="input-wavespeed-key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="runpodKey">RunPod API Key</Label>
                        <Input
                          id="runpodKey"
                          type="password"
                          placeholder={apiStatus?.runpod ? "Key configured" : "Enter API key"}
                          value={apiKeys.runpod}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, runpod: e.target.value }))}
                          data-testid="input-runpod-key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pollinationsKey">Pollinations API Key (Optional)</Label>
                        <Input
                          id="pollinationsKey"
                          type="password"
                          placeholder={apiStatus?.pollinations ? "Key configured" : "Enter API key (optional)"}
                          value={apiKeys.pollinations}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, pollinations: e.target.value }))}
                          data-testid="input-pollinations-key"
                        />
                        <p className="text-xs text-muted-foreground">
                          API key is optional for Pollinations. Use it for higher rate limits.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="whiskCookie">Google Whisk Cookie (JSON Format)</Label>
                        <Textarea
                          id="whiskCookie"
                          placeholder={apiStatus?.whisk ? "Cookie configured - paste new JSON to update" : "Paste cookie JSON array from browser extension"}
                          value={apiKeys.whisk}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, whisk: e.target.value }))}
                          data-testid="input-whisk-cookie"
                          className="font-mono text-xs h-24"
                        />
                        {apiStatus?.whiskStatus && (
                          <div className="flex items-center gap-2 mt-2">
                            {apiStatus.whiskStatus.isExpired ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                Cookie Expired
                              </Badge>
                            ) : apiStatus.whiskStatus.isValid ? (
                              <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                                <CheckCircle className="w-3 h-3" />
                                Valid {apiStatus.whiskStatus.expiresIn && `- Expires in ${apiStatus.whiskStatus.expiresIn}`}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {apiStatus.whiskStatus.error || "Unknown status"}
                              </Badge>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          For Whisk (IMAGEN 3.5): Use a browser extension like "EditThisCookie" to export cookies as JSON from labs.google. The JSON format allows checking expiration dates.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSaveApiKeys}
                        disabled={saveApiKeysMutation.isPending}
                        data-testid="button-save-api-keys"
                      >
                        {saveApiKeysMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="w-4 h-4 mr-2" />
                        )}
                        Save API Keys
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Keys are stored securely in the database. Only enter keys you want to update.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="w-5 h-5" />
                  Voice Management
                </CardTitle>
                <CardDescription>
                  Manage TTS voices for video narration. Supports Speechify and Inworld TTS providers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Default Speechify Voices</h4>
                  <div className="flex flex-wrap gap-2">
                    {voiceOptions.map((voice) => (
                      <Badge key={voice.id} variant="outline" className="py-1.5 px-3">
                        <span>{voice.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({voice.gender}, {voice.accent})</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Default Inworld Voices</h4>
                  <div className="flex flex-wrap gap-2">
                    {inworldVoiceOptions.map((voice) => (
                      <Badge key={voice.id} variant="outline" className="py-1.5 px-3">
                        <span>{voice.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({voice.gender})</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Custom Voices</h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {settings.customVoices.map((voice) => (
                      <Badge key={voice.id} variant="secondary" className="flex items-center gap-2 py-1.5 px-3">
                        <span>{voice.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({voice.provider === "inworld" ? "Inworld" : "Speechify"})
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 ml-1"
                          onClick={() => handleRemoveVoice(voice.id)}
                          data-testid={`button-remove-voice-${voice.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                    {settings.customVoices.length === 0 && (
                      <p className="text-sm text-muted-foreground">No custom voices added yet</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="voiceProvider">TTS Provider</Label>
                      <Select value={newVoiceProvider} onValueChange={(v) => setNewVoiceProvider(v as "speechify" | "inworld")}>
                        <SelectTrigger id="voiceProvider" data-testid="select-voice-provider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inworld">Inworld TTS</SelectItem>
                          <SelectItem value="speechify">Speechify</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="voiceName">Voice Name</Label>
                      <Input
                        id="voiceName"
                        placeholder="e.g., My Custom Voice"
                        value={newVoiceName}
                        onChange={(e) => setNewVoiceName(e.target.value)}
                        data-testid="input-voice-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="voiceId">Voice ID</Label>
                      <Input
                        id="voiceId"
                        placeholder={newVoiceProvider === "inworld" ? "e.g., default-xtytd8coit3byx-lffsuog__jordan" : "e.g., fc4da0fd-52fb-4496-bd7f-b4a4e38dd57a"}
                        value={newVoiceId}
                        onChange={(e) => setNewVoiceId(e.target.value)}
                        data-testid="input-voice-id"
                      />
                    </div>
                  </div>

                  <Button onClick={handleAddVoice} variant="outline" className="mt-4" data-testid="button-add-voice">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Custom Voice
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scenes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  Scene Generation Settings
                </CardTitle>
                <CardDescription>
                  Configure how scripts are split into scenes for video generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="targetWords">Target Words per Scene</Label>
                    <Input
                      id="targetWords"
                      type="number"
                      min={20}
                      max={80}
                      value={settings.sceneSettings.targetWords}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          sceneSettings: { ...prev.sceneSettings, targetWords: parseInt(e.target.value) || 50 },
                        }))
                      }
                      data-testid="input-target-words"
                    />
                    <p className="text-xs text-muted-foreground">Aim for 45-55 words per scene</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxWords">Maximum Words per Scene</Label>
                    <Input
                      id="maxWords"
                      type="number"
                      min={40}
                      max={100}
                      value={settings.sceneSettings.maxWords}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          sceneSettings: { ...prev.sceneSettings, maxWords: parseInt(e.target.value) || 60 },
                        }))
                      }
                      data-testid="input-max-words"
                    />
                    <p className="text-xs text-muted-foreground">Hard cap at 60 words recommended</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minDuration">Minimum Scene Duration (seconds)</Label>
                    <Input
                      id="minDuration"
                      type="number"
                      min={5}
                      max={30}
                      value={settings.sceneSettings.minDuration}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          sceneSettings: { ...prev.sceneSettings, minDuration: parseInt(e.target.value) || 15 },
                        }))
                      }
                      data-testid="input-min-duration"
                    />
                    <p className="text-xs text-muted-foreground">Minimum 15 seconds per scene</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxDuration">Maximum Scene Duration (seconds)</Label>
                    <Input
                      id="maxDuration"
                      type="number"
                      min={15}
                      max={60}
                      value={settings.sceneSettings.maxDuration}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          sceneSettings: { ...prev.sceneSettings, maxDuration: parseInt(e.target.value) || 25 },
                        }))
                      }
                      data-testid="input-max-duration"
                    />
                    <p className="text-xs text-muted-foreground">Maximum 25 seconds per scene</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Scene Generation Rules</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Target: {settings.sceneSettings.targetWords} words per scene (1 image per scene)</li>
                    <li>Duration: {settings.sceneSettings.minDuration}-{settings.sceneSettings.maxDuration} seconds per scene</li>
                    <li>Approximately 3 scenes per minute of video</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="style" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Image Style Settings
                </CardTitle>
                <CardDescription>
                  Customize the visual style for AI-generated images
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="artStyle">Art Style</Label>
                    <Textarea
                      id="artStyle"
                      placeholder="Describe the art style for generated images..."
                      value={settings.imageStyleSettings.art_style}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          imageStyleSettings: { ...prev.imageStyleSettings, art_style: e.target.value },
                        }))
                      }
                      className="min-h-[80px]"
                      data-testid="input-art-style"
                    />
                    <p className="text-xs text-muted-foreground">The overall artistic style and technique</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="composition">Composition</Label>
                    <Textarea
                      id="composition"
                      placeholder="Describe the image composition and framing..."
                      value={settings.imageStyleSettings.composition}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          imageStyleSettings: { ...prev.imageStyleSettings, composition: e.target.value },
                        }))
                      }
                      className="min-h-[80px]"
                      data-testid="input-composition"
                    />
                    <p className="text-xs text-muted-foreground">Camera angle, perspective, and scene layout</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="colorStyle">Color Style</Label>
                    <Textarea
                      id="colorStyle"
                      placeholder="Describe the color palette and lighting..."
                      value={settings.imageStyleSettings.color_style}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          imageStyleSettings: { ...prev.imageStyleSettings, color_style: e.target.value },
                        }))
                      }
                      className="min-h-[80px]"
                      data-testid="input-color-style"
                    />
                    <p className="text-xs text-muted-foreground">Colors, lighting, and mood</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fineDetails">Fine Details</Label>
                    <Textarea
                      id="fineDetails"
                      placeholder="Describe specific details and textures..."
                      value={settings.imageStyleSettings.fine_details}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          imageStyleSettings: { ...prev.imageStyleSettings, fine_details: e.target.value },
                        }))
                      }
                      className="min-h-[80px]"
                      data-testid="input-fine-details"
                    />
                    <p className="text-xs text-muted-foreground">Textures, materials, and subtle elements</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transitions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  Transition Settings
                </CardTitle>
                <CardDescription>
                  Configure video transitions between scenes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="defaultTransition">Default Transition</Label>
                    <Select
                      value={settings.transitionSettings.defaultTransition}
                      onValueChange={(value) =>
                        setSettings((prev) => ({
                          ...prev,
                          transitionSettings: { ...prev.transitionSettings, defaultTransition: value as TransitionEffect },
                        }))
                      }
                    >
                      <SelectTrigger id="defaultTransition" data-testid="select-default-transition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {transitionEffects.map((effect) => (
                          <SelectItem key={effect} value={effect}>
                            {effect.charAt(0).toUpperCase() + effect.slice(1).replace("-", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">The transition effect between scenes</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transitionDuration">Transition Duration (seconds)</Label>
                    <Input
                      id="transitionDuration"
                      type="number"
                      min={0.1}
                      max={2}
                      step={0.1}
                      value={settings.transitionSettings.transitionDuration}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          transitionSettings: { ...prev.transitionSettings, transitionDuration: parseFloat(e.target.value) || 0.5 },
                        }))
                      }
                      data-testid="input-transition-duration"
                    />
                    <p className="text-xs text-muted-foreground">How long the transition lasts (0.1 - 2 seconds)</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Available Transitions</p>
                  <div className="flex flex-wrap gap-2">
                    {transitionEffects.map((effect) => (
                      <Badge key={effect} variant="outline">
                        {effect.charAt(0).toUpperCase() + effect.slice(1).replace("-", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <UsageAnalytics />
          </TabsContent>

          <TabsContent value="danger" className="space-y-6">
            <DangerZone />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
