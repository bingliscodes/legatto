import { useState } from "react";

export function useSpeedTrainer() {
  const [startTempo, setStartTempo] = useState<number>(0.5);
  const [endTempo, setEndTempo] = useState<number>(1.0);
  const [step, setStep] = useState<number>(0.05);
  const [reps, setReps] = useState<number>(3);

  const validate = (): string | null => {
    if (endTempo <= startTempo) {
      return "Invalid inputs to speed trainer. Please ensure that starting tempo is less than ending tempo.";
    }
    if (step <= 0 || reps <= 1) {
      return "Invalid inputs to speed trainer. Please ensure that step % and # of reps are valid.";
    }
    return null;
  };

  const buildLadder = (): number[] => {
    const tempoLadder: number[] = [];

    let currentTempo: number = startTempo;

    while (currentTempo < endTempo) {
      tempoLadder.push(+currentTempo.toFixed(3));
      currentTempo += step / 100; // Convert to %;
    }

    tempoLadder.push(+endTempo.toFixed(3));
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
