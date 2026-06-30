import { usePlayhead } from "@/hooks/use-playhead";

export default function Playhead({
  getPlayhead,
  duration,
}: {
  getPlayhead: () => number;
  duration: number;
}) {
  const position = usePlayhead(getPlayhead);

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="relative h-8 w-full rounded bg-muted">
      <div
        className="absolute top-0 h-full w-0.5 bg-primary"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
