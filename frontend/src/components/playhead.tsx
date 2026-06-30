import { useRef, useState } from "react";

import { usePlayhead } from "@/hooks/use-playhead";
import { cn } from "@/lib/utils";
import { type Loop } from "@/hooks/use-audio-player";

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
  setLoop: React.Dispatch<React.SetStateAction<Loop>>;
}) {
  const [drag, setDrag] = useState<{
    edge: "start" | "end";
    time: number;
  } | null>(null);

  const position = usePlayhead(getPlayhead);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);

  const loopStart = drag?.edge === "start" ? drag.time : loop.start;
  const loopEnd = drag?.edge === "end" ? drag.time : loop.end;
  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const startPct = duration > 0 ? (loopStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (loopEnd / duration) * 100 : 0;

  function clientXToTime(clientX: number) {
    const rect = trackRef.current!.getBoundingClientRect();
    const fraction = Math.min(
      Math.max((clientX - rect.left) / rect.width, 0),
      1,
    );
    return fraction * duration;
  }

  function startDrag(edge: "start" | "end") {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      draggedRef.current = true;
      function edgeTime(clientX: number) {
        const t = clientXToTime(clientX);
        return edge === "start" ? Math.min(t, loopEnd) : Math.max(t, loopStart);
      }
      function onMove(ev: MouseEvent) {
        setDrag({ edge, time: edgeTime(ev.clientX) });
      }
      function onUp(ev: MouseEvent) {
        setLoop((l) => ({ ...l, [edge]: edgeTime(ev.clientX) }));
        setDrag(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onSeek(clientXToTime(e.clientX));
  }

  return (
    <div
      ref={trackRef}
      className="relative h-8 w-full rounded bg-muted"
      onClick={handleClick}
    >
      {duration > 0 && loop.end > loop.start && (
        <div
          className={cn(
            "absolute top-0 h-full",
            loop.active
              ? "bg-primary/30 border border-primary" // engaged: brighter + framed
              : "bg-primary/10", // armed: faint, no border
          )}
          style={{
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
          }}
        />
      )}
      {loop.active && (
        <div
          className="absolute top-0 h-full w-2 -translate-x-1/2 bg-primary cursor-grab"
          style={{ left: `${startPct}%` }}
          onMouseDown={startDrag("start")}
        />
      )}
      {loop.active && (
        <div
          className="absolute top-0 h-full w-2 -translate-x-1/2 bg-primary cursor-grab"
          style={{ left: `${endPct}%` }}
          onMouseDown={startDrag("end")}
        />
      )}
      <div
        className="absolute top-0 h-full w-0.5 bg-primary"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
