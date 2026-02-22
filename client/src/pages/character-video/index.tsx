import { CharacterVideoProvider } from "./CharacterContext";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";

export default function CharacterVideoPage() {
    return (
        <CharacterVideoProvider>
            <div className="container mx-auto p-6 max-w-7xl h-[calc(100vh-4rem)]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                    {/* Left Side: Definition & Actors */}
                    <div className="h-full overflow-hidden flex flex-col">
                        <LeftPanel />
                    </div>

                    {/* Right Side: Script, Pacing, and Generation */}
                    <div className="h-full overflow-hidden flex flex-col">
                        <RightPanel />
                    </div>
                </div>
            </div>
        </CharacterVideoProvider>
    );
}
