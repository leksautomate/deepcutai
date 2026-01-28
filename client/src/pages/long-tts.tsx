import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Mic2, Loader2, Download, Trash2, Plus, Edit2, Volume2, Clock, FileAudio, Zap, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CustomVoice {
  id: string;
  voiceId: string;
  name: string;
  createdAt: string;
}

interface DefaultVoice {
  id: string;
  name: string;
  gender: string;
}

interface TTSFile {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
}

export default function LongTTS() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [removeSilence, setRemoveSilence] = useState(true);
  const [silenceThreshold, setSilenceThreshold] = useState(-40);
  const [minSilenceDuration, setMinSilenceDuration] = useState(0.3);

  // Custom voice dialog
  const [isAddVoiceOpen, setIsAddVoiceOpen] = useState(false);
  const [editingVoice, setEditingVoice] = useState<CustomVoice | null>(null);
  const [newVoiceName, setNewVoiceName] = useState("");
  const [newVoiceId, setNewVoiceId] = useState("");

  // Background job tracking
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Fetch voices
  const { data: voicesData } = useQuery({
    queryKey: ["/api/long-tts/voices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/long-tts/voices");
      return res.json();
    },
  });

  const defaultVoices: DefaultVoice[] = (voicesData as any)?.defaultVoices || [];
  const customVoices: CustomVoice[] = (voicesData as any)?.customVoices || [];

  // Fetch generated files
  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["/api/long-tts/files"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/long-tts/files");
      return res.json();
    },
  });

  const files: TTSFile[] = (filesData as any)?.files || [];

  // Generate TTS mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/long-tts/generate", {
        text,
        voiceId,
        removeSilence,
        silenceThreshold,
        minSilenceDuration,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/long-tts/files"] });
      toast({
        title: "Audio generated successfully!",
        description: `Generated ${data.chunksProcessed} chunks, ${data.durationSeconds?.toFixed(1)}s total`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate audio",
        variant: "destructive",
      });
    },
  });

  // Background TTS generation mutation
  const backgroundMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/long-tts/generate-background", {
        text,
        voiceId,
        removeSilence,
        silenceThreshold,
        minSilenceDuration,
      });
      return response.json();
    },
    onSuccess: (data: { jobId: string }) => {
      setActiveJobId(data.jobId);
      toast({
        title: "Generation started!",
        description: "You can leave this page and come back. Check the status below.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start background generation",
        description: error.message || "Could not start generation",
        variant: "destructive",
      });
    },
  });

  // Poll job status when there's an active job
  const { data: jobStatus, refetch: refetchJobStatus } = useQuery({
    queryKey: ["/api/long-tts/job", activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const res = await apiRequest("GET", `/api/long-tts/job/${activeJobId}`);
      return res.json();
    },
    enabled: !!activeJobId,
    refetchInterval: activeJobId ? 2000 : false, // Poll every 2 seconds
  });

  // Handle job completion
  if (jobStatus?.status === 'complete' && activeJobId) {
    queryClient.invalidateQueries({ queryKey: ["/api/long-tts/files"] });
    toast({
      title: "Audio generated successfully!",
      description: `Generated ${jobStatus.result?.chunksProcessed} chunks`,
    });
    setActiveJobId(null);
  }

  if (jobStatus?.status === 'failed' && activeJobId) {
    toast({
      title: "Generation failed",
      description: jobStatus.error || "Unknown error",
      variant: "destructive",
    });
    setActiveJobId(null);
  }

  // Add custom voice mutation
  const addVoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/long-tts/voices", {
        voiceId: newVoiceId,
        name: newVoiceName,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/long-tts/voices"] });
      setIsAddVoiceOpen(false);
      setNewVoiceName("");
      setNewVoiceId("");
      toast({ title: "Custom voice added!" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add voice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update custom voice mutation
  const updateVoiceMutation = useMutation({
    mutationFn: async () => {
      if (!editingVoice) return;
      const response = await apiRequest("PUT", `/api/long-tts/voices/${editingVoice.id}`, {
        voiceId: newVoiceId,
        name: newVoiceName,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/long-tts/voices"] });
      setEditingVoice(null);
      setNewVoiceName("");
      setNewVoiceId("");
      toast({ title: "Custom voice updated!" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update voice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete custom voice mutation
  const deleteVoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/long-tts/voices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/long-tts/voices"] });
      toast({ title: "Custom voice deleted" });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (filename: string) => {
      await apiRequest("DELETE", `/api/long-tts/files/${filename}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/long-tts/files"] });
      toast({ title: "File deleted" });
    },
  });

  const handleEditVoice = (voice: CustomVoice) => {
    setEditingVoice(voice);
    setNewVoiceName(voice.name);
    setNewVoiceId(voice.voiceId);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const characterCount = text.length;
  const estimatedChunks = Math.ceil(characterCount / 1900);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedDuration = (wordCount / 150) * 60; // ~150 words per minute

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      <div className="flex-1 max-w-7xl mx-auto w-full p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Long Text-to-Speech</h1>
          <p className="text-muted-foreground">Convert long texts to natural speech using Inworld TTS</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="xl:col-span-2">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="text" className="text-sm font-medium">Text to Convert</Label>
                    <div className="text-xs text-muted-foreground">
                      {characterCount.toLocaleString()} characters | ~{estimatedChunks} chunks | ~{estimatedDuration.toFixed(0)}s
                    </div>
                  </div>
                  <Textarea
                    id="text"
                    placeholder="Paste your long text here. It will be automatically split into chunks of ~1900 characters each..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Voice</Label>
                    <Select value={voiceId} onValueChange={setVoiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a voice..." />
                      </SelectTrigger>
                      <SelectContent>
                        {defaultVoices.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Default Voices</div>
                            {defaultVoices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.name} ({voice.gender})
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {customVoices.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Custom Voices</div>
                            {customVoices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.voiceId}>
                                {voice.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="remove-silence"
                        checked={removeSilence}
                        onCheckedChange={setRemoveSilence}
                      />
                      <Label htmlFor="remove-silence" className="text-sm">Remove Silence</Label>
                    </div>
                  </div>
                </div>

                {removeSilence && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Silence Threshold: {silenceThreshold}dB
                      </Label>
                      <Slider
                        value={[silenceThreshold]}
                        onValueChange={(v) => setSilenceThreshold(v[0])}
                        min={-60}
                        max={-20}
                        step={1}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Min Duration: {minSilenceDuration}s
                      </Label>
                      <Slider
                        value={[minSilenceDuration]}
                        onValueChange={(v) => setMinSilenceDuration(v[0])}
                        min={0.1}
                        max={2}
                        step={0.1}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={() => generateMutation.mutate()}
                    disabled={!text.trim() || !voiceId || generateMutation.isPending || backgroundMutation.isPending}
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating ({estimatedChunks} chunks)...
                      </>
                    ) : (
                      <>
                        <Mic2 className="w-4 h-4 mr-2" />
                        Generate Now
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => backgroundMutation.mutate()}
                    disabled={!text.trim() || !voiceId || generateMutation.isPending || backgroundMutation.isPending}
                  >
                    {backgroundMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Background
                      </>
                    )}
                  </Button>
                </div>

                {/* Active Job Status */}
                {activeJobId && jobStatus && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {jobStatus.status === 'processing' && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                        {jobStatus.status === 'complete' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {jobStatus.status === 'failed' && (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                        <span className="text-sm font-medium capitalize">
                          {jobStatus.status === 'processing' ? 'Generating in background...' : jobStatus.status}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => refetchJobStatus()}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    {jobStatus.error && (
                      <p className="text-sm text-destructive mt-2">{jobStatus.error}</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Side Panel - Voices & Files */}
          <div className="space-y-6">
            {/* Custom Voices */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Custom Voices
                </h2>
                <Dialog open={isAddVoiceOpen} onOpenChange={setIsAddVoiceOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Custom Voice</DialogTitle>
                      <DialogDescription>
                        Add a custom Inworld voice by providing its Voice ID and a friendly name.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Voice Name</Label>
                        <Input
                          placeholder="e.g., Jordan"
                          value={newVoiceName}
                          onChange={(e) => setNewVoiceName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Voice ID</Label>
                        <Input
                          placeholder="e.g., default-xtytd8coit3byx-lffsuog__jordan"
                          value={newVoiceId}
                          onChange={(e) => setNewVoiceId(e.target.value)}
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          The full Inworld voice ID
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddVoiceOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => addVoiceMutation.mutate()}
                        disabled={!newVoiceName || !newVoiceId || addVoiceMutation.isPending}
                      >
                        {addVoiceMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Add Voice"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {customVoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No custom voices added yet
                </p>
              ) : (
                <div className="space-y-2">
                  {customVoices.map((voice) => (
                    <div
                      key={voice.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{voice.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{voice.voiceId}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEditVoice(voice)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteVoiceMutation.mutate(voice.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Edit Voice Dialog */}
              <Dialog open={!!editingVoice} onOpenChange={() => setEditingVoice(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Custom Voice</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Voice Name</Label>
                      <Input
                        value={newVoiceName}
                        onChange={(e) => setNewVoiceName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Voice ID</Label>
                      <Input
                        value={newVoiceId}
                        onChange={(e) => setNewVoiceId(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditingVoice(null)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => updateVoiceMutation.mutate()}
                      disabled={!newVoiceName || !newVoiceId || updateVoiceMutation.isPending}
                    >
                      {updateVoiceMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Update Voice"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>

            {/* Generated Files */}
            <Card className="p-4">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <FileAudio className="w-4 h-4" />
                Generated Files
              </h2>

              {filesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : files.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No audio files generated yet
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {files.map((file) => (
                    <div
                      key={file.filename}
                      className="p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.filename}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{formatFileSize(file.size)}</span>
                            <span>|</span>
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(file.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={`/api/long-tts/download/${file.filename}`}
                            download={file.filename}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteFileMutation.mutate(file.filename)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <audio
                        controls
                        className="w-full mt-2 h-8"
                        src={`/api/long-tts/download/${file.filename}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
