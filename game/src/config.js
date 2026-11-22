// Tunables for the heist: one screen of play, no scrolling, so every frame the judge
// sees is the whole room. Tiles are 40 px; the world is 30 by 14 tiles (1200 by 560),
// framed by a top HUD strip and a bottom status strip on a 1280 by 720 canvas.
export const STEP = 1 / 60;
export const TILE = 40;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_X = 40;
export const WORLD_Y = 64;
export const COLS = 30;
export const ROWS = 14;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;

export const BEST_KEY = 'velvet-rope-best';

// The thief: quick on foot, quicker still at a sprint, but sprinting is loud.
export const THIEF = {
  radius: 13,
  walkSpeed: 150,
  sprintSpeed: 228,
  // A guard hears a sprint from this far away and comes to look.
  sprintHeard: 130,
};

// A guard's eye: how far it sees, how wide its cone is, how fast suspicion grows
// when the thief is inside the cone in the open. Standing in shadow ('v' tiles) hides
// the thief unless the guard is almost on top of them.
export const GUARD = {
  radius: 13,
  patrolSpeed: 58,
  chaseSpeed: 166,
  searchSpeed: 78,
  visionRange: 196,
  visionHalfAngle: 0.56,
  shadowHideRange: 58,
  suspicionRate: 1.1,
  catchRadius: 27,
};

// A wall camera sweeps its cone back and forth; it never moves, never sleeps, and
// it is not fooled by a disguise. An EMP pulse switches every camera off for a while.
export const CAMERA = {
  range: 216,
  halfAngle: 0.5,
  alarmRate: 26,
  empSeconds: 8,
};

// The alarm meter: 0 quiet, 100 lockdown. It climbs while anyone watches the thief
// and falls back when the thief is unseen.
export const ALARM = {
  seenRate: 20,
  decayRate: 7,
  suspiciousAt: 35,
  lockdownAt: 100,
  lockdownSeconds: 12,
  lockdownFallTo: 55,
};

// Tools, at a cost: every level grants only a few, so spending one is a decision.
export const TOOLS = {
  smokeSeconds: 4,
  smokeRadius: 96,
  lockpickSeconds: 1.0,
};

// A laser beam (candidate A) cycles on and off; crossing a live beam spikes the alarm.
export const LASER = {
  alarmSpike: 26,
  slowSeconds: 0.8,
};

// Safe-cracking (candidate C): three tumblers, one needle. Hit the green zone three
// times; a miss rattles the safe and feeds the alarm.
export const SAFE = {
  tumblers: 3,
  missAlarm: 12,
};

// The getaway pays for planning: loot value, a par-time bonus per level, and a ghost
// bonus for finishing a level without ever tripping the alarm past a whisper.
export const SCORE = {
  ghostBonus: 250,
  ghostAlarmMax: 25,
  winBonus: 500,
};
