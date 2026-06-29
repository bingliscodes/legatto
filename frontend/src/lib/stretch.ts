import { SoundTouch, SimpleFilter, WebAudioBufferSource } from "soundtouchjs";

export function stretchBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  tempo: number,
): AudioBuffer {
  const soundtouch = new SoundTouch();
  soundtouch.tempo = tempo;

  const source = new WebAudioBufferSource(buffer);
  const filter = new SimpleFilter(source, soundtouch);

  const FRAME = 4096;
  const interleaved = new Float32Array(FRAME * 2);
  const left: number[] = [];
  const right: number[] = [];

  let extracted = filter.extract(interleaved, FRAME); // fills `interleaved`, returns # frames
  while (extracted > 0) {
    for (let i = 0; i < extracted; i++) {
      left.push(interleaved[i * 2]);
      right.push(interleaved[i * 2 + 1]);
    }
    extracted = filter.extract(interleaved, FRAME);
  }

  const out = ctx.createBuffer(2, left.length, buffer.sampleRate);
  out.copyToChannel(Float32Array.from(left), 0);
  out.copyToChannel(Float32Array.from(right), 1);
  return out;
}
