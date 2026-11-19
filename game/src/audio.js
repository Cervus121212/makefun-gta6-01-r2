// All sound is synthesized with Web Audio — no audio files, no network.
// The siren follows the nearest police unit (wired in main.js every frame),
// and the radio keeps playing across mission transitions.
import { RADIO } from './config.js';
export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    this.radioStation = 0; this.radioTimer = null; this.radioStep = 0;
    this.engineOsc = null; this.engineGain = null; this.sirenNodes = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Engine hum: two detuned saws through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 50;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  setEngine(speed01, on) {
    if (!this.ctx) return;
    this.engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, this.ctx.currentTime, 0.08);
    // Idle hum stays quiet; the engine only speaks up with speed.
    this.engineGain.gain.setTargetAtTime(on ? 0.03 + speed01 * 0.07 : 0, this.ctx.currentTime, 0.1);
  }
  blip(freq, dur, type = 'square', vol = 0.12) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  noise(dur, vol = 0.25, freq = 1200) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
  gunshot() { this.noise(0.16, 0.4, 900); this.blip(90, 0.1, 'square', 0.2); }
  pickup() { this.blip(660, 0.09); setTimeout(() => this.blip(880, 0.12), 90); }
  missionPass() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.16), i * 120)); }
  busted() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.14), i * 180)); }
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenNodes) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 700;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.6;
      const lg = this.ctx.createGain(); lg.gain.value = 250;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.value = 0.045; o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.sirenNodes = { o, lfo, g };
    } else if (!on && this.sirenNodes) {
      try { this.sirenNodes.o.stop(); this.sirenNodes.lfo.stop(); } catch (_) {}
      this.sirenNodes = null;
    }
  }
  // Siren loudness follows the nearest cruiser: close = urgent, far = a distant
  // wail under the radio. Call every frame; pass null/0 distance when clear.
  setSiren(on, nearestDist) {
    this.siren(on);
    if (!this.sirenNodes || !this.ctx) return;
    const d = nearestDist == null ? 120 : nearestDist;
    // Full volume inside ~15m, fading to a whisper by ~120m.
    const vol = on ? Math.max(0.008, 0.06 * (1 - Math.min(1, d / 120))) : 0;
    this.sirenNodes.g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.25);
  }
  setRadio(station) {
    this.radioStation = station;
    if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
    const st = RADIO[station];
    if (!st || !st.bpm || !this.ctx) return;
    this.radioStep = 0;
    const stepMs = 60000 / st.bpm / 2;
    this.radioTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const scale = st.scale, idx = this.radioStep % 16;
      const deg = scale[Math.floor(this.radioStep / 2) % scale.length] + (idx % 4 === 0 ? 12 : 0);
      const f = st.root * Math.pow(2, deg / 12) * (this.radioStep % 8 === 6 ? 0.5 : 1);
      this.blip(f, 0.16, 'triangle', 0.05);
      if (idx % 4 === 0) { this.blip(f / 2, 0.3, 'sine', 0.07); this.blip(55, 0.12, 'sine', 0.1); }
      this.radioStep++;
    }, stepMs);
  }
  // (Re)start the current station — needed when the AudioContext is created
  // after the first setRadio call (e.g. the title-screen Start button).
  resumeRadio() { if (this.ctx && RADIO[this.radioStation] && RADIO[this.radioStation].bpm) this.setRadio(this.radioStation); }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
