import { useState, useEffect } from "react";

export function usePlayhead(getPlayhead: () => number): number {
  const [playheadPosition, setPlayheadPosition] = useState(0);
  useEffect(() => {
    let frameId: number;
    const tick = () => {
      setPlayheadPosition(getPlayhead());
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return playheadPosition;
}
