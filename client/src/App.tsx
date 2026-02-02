import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";

// Lazy load all pages for code splitting
const Home = lazy(() => import("@/pages/home"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const MyVideos = lazy(() => import("@/pages/my-videos"));
const ProjectEditor = lazy(() => import("@/pages/project-editor"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const SetupPage = lazy(() => import("@/pages/setup-page"));
const ImageGenerator = lazy(() => import("@/pages/image-generator"));
const ApiSettings = lazy(() => import("@/pages/api-settings"));
const LogsDashboard = lazy(() => import("@/pages/logs-dashboard"));
const LongTTS = lazy(() => import("@/pages/long-tts"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Simple loading spinner
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}


import { Sidebar } from "@/components/Sidebar";

function MainLayout({ children }: { children: React.ReactNode }) {
  // const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background relative overflow-hidden">
      {/* Background Mesh Gradient */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none bg-[radial-gradient(at_0%_0%,hsla(210,100%,20%,0.3)_0px,transparent_50%),radial-gradient(at_100%_0%,hsla(180,100%,20%,0.3)_0px,transparent_50%),radial-gradient(at_100%_100%,hsla(280,100%,20%,0.3)_0px,transparent_50%),radial-gradient(at_0%_100%,hsla(240,100%,20%,0.3)_0px,transparent_50%)]" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar - minimal */}
        <header className="h-12 border-b bg-card flex items-center justify-end px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>All systems operational</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t bg-card py-3 px-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Powered by Remotion | Gemini AI + Speechify + Freepik</span>
          </div>
        </footer>
      </div>
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
    return (
      <Suspense fallback={<PageLoader />}>
        <SetupPage />
      </Suspense>
    );
  }

  if (location === "/auth") {
    return (
      <Suspense fallback={<PageLoader />}>
        <AuthPage />
      </Suspense>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AuthPage />
      </Suspense>
    );
  }

  return (
    <MainLayout>
      <Suspense fallback={<PageLoader />}>
        <div key={location} className="page-enter h-full">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/my-videos" component={MyVideos} />
            <Route path="/project/:id" component={ProjectEditor} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/image-generator" component={ImageGenerator} />
            <Route path="/long-tts" component={LongTTS} />
            <Route path="/api-settings" component={ApiSettings} />
            <Route path="/logs" component={LogsDashboard} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </Suspense>
    </MainLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
