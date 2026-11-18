/**
 * Synthesizes a high quality musical audio track in-memory using Web Audio API.
 * This guarantees a working audio source for testing 320kbps MP3 conversion,
 * ID3 metadata tagging, album art embedding, and playback.
 */
export async function createSynthesizedMusicAudio(
  type: 'synthwave' | 'lofi' | 'ambient' = 'synthwave',
  durationSeconds: number = 18
): Promise<AudioBuffer> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const sampleRate = 44100;
  const audioContext = new AudioContextClass();
  const numberOfChannels = 2;
  const totalSamples = Math.floor(sampleRate * durationSeconds);

  const audioBuffer = audioContext.createBuffer(numberOfChannels, totalSamples, sampleRate);
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);

  // Musical chord progressions and scales (in Hz)
  const chords = type === 'synthwave'
    ? [
        [220.0, 261.63, 329.63, 440.0], // Am
        [174.61, 220.0, 261.63, 349.23], // F
        [196.0, 246.94, 293.66, 392.0], // G
        [164.81, 196.0, 246.94, 329.63] // Em
      ]
    : [
        [261.63, 329.63, 392.0, 493.88], // Cmaj7
        [220.0, 261.63, 329.63, 392.0],  // Am7
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [196.0, 246.94, 293.66, 349.23]  // G7
      ];

  const bpm = type === 'synthwave' ? 120 : 85;
  const beatDuration = 60 / bpm;
  const measureDuration = beatDuration * 4;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const currentChordIndex = Math.floor((t % (measureDuration * 4)) / measureDuration);
    const chord = chords[currentChordIndex % chords.length];

    // Bass note (sub-oscillator)
    const bassFreq = chord[0] / 2;
    const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.25;

    // Pad chords with subtle detune for stereo warmth
    let padL = 0;
    let padR = 0;
    for (let f = 0; f < chord.length; f++) {
      const freq = chord[f];
      padL += Math.sin(2 * Math.PI * freq * t) * 0.08;
      padR += Math.sin(2 * Math.PI * (freq * 1.004) * t) * 0.08;
    }

    // Arpeggiated melody line
    const beatPos = (t % beatDuration) / beatDuration;
    const arpStep = Math.floor((t / (beatDuration / 2)) % 4);
    const melodyFreq = chord[arpStep] * 2;
    const pluckEnvelope = Math.exp(-beatPos * 6);
    const melody = Math.sin(2 * Math.PI * melodyFreq * t) * pluckEnvelope * 0.18;

    // Subtle rhythmic kick & snare transient simulation
    const beatIndex = Math.floor((t / beatDuration) % 4);
    let drum = 0;
    if (beatIndex === 0 || beatIndex === 2) {
      // Kick on 1 and 3
      const kickT = (t % beatDuration);
      if (kickT < 0.12) {
        const kickFreq = 140 * Math.exp(-kickT * 40) + 40;
        drum += Math.sin(2 * Math.PI * kickFreq * kickT) * Math.exp(-kickT * 25) * 0.35;
      }
    } else {
      // Snare on 2 and 4
      const snareT = (t % beatDuration);
      if (snareT < 0.1) {
        drum += (Math.random() * 2 - 1) * Math.exp(-snareT * 30) * 0.18;
      }
    }

    // Fade in at start and fade out at end
    let masterEnv = 1;
    if (t < 0.5) masterEnv = t / 0.5;
    if (t > durationSeconds - 1.0) masterEnv = (durationSeconds - t) / 1.0;

    left[i] = Math.max(-1, Math.min(1, (padL + bass + melody * 0.8 + drum) * masterEnv * 0.85));
    right[i] = Math.max(-1, Math.min(1, (padR + bass + melody * 0.7 + drum) * masterEnv * 0.85));
  }

  await audioContext.close();
  return audioBuffer;
}
