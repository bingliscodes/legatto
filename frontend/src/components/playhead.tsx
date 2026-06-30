import { usePlayhead } from "@/hooks/use-playhead";

export default function Playhead({
  getPlayhead,
  duration,
  onSeek,
  loop,
}: {
  getPlayhead: () => number;
  duration: number;
  onSeek: (target: number) => void;
  loop: { active: boolean; start: number; end: number };
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
      {loop.active && (
        <div
          className="absolute h-full bg-primary/20"
          style={{
            left: `${(loop.start / duration) * 100}%`,
            width: `${((loop.end - loop.start) / duration) * 100}%`,
          }}
        />
      )}
      <div
        className="absolute top-0 h-full w-0.5 bg-primary"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
