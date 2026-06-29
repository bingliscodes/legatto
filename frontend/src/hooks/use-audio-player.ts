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

  // Decoded audio + the persistent per-stem gain nodes. These are refs, not
  // state: they're mutable audio objects that must survive re-renders and
  // must NOT trigger one when they change.
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const playbackBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const gainsRef = useRef<Map<string, GainNode>>(new Map());
  // The sources for the CURRENT playback, kept so we can stop them.
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);

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
  function play() {
    const ctx = getContext();
    stop();

    const when = ctx.currentTime + 0.1; // ONE shared start time → sample-accurate sync
    const sources: AudioBufferSourceNode[] = [];

    for (const [name, buffer] of playbackBuffersRef.current) {
      const gain = gainsRef.current.get(name);
      if (!gain) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.start(when);
      sources.push(source);
    }

    sourcesRef.current = sources;
    setIsPlaying(true);
  }

  function stop() {
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped — fine */
      }
    });
    sourcesRef.current = [];
    setIsPlaying(false);
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
    }, 300);

    return () => clearTimeout(timeout);
  }, [tempo]);

  // Release the AudioContext on unmount
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  return {
    load,
    play,
    stop,
    toggleMute,
    setVolume,
    toggleSolo,
    tempo,
    setTempo,
    stemState,
    soloed,
    isPlaying,
  };
}
