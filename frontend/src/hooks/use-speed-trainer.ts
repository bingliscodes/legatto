import { useState } from "react";

export function useSpeedTrainer() {
  const [startTempo, setStartTempo] = useState<number>(50);
  const [endTempo, setEndTempo] = useState<number>(100);
  const [step, setStep] = useState<number>(5);
  const [reps, setReps] = useState<number>(3);

  const validate = (): string | null => {
    if (startTempo < 0.5 || endTempo > 1.0 || endTempo <= startTempo) {
      return "Invalid inputs to speed trainer. Please ensure that both tempo values are between 0.5 and 1 and starting tempo is less than ending tempo";
    }
    if (step <= 0 || reps < 1) {
      return "Invalid inputs to speed trainer. Please ensure that step % and # of reps are valid.";
    }
    return null;
  };

  const buildLadder = (): number[] => {
    const tempoLadder: number[] = [];

    let currentTempo: number = startTempo;

    while (currentTempo < endTempo) {
      tempoLadder.push(+(currentTempo / 100).toFixed(3));
      currentTempo += step;
    }
    if (tempoLadder.at(-1) !== +(endTempo / 100).toFixed(3))
      tempoLadder.push(+(endTempo / 100).toFixed(3));
    return tempoLadder;
  };

  return {
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
  };
}
