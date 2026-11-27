"use client";
/**
 * Higround Run Club — Retro Pixel SFX & Procedural Lo-Fi Coffee Shop BGM (powered by Tone.js).
 * 100% browser-synthesized (zero copyrighted audio files, commercial-safe, lazy-loaded after user gesture).
 */
import type * as ToneType from "tone";

class HigroundAudio {
  private tone: typeof ToneType | null = null;
  private muted = false;
  private bgmPlaying = false;
  private bgmLoop: ToneType.Loop | null = null;
  private bgmSynth: ToneType.PolySynth | null = null;
  private melSynth: ToneType.Synth | null = null;
  private loaded = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.muted = window.localStorage.getItem("hg_sfx_muted") === "1";
      } catch {
        this.muted = false;
      }
    }
  }

  private async ensure(): Promise<typeof ToneType | null> {
    if (typeof window === "undefined") return null;
    if (!this.tone) {
      this.tone = await import("tone");
    }
    if (!this.loaded) {
      try {
        await this.tone.start();
        this.loaded = true;
      } catch {
        return null;
      }
    }
    return this.tone;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("hg_sfx_muted", m ? "1" : "0");
      } catch {
        // ignore storage errors
      }
    }
    if (m && this.bgmPlaying) {
      this.stopBgm();
    }
  }

  isBgmPlaying(): boolean {
    return this.bgmPlaying;
  }

  /** Cozy Kairosoft-style pop/bloop when switching avatar parts or swatches. */
  async pop(pitchOffset = 0): Promise<void> {
    if (this.muted) return;
    const Tone = await this.ensure();
    if (!Tone) return;
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.06, sustain: 0, release: 0.04 },
      volume: -14,
    }).toDestination();
    const notes = ["C5", "D5", "E5", "G5", "A5"];
    const note = notes[Math.abs(pitchOffset) % notes.length];
    synth.triggerAttackRelease(note, "32n");
    setTimeout(() => synth.dispose(), 250);
  }

  /** Crisp UI click for floor tabs, drawers, and interactive POIs. */
  async select(): Promise<void> {
    if (this.muted) return;
    const Tone = await this.ensure();
    if (!Tone) return;
    const synth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.004, decay: 0.04, sustain: 0, release: 0.03 },
      volume: -20,
    }).toDestination();
    synth.triggerAttackRelease("E5", "64n");
    setTimeout(() => synth.dispose(), 220);
  }

  /** Playful rapid arpeggio chirp when randomizing character. */
  async dice(): Promise<void> {
    if (this.muted) return;
    const Tone = await this.ensure();
    if (!Tone) return;
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 0.07, sustain: 0, release: 0.04 },
      volume: -14,
    }).toDestination();
    const now = Tone.now();
    ["C5", "E5", "G5", "C6"].forEach((n, i) => synth.triggerAttackRelease(n, "32n", now + i * 0.045));
    setTimeout(() => synth.dispose(), 500);
  }

  /** Joyful rising 3-note chime when cheering another runner! */
  async cheer(): Promise<void> {
    if (this.muted) return;
    const Tone = await this.ensure();
    if (!Tone) return;
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.008, decay: 0.14, sustain: 0.05, release: 0.12 },
      volume: -12,
    }).toDestination();
    const now = Tone.now();
    synth.triggerAttackRelease("E5", "16n", now);
    synth.triggerAttackRelease("G5", "16n", now + 0.07);
    synth.triggerAttackRelease("C6", "8n", now + 0.14);
    setTimeout(() => synth.dispose(), 700);
  }

  /** Crispy double cha-ching chime when revealing a Higround Cafe Voucher code! */
  async cashier(): Promise<void> {
    if (this.muted) return;
    const Tone = await this.ensure();
    if (!Tone) return;
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.02, release: 0.2 },
      volume: -13,
    }).toDestination();
    const now = Tone.now();
    synth.triggerAttackRelease(["B5", "E6"], "16n", now);
    synth.triggerAttackRelease(["E6", "G#6"], "8n", now + 0.09);
    setTimeout(() => synth.dispose(), 900);
  }

  /** Clear harmonic bell ding for Yoga Quest Timer star milestones (SPEC §8.2-C3). */
  async starDing(stars: 1 | 2 | 3): Promise<void> {
    if (this.muted) return;
    const Tone = await this.ensure();
    if (!Tone) return;
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.45, sustain: 0.05, release: 0.45 },
      volume: -10,
    }).toDestination();
    const now = Tone.now();
    if (stars === 1) {
      synth.triggerAttackRelease(["C5", "G5"], "4n", now);
    } else if (stars === 2) {
      synth.triggerAttackRelease(["E5", "B5"], "8n", now);
      synth.triggerAttackRelease(["G5", "D6"], "4n", now + 0.12);
    } else {
      synth.triggerAttackRelease(["C5", "E5"], "8n", now);
      synth.triggerAttackRelease(["G5", "B5"], "8n", now + 0.1);
      synth.triggerAttackRelease(["C6", "E6", "G6"], "2n", now + 0.2);
    }
    setTimeout(() => synth.dispose(), 1400);
  }

  /** Classic joyful Kairosoft / Habitica 8-bit victory fanfare for Level Up & Save! */
  async levelUp(): Promise<void> {
    if (this.muted) return;
    const Tone = await this.ensure();
    if (!Tone) return;
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.008, decay: 0.18, sustain: 0.15, release: 0.28 },
      volume: -11,
    }).toDestination();
    const now = Tone.now();
    synth.triggerAttackRelease(["C5", "E5"], "16n", now);
    synth.triggerAttackRelease(["D5", "F5"], "16n", now + 0.09);
    synth.triggerAttackRelease(["E5", "G5"], "16n", now + 0.18);
    synth.triggerAttackRelease(["G5", "B5"], "16n", now + 0.27);
    synth.triggerAttackRelease(["C6", "E6", "G6"], "2n", now + 0.36);
    setTimeout(() => synth.dispose(), 1600);
  }

  /** Start/stop cozy procedural Lo-Fi Coffee Shop BGM (warm chords + mellow melody at 82 BPM). */
  async toggleBgm(): Promise<boolean> {
    if (this.bgmPlaying) {
      this.stopBgm();
      return false;
    }
    if (this.muted) this.setMuted(false);
    const Tone = await this.ensure();
    if (!Tone) return false;

    const filter = new Tone.Filter(1200, "lowpass").toDestination();
    this.bgmSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.12, decay: 0.4, sustain: 0.35, release: 0.9 },
      volume: -24,
    }).connect(filter);

    this.melSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.22, sustain: 0.05, release: 0.25 },
      volume: -23,
    }).connect(filter);

    const chords = [
      ["C4", "E4", "G4", "B4"],
      ["A3", "C4", "E4", "G4"],
      ["D4", "F4", "A4", "C5"],
      ["G3", "B3", "D4", "F4"],
    ];
    const melody = ["E5", "G5", "A5", "G5", "E5", "D5", "C5", "D5", "E5", "A5", "G5", "E5", "D5", "B4", "C5", "G4"];
    let step = 0;

    Tone.getTransport().bpm.value = 82;
    this.bgmLoop = new Tone.Loop((time) => {
      if (step % 4 === 0) {
        const chord = chords[Math.floor(step / 4) % chords.length];
        this.bgmSynth?.triggerAttackRelease(chord, "1n", time);
      }
      if (step % 2 === 0 || step % 4 === 3) {
        const note = melody[step % melody.length];
        this.melSynth?.triggerAttackRelease(note, "8n", time);
      }
      step++;
    }, "4n").start(0);

    Tone.getTransport().start();
    this.bgmPlaying = true;
    return true;
  }

  stopBgm(): void {
    this.bgmPlaying = false;
    try {
      this.bgmLoop?.stop();
      this.bgmLoop?.dispose();
      this.bgmSynth?.dispose();
      this.melSynth?.dispose();
      this.tone?.getTransport().stop();
    } catch {
      // ignore cleanup errors
    }
    this.bgmLoop = null;
    this.bgmSynth = null;
    this.melSynth = null;
  }
}

export const sfx = new HigroundAudio();
