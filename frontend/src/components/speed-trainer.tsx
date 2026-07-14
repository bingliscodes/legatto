import { useState, type ComponentProps } from "react";
import { useSpeedTrainer } from "@/hooks/use-speed-trainer";
import { Button } from "./ui/button";

type SpeedTrainerProps = {
  onStart: (ladder: number[], reps: number) => void;
  loopActive: boolean;
};

// A labelled number input styled to match the other shadcn controls.
function NumberField({
  label,
  ...props
}: { label: string } & ComponentProps<"input">) {
  return (
    <label className="flex min-w-24 flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        {...props}
      />
    </label>
  );
}

export default function SpeedTrainer({
  onStart,
  loopActive,
}: SpeedTrainerProps) {
  const {
    startTempo,
    endTempo,
    step,
    reps,
    setStartTempo,
    setEndTempo,
    setStep,
    setReps,
    validate,
    buildLadder,
  } = useSpeedTrainer();

  const [error, setError] = useState<string | null>(null);

  // Gate: the trainer reps over the A–B loop, so it's only usable with a loop.
  if (!loopActive) return null;

  const onClickStart = () => {
    const err = validate();
    setError(err); // null clears any previous message
    if (err) return;
    onStart(buildLadder(), reps);
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-medium">Speed trainer</h3>
        <p className="text-xs text-muted-foreground">
          Loops the A–B section and steps the tempo up to your target.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <NumberField
          label="Start tempo %"
          min={50}
          max={100}
          step={5}
          value={startTempo}
          onChange={(e) => setStartTempo(Number(e.target.value))}
        />
        <NumberField
          label="End tempo %"
          min={50}
          max={100}
          step={5}
          value={endTempo}
          onChange={(e) => setEndTempo(Number(e.target.value))}
        />
        <NumberField
          label="Step %"
          min={1}
          max={99}
          step={1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
        />
        <NumberField
          label="Reps"
          min={1}
          max={10}
          step={1}
          value={reps}
          onChange={(e) => setReps(Number(e.target.value))}
        />
        <Button onClick={onClickStart} className="shrink-0">
          Start
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
