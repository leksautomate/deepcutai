import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ImagePlus, UserCircle2, Loader2 } from "lucide-react";
import { useCharacterVideo } from "./CharacterContext";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function LeftPanel() {
    const { characters, addCharacter, updateCharacter, removeCharacter } = useCharacterVideo();
    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const { toast } = useToast();

    const handleUploadClick = (id: string) => {
        fileInputRefs.current[id]?.click();
    };

    const handleFileChange = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            updateCharacter(id, { imageUrl: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const handleGenerateAvatar = async (id: string, promptText: string) => {
        if (!promptText) {
            toast({ title: "No Prompt text provided", description: "You need to write a descriptive prompt to generate an avatar.", variant: "destructive" });
            return;
        }
        setIsGenerating(id);
        try {
            const response = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: `Character portrait facing camera, ${promptText}`,
                    generator: "wavespeed",
                    width: 1024,
                    height: 1024,
                }),
            });
            const data = await response.json();
            if (data.imageUrl) {
                updateCharacter(id, { imageUrl: data.imageUrl });
                toast({ title: "Avatar Generated!" });
            } else {
                throw new Error(data.error || "Failed to generate");
            }
        } catch (error: any) {
            toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsGenerating(null);
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">The Cast</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Define the actors starring in your video. Their visual descriptions will be locked to ensure absolute consistency across every scene.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {characters.map((char, index) => (
                    <Card key={char.id} className="relative overflow-hidden border-border/50 bg-black/20">
                        <CardContent className="p-4 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <UserCircle2 className="w-5 h-5 text-primary" />
                                    <h3 className="font-semibold">{char.name || `Actor ${index + 1}`}</h3>
                                </div>
                                {characters.length > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 -mt-1 -mr-1"
                                        onClick={() => removeCharacter(char.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-4 pt-2">
                                <div className="grid gap-2">
                                    <Label htmlFor={`name-${char.id}`}>Character Name</Label>
                                    <Input
                                        id={`name-${char.id}`}
                                        placeholder="e.g., Alex"
                                        value={char.name}
                                        onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor={`prompt-${char.id}`}>Visual Description (Prompt Lock)</Label>
                                    <Textarea
                                        id={`prompt-${char.id}`}
                                        placeholder="e.g., A 25yo confident woman with short neon pink hair, wearing a green leather jacket and red scarf."
                                        className="min-h-[100px] resize-y"
                                        value={char.promptText}
                                        onChange={(e) => updateCharacter(char.id, { promptText: e.target.value })}
                                    />
                                </div>

                                <div className="grid gap-2 pt-2 border-t border-border/30">
                                    <Label>Reference Avatar (Whisk Mapping)</Label>
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 rounded-md bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                                            {char.imageUrl ? (
                                                <img src={char.imageUrl} alt="Avatar" className="h-full w-full object-cover" />
                                            ) : (
                                                <ImagePlus className="h-5 w-5 text-muted-foreground opacity-50" />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                ref={(el) => (fileInputRefs.current[char.id] = el)}
                                                onChange={(e) => handleFileChange(char.id, e)}
                                            />
                                            <Button variant="outline" size="sm" className="w-full" onClick={() => handleUploadClick(char.id)}>
                                                Upload Image
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => handleGenerateAvatar(char.id, char.promptText)}
                                                disabled={isGenerating === char.id}
                                            >
                                                {isGenerating === char.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                Generate Avatar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={addCharacter}
            >
                <Plus className="mr-2 h-4 w-4" />
                Add Another Character
            </Button>
        </div>
    );
}
