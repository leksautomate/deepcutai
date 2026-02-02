import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function ApiSettings() {
  const { toast } = useToast();
  const [newProvider, setNewProvider] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

  const { data: apiKeysData, isLoading } = useQuery({
    queryKey: ["/api/api-keys"],
    queryFn: () => apiRequest("GET", "/api/api-keys"),
  });

  const apiKeys = Array.isArray(apiKeysData) ? apiKeysData : [];

  const addKeyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/api-keys", {
        provider: newProvider,
        apiKey: newApiKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setNewProvider("");
      setNewApiKey("");
      toast({
        title: "API key added",
        description: "Your API key has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/api-keys/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "API key deleted",
        description: "Your API key has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      <div className="flex-1 max-w-4xl mx-auto w-full p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">API Keys Settings</h1>
          <p className="text-muted-foreground">Manage your API keys for image generation services</p>
        </div>

        {/* Add New API Key */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add New API Key</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="provider" className="text-sm font-medium mb-2 block">Provider</Label>
              <select
                id="provider"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                data-testid="select-provider"
              >
                <option value="">Select a provider</option>
                <option value="seedream">Seedream</option>
                <option value="wavespeed">WaveSpeed</option>
                <option value="runpod">RunPod</option>
              </select>
            </div>
            <div>
              <Label htmlFor="api-key" className="text-sm font-medium mb-2 block">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Paste your API key here"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                data-testid="input-api-key"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => addKeyMutation.mutate()}
                disabled={!newProvider || !newApiKey || addKeyMutation.isPending}
                className="w-full"
                data-testid="button-add-key"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Key
              </Button>
            </div>
          </div>
        </Card>

        {/* Existing API Keys */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Your API Keys</h2>
          {apiKeys.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No API keys configured yet. Add one above to get started.
            </Card>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key: any) => (
                <Card key={key.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{key.provider.charAt(0).toUpperCase() + key.provider.slice(1)}</p>
                    <p className="text-sm text-muted-foreground">
                      {key.apiKey.substring(0, 10)}...{key.apiKey.substring(key.apiKey.length - 10)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteKeyMutation.mutate(key.id)}
                    disabled={deleteKeyMutation.isPending}
                    data-testid={`button-delete-key-${key.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
