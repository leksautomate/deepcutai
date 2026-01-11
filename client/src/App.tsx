import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Video, Sparkles, Settings, LayoutDashboard, Film, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SettingsPage from "@/pages/settings";
import Dashboard from "@/pages/dashboard";
import MyVideos from "@/pages/my-videos";
import ProjectEditor from "@/pages/project-editor";
import AuthPage from "@/pages/auth-page";
import SetupPage from "@/pages/setup-page";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import ImageGenerator from "@/pages/image-generator";
import ApiSettings from "@/pages/api-settings";

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const pageTransition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.2
};

function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logoutMutation } = useAuth();

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between gap-4 px-6 h-16 border-b bg-card">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
              <Video className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                DeepCut AI
                <Sparkles className="w-4 h-4 text-primary" />
              </h1>
              <p className="text-xs text-muted-foreground">AI-powered video generation</p>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/image-generator">
            <Button 
              variant={location === "/image-generator" ? "secondary" : "ghost"} 
              size="icon"
              title="Image Generator"
              data-testid="button-image-generator"
            >
              <Sparkles className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/my-videos">
            <Button 
              variant={location === "/my-videos" ? "secondary" : "ghost"} 
              size="icon"
              data-testid="button-my-videos"
            >
              <Film className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button 
              variant={location === "/dashboard" ? "secondary" : "ghost"} 
              size="icon"
              data-testid="button-dashboard"
            >
              <LayoutDashboard className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button 
              variant={location === "/settings" ? "secondary" : "ghost"} 
              size="icon"
              title="Settings"
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </Link>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      <footer className="border-t bg-card py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Powered by Remotion</span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Gemini AI + Speechify + Freepik</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>All systems operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AppRoutes() {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (location === "/setup") {
    return <SetupPage />;
  }

  if (location === "/auth") {
    return <AuthPage />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <MainLayout>
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          className="h-full"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={pageTransition}
        >
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/my-videos" component={MyVideos} />
            <Route path="/project/:id" component={ProjectEditor} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/image-generator" component={ImageGenerator} />
            <Route path="/api-settings" component={ApiSettings} />
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    </MainLayout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <AppRoutes />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
