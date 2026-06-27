import { useRef, useState, useEffect } from "react";

// stem name -> URL, matching the `stems` dict returned by GET /jobs/{id}
type Stems = Record<string, string>;
type StemUI = { volume: number; muted: boolean };

export function useAudioPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [stemState, setStemState] = useState<Record<string, StemUI>>({});
  const [soloed, setSoloed] = useState<string | null>(null);

  // Decoded audio + the persistent per-stem gain nodes. These are refs, not
  // state: they're mutable audio objects that must survive re-renders and
  // must NOT trigger one when they change.
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
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
    buffersRef.current.clear();
    gainsRef.current.clear();

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
  }

  // ── Synchronized playback ──
  function play() {
    const ctx = getContext();
    stop();

    const when = ctx.currentTime + 0.1; // ONE shared start time → sample-accurate sync
    const sources: AudioBufferSourceNode[] = [];

    for (const [name, buffer] of buffersRef.current) {
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

  // ── Per-stem volume (mute = set to 0; solo = others to 0) ──
  function setStemGain(name: string, value: number) {
    const gain = gainsRef.current.get(name);
    if (gain) gain.gain.value = value;
  }

  // UI Controls
  useEffect(() => {
    for (const [name, ui] of Object.entries(stemState)) {
      const effective = ui.muted
        ? 0
        : soloed && soloed !== name
          ? 0
          : ui.volume / 100;
      setStemGain(name, effective);
    }
  });

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

  // close the context when the component using this hook unmounts
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  return {
    load,
    play,
    stop,
    setStemGain,
    mute,
    toggleMute,
    setVolume,
    toggleSolo,
    stemState,
    isPlaying,
  };
}
