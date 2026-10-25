// Web Audio API Synthesizer - 100% zero-asset, client-side synthesized sci-fi sound effects

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playTone(freq: number, type: OscillatorType, duration: number, delay: number = 0, gainLevel: number = 0.15) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainLevel, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // Sci-fi positive ascending chime
  public playPeerConnect() {
    if (!this.enabled) return;
    this.playTone(523.25, 'sine', 0.18, 0, 0.12); // C5
    this.playTone(659.25, 'sine', 0.18, 0.08, 0.14); // E5
    this.playTone(783.99, 'sine', 0.22, 0.16, 0.15); // G5
    this.playTone(1046.50, 'sine', 0.35, 0.24, 0.18); // C6
  }

  // Attention double ping for incoming file offer
  public playFileOffer() {
    if (!this.enabled) return;
    this.playTone(880, 'triangle', 0.15, 0, 0.2); // A5
    this.playTone(1174.66, 'sine', 0.3, 0.12, 0.22); // D6
  }

  // Celebratory chord on transfer completion
  public playTransferComplete() {
    if (!this.enabled) return;
    this.playTone(659.25, 'sine', 0.2, 0, 0.12); // E5
    this.playTone(830.61, 'sine', 0.2, 0.09, 0.14); // G#5
    this.playTone(987.77, 'sine', 0.2, 0.18, 0.16); // B5
    this.playTone(1318.51, 'sine', 0.45, 0.27, 0.2); // E6
  }

  // Crisp electronic blip for text snippet transmission
  public playSnippet() {
    if (!this.enabled) return;
    this.playTone(1200, 'sine', 0.08, 0, 0.12);
    this.playTone(1600, 'sine', 0.12, 0.05, 0.1);
  }

  // Soft descending tone when peer disconnects
  public playPeerDisconnect() {
    if (!this.enabled) return;
    this.playTone(783.99, 'sine', 0.18, 0, 0.12); // G5
    this.playTone(659.25, 'sine', 0.18, 0.09, 0.12); // E5
    this.playTone(523.25, 'sine', 0.3, 0.18, 0.1); // C5
  }

  // Descending buzz for error or failure
  public playError() {
    if (!this.enabled) return;
    this.playTone(320, 'sawtooth', 0.2, 0, 0.15);
    this.playTone(220, 'sawtooth', 0.25, 0.12, 0.15);
  }
}

export const sounds = new SoundEffectsEngine();
