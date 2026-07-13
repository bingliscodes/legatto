import { useState } from "react";

export function useSpeedTrainer() {
  const [startTempo, setStartTempo] = useState<number>(0.5);
  const [endTempo, setEndTempo] = useState<number>(1.0);
  const [step, setStep] = useState<number>(0.05);
  const [reps, setReps] = useState<number>(3);

  const onStartTempoChange = (e) => {
    const newValue = Number(e.target.value);
    if (newValue >= 0.5) setStartTempo(newValue);
  };

  const onEndTempoChange = (e) => {
    const newValue = Number(e.target.value);
    if (newValue <= 1.0) setEndTempo(newValue);
  };

  const buildLadder = (): number[] => {
    const tempoLadder: number[] = [];

    let currentTempo = startTempo;

    while (currentTempo <= endTempo) {
      tempoLadder.push(currentTempo);
      currentTempo += step;
    }

    tempoLadder.push(endTempo);
    return tempoLadder;
  };

  return {
    startTempo,
    endTempo,
    step,
    reps,
    onStartTempoChange,
    onEndTempoChange,
    setStep,
    setReps,
    buildLadder,
  };
}
