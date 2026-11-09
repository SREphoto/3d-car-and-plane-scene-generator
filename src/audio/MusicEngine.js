export class MusicEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'metadata';

    this.ctx = null;
    this.analyser = null;
    this.gainNode = null;
    this.streamDestination = null;
    this.freqData = new Uint8Array(64);

    this.isPlaying = false;
    this.volume = 0.8;
    this.beatSyncEnabled = true;
    this.prevBassEnergy = 0;

    this.onStateChange = null;
    this.onTrackEnded = null;

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this._emit();
    });
    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this._emit();
    });
    this.audio.addEventListener('timeupdate', () => this._emit());
    this.audio.addEventListener('loadedmetadata', () => this._emit());
    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this._emit();
      if (this.onTrackEnded) this.onTrackEnded();
    });
  }

  _ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    const source = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.78;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = this.volume;

    this.streamDestination = this.ctx.createMediaStreamDestination();

    source.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);
    this.gainNode.connect(this.streamDestination);
  }

  _emit() {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying: this.isPlaying,
        currentTime: this.audio.currentTime || 0,
        duration: this.audio.duration || 0,
        volume: this.volume,
      });
    }
  }

  async loadAndPlay(url, autoPlay = true) {
    try {
      this._ensureContext();
      this.audio.src = url;
      this.audio.load();
      if (autoPlay) {
        await this.audio.play();
      }
    } catch (err) {
      console.warn('Audio playback awaits user gesture:', err);
    }
  }

  async togglePlay() {
    this._ensureContext();
    if (this.audio.paused) {
      await this.audio.play();
    } else {
      this.audio.pause();
    }
  }

  seek(timeSec) {
    if (Number.isFinite(timeSec)) {
      this.audio.currentTime = timeSec;
      this._emit();
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    } else {
      this.audio.volume = this.volume;
    }
    this._emit();
  }

  getAudioStreamTrack() {
    this._ensureContext();
    if (!this.streamDestination) return null;
    const tracks = this.streamDestination.stream.getAudioTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  /**
   * Samples FFT spectrum and detects bass transients for Beat-Sync lighting & camera cuts
   */
  sampleAudioFrame() {
    if (!this.analyser || !this.isPlaying) {
      return { bars: this.freqData.fill(0), bassPulse: 0, isBeatHit: false };
    }
    this.analyser.getByteFrequencyData(this.freqData);

    // Compute bass energy from lowest 6 bins
    let bassSum = 0;
    for (let i = 0; i < 6; i++) {
      bassSum += this.freqData[i];
    }
    const bassNorm = bassSum / (6 * 255); // 0..1
    const delta = bassNorm - this.prevBassEnergy;
    const isBeatHit = this.beatSyncEnabled && bassNorm > 0.62 && delta > 0.11;
    this.prevBassEnergy = bassNorm * 0.75 + this.prevBassEnergy * 0.25;

    return {
      bars: this.freqData,
      bassPulse: this.beatSyncEnabled ? Math.pow(bassNorm, 1.5) : 0,
      isBeatHit,
    };
  }

  /**
   * Synthesizes a realistic low-frequency thunder clap when lightning strikes in Thunderstorm mode
   */
  playThunderRumble() {
    try {
      this._ensureContext();
      const duration = 2.6;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.exp(-i / (this.ctx.sampleRate * 0.75));
        data[i] = (Math.random() * 2 - 1) * env;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(145, this.ctx.currentTime);

      const thunderGain = this.ctx.createGain();
      thunderGain.gain.setValueAtTime(0.45 * this.volume, this.ctx.currentTime);
      thunderGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(thunderGain);
      thunderGain.connect(this.ctx.destination);
      if (this.streamDestination) {
        thunderGain.connect(this.streamDestination);
      }
      noise.start();
    } catch {
      // Ignore if AudioContext not yet unlocked
    }
  }
}
