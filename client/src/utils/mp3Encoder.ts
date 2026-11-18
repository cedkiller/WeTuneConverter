import * as lamejsModule from '@breezystack/lamejs';

// Polyfill MPEGMode on global scope as a failsafe against legacy lamejs internals
if (typeof globalThis !== 'undefined') {
  function MPEGModePolyfill(this: any, ordinal: number) {
    this.ordinal = function () {
      return ordinal;
    };
  }
  (MPEGModePolyfill as any).STEREO = new (MPEGModePolyfill as any)(0);
  (MPEGModePolyfill as any).JOINT_STEREO = new (MPEGModePolyfill as any)(1);
  (MPEGModePolyfill as any).DUAL_CHANNEL = new (MPEGModePolyfill as any)(2);
  (MPEGModePolyfill as any).MONO = new (MPEGModePolyfill as any)(3);
  (MPEGModePolyfill as any).NOT_SET = new (MPEGModePolyfill as any)(4);

  (globalThis as any).MPEGMode = (globalThis as any).MPEGMode || MPEGModePolyfill;
  if (typeof window !== 'undefined') {
    (window as any).MPEGMode = (window as any).MPEGMode || MPEGModePolyfill;
  }
}

// Resolve Mp3Encoder constructor cleanly across ESM / CJS bundlers
const Mp3Encoder =
  (lamejsModule as any).Mp3Encoder ||
  ((lamejsModule as any).default && (lamejsModule as any).default.Mp3Encoder) ||
  (lamejsModule as any);

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

export async function decodeAudioFromFile(file: File | Blob): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } finally {
    if (audioContext.state !== 'closed') {
      audioContext.close();
    }
  }
}

export async function encodeAudioBufferToMp3(
  audioBuffer: AudioBuffer,
  bitrate: number = 320,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const kbps = bitrate || 320;

  const mp3encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const leftSource = audioBuffer.getChannelData(0);
  const rightSource = channels > 1 ? audioBuffer.getChannelData(1) : leftSource;

  const leftPcm = floatTo16BitPCM(leftSource);
  const rightPcm = channels > 1 ? floatTo16BitPCM(rightSource) : leftPcm;

  const sampleBlockSize = 11520; // 10 MPEG frames for batching
  const mp3Data: Uint8Array[] = [];
  const totalSamples = leftPcm.length;

  for (let i = 0; i < totalSamples; i += sampleBlockSize) {
    const end = Math.min(i + sampleBlockSize, totalSamples);
    const leftChunk = leftPcm.subarray(i, end);
    const rightChunk = channels > 1 ? rightPcm.subarray(i, end) : leftChunk;

    const mp3buf = channels === 1
      ? mp3encoder.encodeBuffer(leftChunk)
      : mp3encoder.encodeBuffer(leftChunk, rightChunk);

    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    if (onProgress) {
      const percent = Math.min(99, Math.round((end / totalSamples) * 100));
      onProgress(percent);
    }

    // Yield to the event loop every 10 blocks so the UI remains smooth
    if ((i / sampleBlockSize) % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf));
  }

  if (onProgress) {
    onProgress(100);
  }

  // Calculate total length and merge buffers
  let totalLength = 0;
  for (const chunk of mp3Data) {
    totalLength += chunk.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}
