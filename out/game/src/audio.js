// All sound is synthesized with WebAudio: no audio files, no network. A tiny
// sequencer of blips and stings: pickup chimes, the alert sting when a guard spots
// the thief, the laser zap, the safe's tumbler clicks, and a getaway fanfare.
export function createAudio() {
  let context = null;
  let muted = false;
  let humNodes = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, seconds, type, gainValue, when = 0, slideTo = 0) {
    const ctx = ensure();
    if (!ctx || muted) return;
    try {
      const start = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
    } catch {
      // Audio is decoration: a blocked context never breaks the game.
    }
  }

  function startHum() {
    const ctx = ensure();
    if (!ctx || muted || humNodes) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 52;
      gain.gain.value = 0.018;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      humNodes = { osc, gain };
    } catch {
      humNodes = null;
    }
  }

  function stopHum() {
    if (!humNodes) return;
    try {
      humNodes.osc.stop();
    } catch {
      // Already stopped.
    }
    humNodes = null;
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startHum();
    },
    toggleMute() {
      muted = !muted;
      if (muted) stopHum();
      else startHum();
      return muted;
    },
    get muted() {
      return muted;
    },
    click() {
      tone(660, 0.07, 'square', 0.05);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.09);
      tone(1318, 0.14, 'sine', 0.08, 0.07);
    },
    targetTaken() {
      tone(523, 0.1, 'triangle', 0.1);
      tone(659, 0.1, 'triangle', 0.1, 0.09);
      tone(784, 0.2, 'triangle', 0.1, 0.18);
    },
    alertSting() {
      tone(220, 0.22, 'sawtooth', 0.09, 0, 440);
      tone(165, 0.3, 'sawtooth', 0.07, 0.08, 330);
    },
    caught() {
      tone(392, 0.16, 'square', 0.09, 0, 196);
      tone(311, 0.16, 'square', 0.09, 0.14, 155);
      tone(233, 0.34, 'square', 0.09, 0.28, 116);
    },
    cameraBeep() {
      tone(1568, 0.06, 'square', 0.045);
    },
    laserZap() {
      tone(1800, 0.12, 'sawtooth', 0.06, 0, 300);
    },
    empZap() {
      tone(1200, 0.3, 'sawtooth', 0.07, 0, 90);
    },
    smokePoof() {
      tone(300, 0.25, 'sine', 0.06, 0, 90);
    },
    tumblerClick() {
      tone(1200, 0.05, 'square', 0.06);
    },
    safeOpen() {
      tone(784, 0.1, 'triangle', 0.09);
      tone(1046, 0.16, 'triangle', 0.09, 0.09);
    },
    doorUnlock() {
      tone(440, 0.06, 'square', 0.05);
      tone(587, 0.09, 'square', 0.05, 0.06);
    },
    levelClear() {
      tone(523, 0.12, 'triangle', 0.09);
      tone(659, 0.12, 'triangle', 0.09, 0.1);
      tone(784, 0.12, 'triangle', 0.09, 0.2);
      tone(1046, 0.26, 'triangle', 0.1, 0.3);
    },
    getaway() {
      const notes = [523, 659, 784, 1046, 784, 1046, 1318];
      notes.forEach((freq, index) => tone(freq, 0.18, 'triangle', 0.09, index * 0.11));
    },
  };
}
