import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import {
    Video,
    Sparkles,
    Settings,
    LayoutDashboard,
    Film,
    LogOut,
    ScrollText,
    Mic2
} from "lucide-react";

export function Sidebar() {
    const [location] = useLocation();
    const { logoutMutation } = useAuth();

    const navItems = [
        { href: "/", icon: Video, label: "Create", testId: "nav-create" },
        { href: "/image-generator", icon: Sparkles, label: "Images", testId: "nav-images" },
        { href: "/long-tts", icon: Mic2, label: "Long TTS", testId: "nav-tts" },
        { href: "/my-videos", icon: Film, label: "Videos", testId: "nav-videos" },
        { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", testId: "nav-dashboard" },
        { href: "/logs", icon: ScrollText, label: "Logs", testId: "nav-logs" },
        { href: "/settings", icon: Settings, label: "Settings", testId: "nav-settings" },
    ];

    return (
        <aside className="w-64 border-r flex flex-col glass-panel relative z-20 transition-all duration-300">
            {/* Logo Area */}
            <div className="p-6 border-b border-white/5">
                <Link href="/">
                    <div className="flex items-center gap-3 cursor-pointer group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-105">
                            <Video className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-display font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                                DeepCut
                                <span className="text-primary">AI</span>
                            </h1>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Video Generation</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                    return (
                        <Link key={item.href} href={item.href}>
                            <Button
                                variant="ghost"
                                className={`w-full justify-start gap-3 relative overflow-hidden transition-all duration-300 ${isActive
                                        ? "bg-primary/10 text-primary shadow-sm hover:bg-primary/15"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                    }`}
                                data-testid={item.testId}
                            >
                                {isActive && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                                )}
                                <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                                <span className="font-medium tracking-wide">{item.label}</span>
                            </Button>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer Actions */}
            <div className="p-4 border-t border-white/5 space-y-2 bg-black/20 backdrop-blur-md">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-xs font-medium text-muted-foreground">Theme</span>
                    <ThemeToggle />
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-300"
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    data-testid="button-logout"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                </Button>
            </div>
        </aside>
    );
}
