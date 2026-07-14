import { useRef, useState, useEffect } from "react";
import { stretchBuffer } from "@/lib/stretch";

// stem name -> URL, matching the `stems` dict returned by GET /tracks/{id}
type Stems = Record<string, string>;
type StemUI = { volume: number; muted: boolean };
export type Loop = { active: boolean; start: number; end: number };

export function useAudioPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [stemState, setStemState] = useState<Record<string, StemUI>>({});
  const [soloed, setSoloed] = useState<string | null>(null);
  const [tempo, setTempo] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState<Loop>({ active: false, start: 0, end: 0 });
  const [isTraining, setIsTraining] = useState(false);

  // Decoded audio + the persistent per-stem gain nodes. These are refs, not
  // state: they're mutable audio objects that must survive re-renders and
  // must NOT trigger one when they change.
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const durationRef = useRef<number>(0);
  const playbackBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const gainsRef = useRef<Map<string, GainNode>>(new Map());
  const startCtxTimeRef = useRef<number>(0);

  const startOffsetRef = useRef<number>(0); // the song-timeline position (original seconds) where the current playback segment began
  const playbackTempoRef = useRef<number>(1.0);
  // The region the LIVE sources are actually looping under — snapshotted in play(),
  // NOT the latest UI selection (that's loopRef). currentPlayhead() wraps with this
  // so "where am I?" reflects what's sounding, not what was just dialed in.
  // (Same split as playbackTempoRef vs tempo.) Init to `loop` so it has the right shape.
  const playbackLoopRef = useRef(loop);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const loopRef = useRef(loop);

  const trainerTimeoutRef = useRef<number | null>(null);

  // Keep loop refs in sync with loop state
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // The sources for the CURRENT playback, kept so we can stop them.
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  function getContext() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  // ── Decode every stem ONCE, and build one gain node per stem ──
  async function load(stems: Stems) {
    const ctx = getContext();
    stop();
    buffersRef.current.clear();
    gainsRef.current.clear();
    setTempo(1);

    await Promise.all(
      Object.entries(stems).map(async ([name, url]) => {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        buffersRef.current.set(name, audioBuffer);

        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gainsRef.current.set(name, gain);
      }),
    );

    durationRef.current =
      buffersRef.current.values().next().value?.duration ?? 0;

    const initial: Record<string, StemUI> = {};
    for (const name of Object.keys(stems))
      initial[name] = { volume: 100, muted: false };
    setStemState(initial);
    playbackBuffersRef.current = new Map(buffersRef.current);
  }

  // ── Synchronized playback ──
  const currentPlayhead = (): number => {
    /* Gets the position in the original un-stretched song timeline */

    if (!isPlayingRef.current) return startOffsetRef.current;

    const ctx = getContext();
    const rawPosition =
      startOffsetRef.current +
      (ctx.currentTime - startCtxTimeRef.current) * playbackTempoRef.current;
    // Wrap with what's SOUNDING (playbackLoopRef), not the latest selection (loopRef):
    // on a mid-loop change the sync effect updates loopRef before we capture here, so
    // using it would lose the real position (e.g. toggling loop off would jump forward).
    const { active, start: A, end: B } = playbackLoopRef.current;
    if (!active || B <= A) return rawPosition; // Guard against no loop or invalid playback position
    const loopLength = B - A;
    return A + ((rawPosition - A) % loopLength);
  };

  const restartFromCurrentPosition = (): void => {
    // Captures the current position and resumes playback in place.
    startOffsetRef.current = currentPlayhead();
    play();
  };

  function startSources(
    buffers: Map<string, AudioBuffer>,
    startOffset: number,
    loop: Loop,
    when: number = getContext().currentTime + 0.1,
  ): { when: number; tempo: number } {
    const ctx = getContext();
    // Stop the OLD sources exactly when the new ones begin — no gap, no overlap.
    pause_playback(when);

    const tempo = durationRef.current / buffers.values().next().value!.duration;

    const { active, start, end } = loop;
    startCtxTimeRef.current = when;
    const sources: AudioBufferSourceNode[] = [];

    for (const [name, buffer] of buffers) {
      const gain = gainsRef.current.get(name);
      if (!gain) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      // seconds into the stretched buffer = currentPlayhead() / tempo
      if (active) {
        source.loop = true;
        source.loopStart = start / tempo;
        source.loopEnd = end / tempo;
      }
      source.onended = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
      };
      source.start(when, startOffset / tempo);
      sources.push(source);
    }

    sourcesRef.current = sources;
    setIsPlaying(true);
    isPlayingRef.current = true;
    playbackTempoRef.current = tempo;
    startOffsetRef.current = startOffset;
    playbackBuffersRef.current = new Map(buffers);
    // Snapshot the region these sources were started with — now "what's sounding".
    playbackLoopRef.current = { active, start, end };

    return { when, tempo };
  }
  function play(clamp = true) {
    const { active, start: A, end: B } = loopRef.current;

    if (
      clamp &&
      active &&
      (startOffsetRef.current < A || startOffsetRef.current >= B)
    ) {
      startOffsetRef.current = A;
    }

    const shouldLoop =
      active && startOffsetRef.current >= A && startOffsetRef.current < B;

    startSources(playbackBuffersRef.current, startOffsetRef.current, {
      active: shouldLoop,
      start: A,
      end: B,
    });
  }

  function startTrainer(ladder: number[], reps: number) {
    clearTrainerTimer();
    setIsTraining(true);
    let nextBuffers: Map<string, AudioBuffer> = new Map();
    const ctx = getContext();
    pause_playback();
    for (const [name, buffer] of buffersRef.current) {
      const currentBuffer = stretchBuffer(ctx, buffer, ladder[0]);
      nextBuffers.set(name, currentBuffer);
    }
    const { start: A, end: B } = loopRef.current;
    function playLevel(i: number, when?: number) {
      // Start this level. `when` is the exact audio-clock time to begin at:
      // undefined for level 0 (startSources uses "now + 0.1"), and the previous
      // level's rep-boundary for every level after. startSources hands back the
      // time it actually started and the tempo it derived from the buffers.
      const { when: startedAt, tempo } = startSources(
        nextBuffers,
        A,
        { active: true, start: A, end: B },
        when,
      );

      if (i + 1 < ladder.length) {
        // Render-ahead into a FRESH map so we never mutate the one now playing.
        nextBuffers = new Map();
        for (const [name, buffer] of buffersRef.current) {
          nextBuffers.set(name, stretchBuffer(ctx, buffer, ladder[i + 1]));
        }

        // The exact audio-clock time this level's reps finish. Uses the SAME
        // tempo the loop uses, so the timer can't drift from the audio.
        const boundary = startedAt + (reps * (B - A)) / tempo;

        // Wake up a little BEFORE the boundary to build the next level's
        // sources; they're scheduled to START exactly at `boundary`, so there's
        // no gap. The audio clock — not setTimeout — decides when audio starts.
        const lead = 0.1;
        const timeoutId = setTimeout(
          () => playLevel(i + 1, boundary),
          (boundary - lead - ctx.currentTime) * 1000,
        );
        trainerTimeoutRef.current = timeoutId;
      } else {
        const boundary = startedAt + (reps * (B - A)) / tempo;
        const finalTimeoutId = setTimeout(
          () => {
            setIsTraining(false);
          },
          (boundary - ctx.currentTime) * 1000,
        );
        trainerTimeoutRef.current = finalTimeoutId;
      }
    }

    playLevel(0);
  }

  const clearTrainerTimer = () => {
    if (trainerTimeoutRef.current !== null) {
      clearTimeout(trainerTimeoutRef.current);
      trainerTimeoutRef.current = null;
    }
  };

  function pause() {
    // Compute where to start in stretched buffer as offset = playhead / tempo
    if (!isPlayingRef.current) return;

    const playhead = currentPlayhead();
    pause_playback();
    setIsPlaying(false);
    isPlayingRef.current = false;

    // Store the position in original timeline for resuming.
    startOffsetRef.current = playhead;
  }

  function stop() {
    clearTrainerTimer();
    pause_playback();
    startOffsetRef.current = 0;
    sourcesRef.current = [];
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsTraining(false);
  }

  function pause_playback(when?: number) {
    sourcesRef.current.forEach((s) => {
      s.onended = null;
      try {
        if (when === undefined) s.stop();
        else s.stop(when);
      } catch {
        /* already stopped — fine */
      }
    });
  }
  // ── Sync the audio graph to state ──
  // The gains are a projection of stemState/soloed: whenever either changes,
  // recompute every stem's effective gain and apply it. Handlers stay pure.
  useEffect(() => {
    for (const [name, ui] of Object.entries(stemState)) {
      const gain = gainsRef.current.get(name);
      if (!gain) continue;
      gain.gain.value = ui.muted
        ? 0
        : soloed && soloed !== name
          ? 0
          : (ui.volume / 100) ** 2;
    }
  }, [stemState, soloed]);

  function setVolume(name: string, volume: number) {
    setStemState((p) => ({ ...p, [name]: { ...p[name], volume } }));
  }
  function toggleMute(name: string) {
    setStemState((p) => ({
      ...p,
      [name]: { ...p[name], muted: !p[name].muted },
    }));
  }
  function toggleSolo(name: string) {
    setSoloed((prev) => (prev === name ? null : name)); // click again to un-solo
  }

  // –– Set playback to position clicked ––
  function seek(target: number) {
    startOffsetRef.current = target;
    if (isPlayingRef.current) play(false);
  }

  const toggleLoop = () => {
    setLoop((l) =>
      l.active
        ? { ...l, active: false }
        : l.end > l.start
          ? { ...l, active: true }
          : { active: true, start: 0, end: durationRef.current },
    );
  };

  // –– Set the playback buffers based on tempo ––
  useEffect(() => {
    const timeout = setTimeout(() => {
      const ctx = getContext();
      if (tempo === 1) {
        playbackBuffersRef.current = new Map(buffersRef.current);
      } else {
        playbackBuffersRef.current.clear();
        for (const [name, buffer] of buffersRef.current) {
          const stretchedBuffer = stretchBuffer(ctx, buffer, tempo);
          playbackBuffersRef.current.set(name, stretchedBuffer);
        }
      }
      if (isPlayingRef.current) {
        restartFromCurrentPosition();
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [tempo]);

  // –– Updating loop restarts audio from correct position
  useEffect(() => {
    if (isPlayingRef.current) {
      restartFromCurrentPosition();
    }
  }, [loop]);

  // Release the AudioContext on unmount
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  return {
    load,
    play,
    pause,
    stop,
    toggleMute,
    setVolume,
    toggleSolo,
    tempo,
    setTempo,
    stemState,
    soloed,
    isPlaying,
    loop,
    setLoop,
    seek,
    duration: durationRef.current,
    getPlayhead: currentPlayhead,
    toggleLoop,
    startTrainer,
    isTraining,
    stopTrainer,
  };
}
