import { usePlayhead } from "@/hooks/use-playhead";

function Playhead({
  getPlayhead,
  duration,
}: {
  getPlayhead: () => number;
  duration: number;
}) {
  const position = usePlayhead(getPlayhead);
  // TODO: convert position (seconds) → a percent across the bar, render the cursor
}
