import { useRef, useState, useEffect } from "react";
import axios from "axios";

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
    // Make call for resource
    const audio_file = await axios.get(url);
    const arrayBuffer = audio_file.arrayBuffer();
    ctx.decodeAudioData(arrayBuffer);

    const source = ctx.createBufferSource();
    source.buffer = arrayBuffer;
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
