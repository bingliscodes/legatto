import { useRef, useState, useEffect } from "react";

export function useAudioPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // one context, created lazily on first use, reused after
  function getContext() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  async function play(url: string) {
    const ctx = getContext();
    await ctx.resume();

    const res = await fetch(url); // 1. download
    const arrayBuffer = await res.arrayBuffer(); // 2. get raw encoded bytes
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer); // 3. decode to AudioBuffer

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer; // Set buffer to the decoded value, not the raw bytes
    source.connect(ctx.destination);
    source.start();
    setIsPlaying(true);
  }

  // close the context when the component unmounts
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  return { play, isPlaying };
}
