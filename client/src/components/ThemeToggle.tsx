import { Moon, Sun, Terminal, Cpu, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, themeOptions, Theme } from "@/lib/theme";

const themeIcons: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  matrix: Code2,
  cyberpunk: Cpu,
  terminal: Terminal,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const CurrentIcon = themeIcons[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          data-testid="button-theme-toggle"
        >
          <CurrentIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themeOptions.map((option) => {
          const Icon = themeIcons[option.value];
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={theme === option.value ? "bg-accent" : ""}
              data-testid={`menu-theme-${option.value}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
