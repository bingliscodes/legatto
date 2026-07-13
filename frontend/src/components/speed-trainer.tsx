import { useSpeedTrainer } from "@/hooks/use-speed-trainer";
export default function SpeedTrainer() {
  const { setStartTempo, setEndTempo, setReps, setStep } = useSpeedTrainer();

  return (
    <>
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
  );
}
