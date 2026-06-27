import { ModeToggle } from "@/components/mode-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAudioPlayer } from "@/hooks/use-audio-player";

function App() {
  const { load, play, setStemGain } = useAudioPlayer();
  const stems = {
    guitar:
      "http://localhost:8000/tracks/b82a825b98df4d29969a1e422e24b6df/stems/guitar.wav",
    drums:
      "http://localhost:8000/tracks/b82a825b98df4d29969a1e422e24b6df/stems/drums.wav",
    bass: "http://localhost:8000/tracks/b82a825b98df4d29969a1e422e24b6df/stems/bass.wav",
    vocals:
      "http://localhost:8000/tracks/b82a825b98df4d29969a1e422e24b6df/stems/vocals.wav",
    other:
      "http://localhost:8000/tracks/b82a825b98df4d29969a1e422e24b6df/stems/other.wav",
    piano:
      "http://localhost:8000/tracks/b82a825b98df4d29969a1e422e24b6df/stems/piano.wav",
  };
  const handleLoadClick = () => {
    load(stems);
  };

  const handlePlayClick = () => {
    play();
  };

  const handleSetStemGainClick = () => {
    setStemGain("guitar", 0);
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            {/* Rename to whatever you want to call it */}
            <span className="text-xl font-semibold tracking-tight">
              Stem Practice
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              beta
            </span>
          </div>
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Multitrack player</CardTitle>
            <CardDescription>
              Upload a song; once separation finishes you'll be able to mute or
              solo each stem and play along.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/*
              TODO (yours — the load-bearing part):
              1. an upload control that POSTs to /tracks
              2. poll GET /jobs/{id} until status === "finished"
              3. the Web Audio multitrack player (per-stem gain, synced playback)
            */}
            <button onClick={handleLoadClick}>Load</button>
            <button onClick={handlePlayClick}>Play</button>
            <button onClick={handleSetStemGainClick}>Set Stem Gain</button>
            <p className="text-sm text-muted-foreground">Player coming soon.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default App;
