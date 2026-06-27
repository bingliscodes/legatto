import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type StemControlProps = {
  name: string;
  volume: number; // 0–100
  muted: boolean;
  soloed: boolean; // is THIS stem the soloed one?
  onVolumeChange: (value: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
};

// Presentational only: renders one stem's controls and calls the callbacks.
// No state, no audio — all of that lives in useAudioPlayer.
export function StemControl({
  name,
  volume,
  muted,
  soloed,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
}: StemControlProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <span className="w-16 shrink-0 text-sm font-medium capitalize">
        {name}
      </span>

      <div className="flex shrink-0 gap-1">
        <Button
          variant={muted ? "default" : "outline"}
          size="sm"
          className="w-9 font-semibold"
          aria-pressed={muted}
          onClick={onMuteToggle}
          title="Mute"
        >
          M
        </Button>
        <Button
          variant={soloed ? "default" : "outline"}
          size="sm"
          className="w-9 font-semibold"
          aria-pressed={soloed}
          onClick={onSoloToggle}
          title="Solo"
        >
          S
        </Button>
      </div>

      <Slider
        value={[volume]}
        max={100}
        step={1}
        onValueChange={([v]) => onVolumeChange(v)}
        aria-label={`${name} volume`}
        className="flex-1"
      />

      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {volume}
      </span>
    </div>
  );
}
