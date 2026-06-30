import { useRef } from "react";

import { usePlayhead } from "@/hooks/use-playhead";
import { cn } from "@/lib/utils";

export default function Playhead({
  getPlayhead,
  duration,
  onSeek,
  loop,
  setLoop,
}: {
  getPlayhead: () => number;
  duration: number;
  onSeek: (target: number) => void;
  loop: { active: boolean; start: number; end: number };
  setLoop: () => void;
}) {
  const position = usePlayhead(getPlayhead);
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const startPct = duration > 0 ? (loop.start / duration) * 100 : 0;
  const endPct = duration > 0 ? (loop.end / duration) * 100 : 0;

  function startDrag(edge: "start" | "end") {
    return (e: React.MouseEvent) => {
      e.stopPropagation();

      function onMove(ev: MouseEvent) {
        const rect = trackRef.current!.getBoundingClientRect();
        let fraction = (ev.clientX - rect.left) / rect.width;
        fraction = Math.min(Math.max(fraction, 0), 1); // clamp to [0,1] (stay on the track)
        setLoop((l) => ({ ...l, [edge]: fraction * duration })); // move just this one edge
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    onSeek(fraction * duration);
  }

  return (
    <div className="relative h-8 w-full rounded bg-muted" onClick={handleClick}>
      {duration > 0 && loop.end > loop.start && (
        <div
          className={cn(
            "absolute top-0 h-full",
            loop.active
              ? "bg-primary/30 border border-primary" // engaged: brighter + framed
              : "bg-primary/10", // armed: faint, no border
          )}
          style={{
            left: `${(loop.start / duration) * 100}%`,
            width: `${((loop.end - loop.start) / duration) * 100}%`,
          }}
        />
      )}
      <div
        className="absolute top-0 h-full w-0.75 bg-primary cursor-grab"
        style={{ left: `${startPct}%` }}
        onMouseDown={beginSelection}
        onMouseUp={endSelection}
      />
      <div
        className="absolute top-0 h-full w-0.75 bg-primary cursor-grab"
        style={{ left: `${endPct}%` }}
      />
      <div
        className="absolute top-0 h-full w-0.5 bg-primary"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
