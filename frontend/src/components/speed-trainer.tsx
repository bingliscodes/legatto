import { useState } from "react";
import { useSpeedTrainer } from "@/hooks/use-speed-trainer";
import { Button } from "./ui/button";

type useSpeedTrainerProps = {
  onStart: (ladder: number[], reps: number) => void;
  loopActive: boolean;
};
export default function SpeedTrainer({
  onStart,
  loopActive,
}: useSpeedTrainerProps) {
  const {
    reps,
    setStartTempo,
    setEndTempo,
    setReps,
    setStep,
    validate,
    buildLadder,
  } = useSpeedTrainer();

  const [error, setError] = useState<string | null>(null);

  const onClickStart = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    onStart(buildLadder(), reps);
  };
  return (
    { loopActive } && (
      <>
        <Button onClick={onClickStart}>Start Speed Trainer</Button>
        <input
          type="number"
          min={0.5}
          max={1.0}
          placeholder="Starting Tempo"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setStartTempo(Number(e.target.value))
          }
        />
        <input
          type="number"
          min={0.5}
          max={1.0}
          placeholder="Ending Tempo"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEndTempo(Number(e.target.value))
          }
        />
        <input
          type="number"
          min={1}
          max={99}
          placeholder="Step %"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setStep(Number(e.target.value))
          }
        />
        <input
          type="number"
          min={1}
          max={10}
          placeholder="# of repetitions"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setReps(Number(e.target.value))
          }
        />
      </>
    )
  );
}
