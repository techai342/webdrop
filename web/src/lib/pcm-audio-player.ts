/**
 * Low-latency real-time PCM audio player & recorder using Web Audio API.
 * Seamlessly decodes and streams 16000Hz 16-bit Mono audio packets with jitter buffer.
 */
export class PcmAudioPlayer {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private nextPlayTime: number = 0;
  private recordedSamples: Float32Array[] = [];
  private isRecording: boolean = false;
  private isMuted: boolean = false;
  private volume: number = 1.0;

  constructor(private sampleRate: number = 16000) {}

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: this.sampleRate });
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
      this.gainNode.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(2, vol));
    if (this.gainNode && !this.isMuted) {
      this.gainNode.gain.value = this.volume;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : this.volume;
    }
  }

  public startRecording() {
    this.recordedSamples = [];
    this.isRecording = true;
  }

  public stopRecording(): Blob | null {
    this.isRecording = false;
    if (this.recordedSamples.length === 0) return null;

    let totalLength = 0;
    for (const chunk of this.recordedSamples) {
      totalLength += chunk.length;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.recordedSamples) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return this.encodeWav(merged, this.sampleRate);
  }

  public feedBase64Pcm(base64Data: string) {
    try {
      this.init();
      if (!this.ctx || !this.gainNode) return;

      const binaryStr = atob(base64Data);
      const byteLen = binaryStr.length;
      const numSamples = Math.floor(byteLen / 2);
      if (numSamples === 0) return;

      const audioBuffer = this.ctx.createBuffer(1, numSamples, this.sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < numSamples; i++) {
        const byteIndex = i * 2;
        const low = binaryStr.charCodeAt(byteIndex);
        const high = binaryStr.charCodeAt(byteIndex + 1);
        let int16 = (high << 8) | low;
        if (int16 >= 0x8000) int16 -= 0x10000;
        channelData[i] = int16 / 32768.0;
      }

      if (this.isRecording) {
        this.recordedSamples.push(new Float32Array(channelData));
      }

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);

      const currentTime = this.ctx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime + 0.05; // 50ms initial jitter safety
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
    } catch (err) {
      console.warn('[PCM Player] Feed error:', err);
    }
  }

  private encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  public close() {
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
      this.gainNode = null;
      this.nextPlayTime = 0;
      this.recordedSamples = [];
      this.isRecording = false;
    }
  }
}
