// The signature mechanics, one per candidate, each in its own named function so
// the dossier's outline shows what the game does:
//   updateLaserGrid  — museum: beams between emitter posts blink on and off; a
//     live beam spikes the alarm and slows the thief who crosses it.
//   updateDisguise   — casino: the thief's cover holds while they walk slowly at
//     a distance, and breaks the moment they sprint, snatch loot in front of a
//     guard, or let one get too close. Cameras are never fooled.
//   updateSafeCrack  — bank: a needle sweeps a dial; press E inside the green
//     zone to set a tumbler. Three tumblers open the safe; a miss rattles it.
import { distanceToSegment, tileCenter } from './grid.js';
import { LASER, SAFE } from './config.js';

// --- Laser grids (museum) ----------------------------------------------------

export function createLasers(level) {
  return (level.lasers || []).map((beam) => ({
    x1: tileCenter(beam.x1, beam.y1).x,
    y1: tileCenter(beam.x1, beam.y1).y,
    x2: tileCenter(beam.x2, beam.y2).x,
    y2: tileCenter(beam.x2, beam.y2).y,
    onSeconds: beam.on,
    offSeconds: beam.off,
    t: beam.phase || 0,
    on: (beam.phase || 0) < beam.on,
    cooldown: 0,
  }));
}

export function updateLaserGrid(state, dt) {
  let events = 0;
  for (const beam of state.lasers) {
    beam.t += dt;
    const cycle = beam.onSeconds + beam.offSeconds;
    beam.on = (beam.t % cycle) < beam.onSeconds;
    beam.cooldown = Math.max(0, beam.cooldown - dt);
    if (!beam.on || beam.cooldown > 0) continue;
    const player = state.player;
    if (distanceToSegment(player.x, player.y, beam.x1, beam.y1, beam.x2, beam.y2) < 16) {
      beam.cooldown = 0.6;
      player.slowT = LASER.slowSeconds;
      state.alarm = Math.min(100, state.alarm + LASER.alarmSpike);
      state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
      state.timesZapped = (state.timesZapped || 0) + 1;
      events |= 1; // zapped
      if (state.onLaserZap) state.onLaserZap();
    }
  }
  return events;
}

// --- Disguise (casino) -------------------------------------------------------

export function updateDisguise(state, dt) {
  const player = state.player;
  if (!player.disguised) return;
  // The cover slips when the thief runs, grabs loot under a guard's nose, or
  // lets a guard get close enough to see the stitching.
  if (player.sprinting) {
    breakDisguise(state, 'You ran. The cover is blown.');
    return;
  }
  for (const guard of state.guards) {
    if (Math.hypot(guard.x - player.x, guard.y - player.y) < 70) {
      breakDisguise(state, 'Too close — the guard made you.');
      return;
    }
  }
}

export function breakDisguise(state, reason) {
  if (!state.player.disguised) return;
  state.player.disguised = false;
  state.message = reason;
  state.messageT = 2.5;
}

// --- Safe-cracking (bank) ----------------------------------------------------

export function startSafeCrack(state, safe) {
  if (safe.open || state.crack) return false;
  state.crack = {
    safe,
    // The needle sweeps the dial; the green zone sits somewhere new each tumbler.
    needle: 0,
    needleSpeed: 1.5,
    needleDir: 1,
    tumblers: 0,
    zoneStart: 0.25 + state.random.next() * 0.5,
    zoneWidth: 0.2,
  };
  return true;
}

export function updateSafeCrack(state, dt) {
  const crack = state.crack;
  if (!crack) return 0;
  crack.needle += crack.needleDir * crack.needleSpeed * dt;
  if (crack.needle >= 1) {
    crack.needle = 1;
    crack.needleDir = -1;
  } else if (crack.needle <= 0) {
    crack.needle = 0;
    crack.needleDir = 1;
  }
  return 0;
}

// The player pressed E while working the dial.
export function hitSafeTumbler(state) {
  const crack = state.crack;
  if (!crack) return 0;
  const inZone = crack.needle >= crack.zoneStart && crack.needle <= crack.zoneStart + crack.zoneWidth;
  if (inZone) {
    crack.tumblers += 1;
    if (state.onTumbler) state.onTumbler();
    if (crack.tumblers >= SAFE.tumblers) {
      crack.safe.open = true;
      state.lootValue += crack.safe.value;
      state.score += crack.safe.value;
      state.lootCount += 1;
      state.crack = null;
      if (state.onSafeOpen) state.onSafeOpen();
      return 2; // safe opened
    }
    crack.zoneStart = 0.15 + state.random.next() * 0.6;
    crack.needleSpeed += 0.35;
    return 1; // tumbler set
  }
  state.alarm = Math.min(100, state.alarm + SAFE.missAlarm);
  state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
  crack.needle = 0;
  crack.needleDir = 1;
  return -1; // missed: the safe rattles, the alarm climbs
}

export function stopSafeCrack(state) {
  state.crack = null;
}
