import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StemControl } from "@/components/stem-control";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { API_BASE } from "./lib/api";

// Hardcoded for now. The next (and last) Slice 3 step replaces this with the
// real flow: upload → POST /tracks → poll GET /jobs/{id} → load(stems from response).
const TRACK_ID = "ba86ac1ea9704b29bea3a180b5e7a183";
const STEM_NAMES = ["guitar", "drums", "bass", "vocals", "other", "piano"];
const stems = Object.fromEntries(
  STEM_NAMES.map((name) => [
    name,
    `${API_BASE}/tracks/${TRACK_ID}/stems/${name}.wav`,
  ]),
);

function App() {
  const {
    load,
    play,
    stop,
    toggleMute,
    toggleSolo,
    setVolume,
    stemState,
    soloed,
    isPlaying,
  } = useAudioPlayer();

  const stemNames = Object.keys(stemState);
  const loaded = stemNames.length > 0;

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
              Load the stems, then mute or solo each one and play along.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => load(stems)}>
                Load stems
              </Button>
              <Button onClick={play} disabled={!loaded}>
                Play
              </Button>
              <Button variant="outline" onClick={stop} disabled={!isPlaying}>
                Stop
              </Button>
            </div>

            {loaded ? (
              <div className="space-y-2">
                {stemNames.map((name) => (
                  <StemControl
                    key={name}
                    name={name}
                    volume={stemState[name].volume}
                    muted={stemState[name].muted}
                    soloed={soloed === name}
                    onVolumeChange={(v) => setVolume(name, v)}
                    onMuteToggle={() => toggleMute(name)}
                    onSoloToggle={() => toggleSolo(name)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click “Load stems” to begin.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default App;
