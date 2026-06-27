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
    await ctx.resume(); // in case it started suspended
    // TODO (yours): fetch(url) -> res.arrayBuffer() -> ctx.decodeAudioData(...)
    //   -> ctx.createBufferSource() -> .connect(ctx.destination) -> .start()
    //   -> setIsPlaying(true)
  }

  // close the context when the component unmounts
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  return { play, isPlaying };
}
