import { useRef, useState, useEffect } from "react";
import { stretchBuffer } from "@/lib/stretch";

// stem name -> URL, matching the `stems` dict returned by GET /jobs/{id}
type Stems = Record<string, string>;
type StemUI = { volume: number; muted: boolean };

export function useAudioPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [stemState, setStemState] = useState<Record<string, StemUI>>({});
  const [soloed, setSoloed] = useState<string | null>(null);
  const [tempo, setTempo] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState({ active: false, start: 0, end: 5 });

  // Decoded audio + the persistent per-stem gain nodes. These are refs, not
  // state: they're mutable audio objects that must survive re-renders and
  // must NOT trigger one when they change.
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const playbackBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const gainsRef = useRef<Map<string, GainNode>>(new Map());
  const startCtxTimeRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const playbackTempoRef = useRef<number>(1.0);
  // The region the LIVE sources are actually looping under — snapshotted in play(),
  // NOT the latest UI selection (that's loopRef). currentPlayhead() wraps with this
  // so "where am I?" reflects what's sounding, not what was just dialed in.
  // (Same split as playbackTempoRef vs tempo.) Init to `loop` so it has the right shape.
  const playbackLoopRef = useRef(loop);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const loopRef = useRef(loop);

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

  function play() {
    const ctx = getContext();
    pause_playback();

    const { active, start: A, end: B } = loopRef.current;
    if (active && (startOffsetRef.current < A || startOffsetRef.current >= B)) {
      startOffsetRef.current = A;
    }

    const when = ctx.currentTime + 0.1; // ONE shared start time → sample-accurate sync
    startCtxTimeRef.current = when;
    const sources: AudioBufferSourceNode[] = [];

    for (const [name, buffer] of playbackBuffersRef.current) {
      const gain = gainsRef.current.get(name);
      if (!gain) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      // seconds into the stretched buffer = currentPlayhead() / tempo
      if (active) {
        source.loop = true;
        source.loopStart = A / tempo;
        source.loopEnd = B / tempo;
      }
      source.start(when, startOffsetRef.current / tempo);
      sources.push(source);
    }

    sourcesRef.current = sources;
    setIsPlaying(true);
    isPlayingRef.current = true;
    playbackTempoRef.current = tempo;
    // Snapshot the region these sources were started with — now "what's sounding".
    playbackLoopRef.current = { active, start: A, end: B };
  }

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
    pause_playback();
    startOffsetRef.current = 0;
    sourcesRef.current = [];
    setIsPlaying(false);
    isPlayingRef.current = false;
  }

  function pause_playback() {
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
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
          : ui.volume / 100;
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
  };
}
