import { usePlayhead } from "@/hooks/use-playhead";

export default function Playhead({
  getPlayhead,
  duration,
  onSeek,
}: {
  getPlayhead: () => number;
  duration: number;
  onSeek: (target: number) => void;
}) {
  const position = usePlayhead(getPlayhead);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    onSeek(fraction * duration);
  }
  const pct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="relative h-8 w-full rounded bg-muted" onClick={handleClick}>
      <div
        className="absolute top-0 h-full w-0.5 bg-primary"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
