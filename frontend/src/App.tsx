import { useEffect } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Slider } from "./components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StemControl } from "@/components/stem-control";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useSeparationJob } from "@/hooks/use-separation-job";
import { useLibrary } from "@/hooks/use-library";
import { API_BASE, getTrack, type Track } from "./lib/api";
import Playhead from "./components/playhead";
import TrackList from "./components/track-list";

function App() {
  const {
    load,
    play,
    pause,
    stop,
    toggleMute,
    toggleSolo,
    setVolume,
    tempo,
    setTempo,
    stemState,
    soloed,
    isPlaying,
    duration,
    getPlayhead,
    setLoop,
    toggleLoop,
    seek,
    loop,
  } = useAudioPlayer();
  const { upload, status, stems } = useSeparationJob();
  const { tracks } = useLibrary();

  function loadFromStems(stems: Record<string, string>) {
    const absolute_paths = Object.fromEntries(
      Object.entries(stems).map(([name, url]) => [name, `${API_BASE}${url}`]),
    );
    load(absolute_paths);
    // Intentionally runs only when `stems` changes; `load` is stable in behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  async function handleTrackClick(track: Track) {
    const trackDetails = await getTrack(track.id);
    loadFromStems(trackDetails.stems);
  }

  useEffect(() => {
    if (!stems) return;
    loadFromStems(stems);
  }, [stems]);

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
            <p className="text-sm text-muted-foreground">{status}</p>
            <div className="flex gap-2">
              <input
                type="file"
                accept="audio/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  await upload(file);
                }}
              />
              <Button onClick={play} disabled={!loaded}>
                Play
              </Button>
              <Button onClick={pause} disabled={!loaded}>
                Pause
              </Button>
              <Button variant="outline" onClick={stop} disabled={!isPlaying}>
                Stop
              </Button>
              <Button onClick={toggleLoop}>Toggle Loop</Button>
              <Slider
                value={[tempo]}
                min={0.5}
                max={1.0}
                step={0.01}
                onValueChange={([v]) => setTempo(v)}
                className="flex-1"
                aria-label="tempo"
              />
              <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {tempo.toFixed(2)}×
              </span>
            </div>
            <Playhead
              duration={duration}
              getPlayhead={getPlayhead}
              onSeek={seek}
              loop={loop}
              setLoop={setLoop}
            />
            <TrackList
              tracks={tracks}
              onSelect={(track) => handleTrackClick(track)}
            />

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
                Click "Choose file" to begin.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default App;
