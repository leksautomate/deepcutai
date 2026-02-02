import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Sparkles, Zap, Film, Mic, Image, Loader2, Lock, User } from "lucide-react";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { data: setupStatus, isLoading: setupLoading } = useQuery<{ needsSetup: boolean }>({
    queryKey: ["/api/setup/status"],
  });

  useEffect(() => {
    if (setupStatus?.needsSetup) {
      setLocation("/setup");
    }
  }, [setupStatus, setLocation]);

  if (user) {
    setLocation("/");
    return null;
  }

  if (setupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (setupStatus?.needsSetup) {
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  const features = [
    {
      icon: Sparkles,
      title: "AI Script Generation",
      description: "Generate engaging video scripts with Google Gemini AI"
    },
    {
      icon: Mic,
      title: "Natural Voiceovers",
      description: "Convert text to natural speech with Speechify TTS"
    },
    {
      icon: Image,
      title: "AI Image Generation",
      description: "Create stunning visuals with Freepik AI"
    },
    {
      icon: Film,
      title: "Automated Rendering",
      description: "Assemble everything into polished videos"
    }
  ];

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
                <Video className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="text-left">
                <CardTitle className="text-2xl flex items-center gap-2">
                  DeepCut AI
                  <Sparkles className="w-5 h-5 text-primary" />
                </CardTitle>
                <CardDescription>AI-powered video generation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    required
                    data-testid="input-username"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    data-testid="input-password"
                  />
                </div>
              </div>
              {loginMutation.isError && (
                <p className="text-sm text-destructive" data-testid="text-login-error">
                  Invalid username or password
                </p>
              )}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex flex-1 bg-primary/5 items-center justify-center p-12 border-l">
        <div className="max-w-lg">
          <h2 className="text-3xl font-bold mb-4">
            Create Faceless Videos in Minutes
          </h2>
          <p className="text-muted-foreground mb-8">
            DeepCut AI automates the entire video creation process. Just provide a topic, and our AI generates scripts, voiceovers, images, and assembles them into professional videos.
          </p>
          
          <div className="grid gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-card border">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-lg bg-card border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="w-4 h-4 text-primary" />
              <span>Powered by Gemini AI, Speechify TTS, and Freepik AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
