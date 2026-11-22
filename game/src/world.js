// The heist itself: one level's state, the thief's movement, the guards' eyes and
// feet, the cameras' sweep, the alarm meter, the tools, and the autopilot that
// plays the game to prove it can be won. Screens and drawing live elsewhere;
// this file only knows the rules.
import {
  ALARM, CAMERA, COLS, GUARD, ROWS, SAFE, SCORE, STEP, THIEF, TILE, TOOLS,
} from './config.js';
import {
  circleHitsSolid, distanceToSegment, doorAt, inSmoke, lineOfSight, moveCircle,
  planPath, smokeBetween, solidAt, tileCenter, tileChar, tileOf,
} from './grid.js';
import { THEMES, LEVELS } from './levels.js';
import {
  breakDisguise, createLasers, hitSafeTumbler, startSafeCrack, stopSafeCrack,
  updateDisguise, updateLaserGrid, updateSafeCrack,
} from './mechanics.js';

export const EVENT_PICKUP = 1;
export const EVENT_TARGET = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_BUSTED = 8;
export const EVENT_CLEAR = 16;
export const EVENT_WIN = 32;
export const EVENT_LOCKDOWN = 64;
export const EVENT_ZAPPED = 128;
export const EVENT_SAFE_OPEN = 256;
export const EVENT_TUMBLER = 512;
export const EVENT_SMOKE = 1024;
export const EVENT_EMP = 2048;
export const EVENT_DOOR = 4096;
export const EVENT_DISGUISE_BREAK = 8192;

const LOOT_VALUES = { small: 120, big: 350, target: 1000 };
const SAFE_VALUE = 400;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function tileIsShadow(state, x, y) {
  const { tx, ty } = tileOf(x, y);
  return tileChar(state, tx, ty) === 'v';
}

// --- What a watcher can see ---------------------------------------------------

function watcherSees(state, fromX, fromY, dirAngle, range, halfAngle, isGuard) {
  const player = state.player;
  const dx = player.x - fromX;
  const dy = player.y - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), dirAngle)) > halfAngle) return false;
  if (isGuard && player.disguised && dist > 70) return false;
  if (tileIsShadow(state, player.x, player.y) && dist > GUARD.shadowHideRange) return false;
  if (inSmoke(state, player.x, player.y)) return false;
  if (smokeBetween(state, fromX, fromY, player.x, player.y)) return false;
  return lineOfSight(state, fromX, fromY, player.x, player.y);
}

function guardSeesPlayer(state, guard) {
  return watcherSees(state, guard.x, guard.y, guard.dir, GUARD.visionRange, GUARD.visionHalfAngle, true);
}

function cameraSeesPlayer(state, camera) {
  if (camera.disabled) return false;
  return watcherSees(state, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, false);
}

// The autopilot's danger map: would this tile be seen right now?
function tileSeenBy(state, tx, ty, byGuard) {
  const centre = tileCenter(tx, ty);
  for (const guard of state.guards) {
    const dist = Math.hypot(centre.x - guard.x, centre.y - guard.y);
    if (dist > GUARD.visionRange) continue;
    if (Math.abs(angleDiff(Math.atan2(centre.y - guard.y, centre.x - guard.x), guard.dir)) > GUARD.visionHalfAngle) continue;
    if (!lineOfSight(state, guard.x, guard.y, centre.x, centre.y)) continue;
    return true;
  }
  if (!byGuard) return false;
  for (const camera of state.cameras) {
    if (camera.disabled) continue;
    const dist = Math.hypot(centre.x - camera.x, centre.y - camera.y);
    if (dist > CAMERA.range) continue;
    if (Math.abs(angleDiff(Math.atan2(centre.y - camera.y, centre.x - camera.x), camera.angle)) > CAMERA.halfAngle) continue;
    if (!lineOfSight(state, camera.x, camera.y, centre.x, centre.y)) continue;
    return true;
  }
  return false;
}

// --- Building a level ---------------------------------------------------------

export function createWorld(random) {
  const world = {
    random,
    state: null,
    reset() {
      world.state = null;
    },
    loadLevel(index) {
      const level = LEVELS[index];
      const theme = THEMES[level.theme];
      const state = {
        levelIndex: index,
        level,
        theme,
        map: level.map,
        random,
        time: 0,
        alarm: 0,
        maxAlarm: 0,
        lockdownT: 0,
        score: world.state ? world.state.score : 0,
        lootValue: world.state ? world.state.lootValue : 0,
        lootCount: world.state ? world.state.lootCount : 0,
        levelLoot: 0,
        targetTaken: false,
        status: 'playing',
        message: '',
        messageT: 0,
        empT: 0,
        smokes: [],
        crack: null,
        pilot: { path: [], replanT: 0, goalKey: '' },
        stats: { spotted: 0, zapped: 0, busts: world.state ? world.state.stats.busts : 0 },
        timesZapped: 0,
        seenBy: null,
        player: null,
        guards: [],
        cameras: [],
        lasers: createLasers(level),
        loots: [],
        safes: [],
        doors: [],
        exit: null,
        tools: { ...level.tools },
        onLaserZap: null,
        onTumbler: null,
        onSafeOpen: null,
      };
      level.map.forEach((row, ty) => {
        [...row].forEach((ch, tx) => {
          const centre = tileCenter(tx, ty);
          if (ch === 'P') state.player = makeThief(centre.x, centre.y);
          else if (ch === 'E') state.exit = { x: centre.x, y: centre.y };
          else if (ch === 'o') state.loots.push({ x: centre.x, y: centre.y, kind: 'small', value: LOOT_VALUES.small, taken: false });
          else if (ch === 'O') state.loots.push({ x: centre.x, y: centre.y, kind: 'big', value: LOOT_VALUES.big, taken: false });
          else if (ch === 'T') state.loots.push({ x: centre.x, y: centre.y, kind: 'target', value: LOOT_VALUES.target, taken: false });
          else if (ch === 'S') state.safes.push({ x: centre.x, y: centre.y, value: SAFE_VALUE, open: false });
          else if (ch === 'L') state.doors.push({ tx, ty, locked: true, open: false, channelT: 0 });
          else if (ch === 'K') state.cameras.push(makeCamera(state, tx, ty));
        });
      });
      for (const def of level.guards) state.guards.push(makeGuard(def));
      world.state = state;
      return state;
    },
    step,
  };
  return world;
}

function makeThief(x, y) {
  return {
    x, y, radius: THIEF.radius, dirX: 0, dirY: 1, moving: false,
    sprinting: false, disguised: false, slowT: 0, channel: null,
  };
}

function makeGuard(def) {
  const start = tileCenter(def.x, def.y);
  return {
    x: start.x, y: start.y, radius: GUARD.radius,
    dir: Math.PI / 2, state: 'patrol', suspicion: 0,
    waypoints: def.waypoints.map(([x, y]) => tileCenter(x, y)),
    wpIndex: 1 % def.waypoints.length,
    pauseT: 0, pauseTotal: def.pause || 1,
    lastSeen: { x: start.x, y: start.y },
    loseT: 0, searchT: 0, replanT: 0, path: [],
  };
}

// A camera hangs on a wall tile and looks into the room: the cone points at the
// open floor beside it, then sweeps back and forth.
function makeCamera(state, tx, ty) {
  const centre = tileCenter(tx, ty);
  let angle = Math.PI / 2;
  const neighbours = [
    [0, 1, Math.PI / 2], [0, -1, -Math.PI / 2], [1, 0, 0], [-1, 0, Math.PI],
  ];
  for (const [dx, dy, a] of neighbours) {
    if (!solidAt(state, tx + dx, ty + dy)) {
      angle = a;
      break;
    }
  }
  return {
    x: centre.x, y: centre.y, baseAngle: angle, angle,
    sweep: 0.85, speed: 0.55, phase: (tx * 7 + ty * 13) % 6,
    disabled: false, beepT: 0,
  };
}

// --- One step of the rules ----------------------------------------------------

function step(world, input, dt) {
  const state = world.state;
  if (!state || state.status !== 'playing') return 0;
  let events = 0;
  const player = state.player;
  state.time += dt;

  events |= updateLaserGrid(state, dt);
  if (events & 1) events = (events & ~1) | EVENT_ZAPPED;
  if (state.level.mechanic === 'disguise') updateDisguise(state, dt);

  // Safe-cracking holds the thief still: the needle keeps sweeping, the guards
  // keep walking, and E is the only input that matters.
  if (state.crack) {
    updateSafeCrack(state, dt);
    if (input.interact) {
      const result = hitSafeTumbler(state);
      if (result === 2) events |= EVENT_SAFE_OPEN;
      else if (result === 1) events |= EVENT_TUMBLER;
      else if (result === -1) events |= EVENT_SPOTTED;
    }
    if (input.x !== 0 || input.y !== 0) stopSafeCrack(state);
  } else {
    // Movement, with a sprint that is loud and a laser burn that is slow.
    const speed = (input.sprint ? THIEF.sprintSpeed : THIEF.walkSpeed) * (player.slowT > 0 ? 0.55 : 1);
    player.moving = input.x !== 0 || input.y !== 0;
    player.sprinting = !!input.sprint && player.moving;
    if (player.moving) {
      player.dirX = input.x;
      player.dirY = input.y;
      moveCircle(state, player, input.x * speed * dt, input.y * speed * dt);
    }
    if (player.channel) {
      const door = player.channel.door;
      const dist = Math.hypot(player.x - door.x, player.y - door.y);
      if (dist > 70 || player.moving) {
        player.channel = null;
      } else {
        door.channelT -= dt;
        if (door.channelT <= 0) {
          door.open = true;
          player.channel = null;
          events |= EVENT_DOOR;
        }
      }
    } else if (input.interact) {
      events |= tryInteract(state);
    }
    if (input.disguise && state.level.mechanic === 'disguise') {
      player.disguised = !player.disguised;
      state.message = player.disguised ? 'Disguise on — walk, don\'t run.' : 'Disguise off.';
      state.messageT = 2;
    }
    if (input.smoke && state.tools.smoke > 0 && !state.smokes.length) {
      state.tools.smoke -= 1;
      state.smokes.push({ x: player.x, y: player.y, radius: TOOLS.smokeRadius, t: TOOLS.smokeSeconds });
      events |= EVENT_SMOKE;
    }
    if (input.emp && state.tools.emp > 0 && state.empT <= 0) {
      state.tools.emp -= 1;
      state.empT = CAMERA.empSeconds;
      for (const camera of state.cameras) camera.disabled = true;
      events |= EVENT_EMP;
    }
  }

  // Loot: walk over it. The target opens the getaway door.
  for (const loot of state.loots) {
    if (loot.taken) continue;
    if (Math.hypot(player.x - loot.x, player.y - loot.y) < 28) {
      loot.taken = true;
      state.lootValue += loot.value;
      state.levelLoot += loot.value;
      state.score += loot.value;
      state.lootCount += 1;
      if (loot.kind === 'target') {
        state.targetTaken = true;
        state.message = `${state.level.targetName} secured — get to the getaway door!`;
        state.messageT = 3;
        events |= EVENT_TARGET;
        if (player.disguised) breakDisguise(state, 'The target gave you away.');
      } else {
        events |= EVENT_PICKUP;
        if (player.disguised) {
          for (const guard of state.guards) {
            if (guardSeesPlayer(state, guard)) {
              breakDisguise(state, 'Snatching loot in front of a guard blew it.');
              events |= EVENT_DISGUISE_BREAK;
              break;
            }
          }
        }
      }
    }
  }

  // The getaway: target in hand, alarm below lockdown, reach the door.
  if (state.targetTaken && state.lockdownT <= 0 && state.exit) {
    if (Math.hypot(player.x - state.exit.x, player.y - state.exit.y) < 30) {
      return finishLevel(world, state, events);
    }
  }

  // A sprinting thief is heard: nearby guards come to look.
  if (player.sprinting) {
    for (const guard of state.guards) {
      const dist = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (dist < THIEF.sprintHeard && guard.state === 'patrol') {
        guard.state = 'suspicious';
        guard.suspicion = Math.max(guard.suspicion, 0.5);
        guard.lastSeen = { x: player.x, y: player.y };
        guard.loseT = 0;
      }
    }
  }

  events |= updateGuards(world, state, dt);
  events |= updateCameras(state, dt);

  // The alarm: climbs while anyone watches, falls back in the quiet.
  const seen = state.seenBy;
  if (seen === 'guard') state.alarm = Math.min(100, state.alarm + ALARM.seenRate * dt);
  else if (seen === 'camera') state.alarm = Math.min(100, state.alarm + CAMERA.alarmRate * dt);
  else state.alarm = Math.max(0, state.alarm - ALARM.decayRate * dt);
  state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
  if (state.alarm >= ALARM.lockdownAt && state.lockdownT <= 0) {
    state.lockdownT = ALARM.lockdownSeconds;
    events |= EVENT_LOCKDOWN;
    state.message = 'LOCKDOWN — every guard is coming for you!';
    state.messageT = 3;
    for (const guard of state.guards) {
      guard.state = 'alert';
      guard.suspicion = 1;
      guard.lastSeen = { x: player.x, y: player.y };
      guard.loseT = 0;
    }
  }
  if (state.lockdownT > 0) {
    state.lockdownT -= dt;
    if (state.lockdownT <= 0) {
      state.alarm = ALARM.lockdownFallTo;
      for (const guard of state.guards) {
        if (guard.state === 'alert') {
          guard.state = 'search';
          guard.searchT = 2.5;
        }
      }
    }
  }

  for (let index = state.smokes.length - 1; index >= 0; index -= 1) {
    state.smokes[index].t -= dt;
    if (state.smokes[index].t <= 0) state.smokes.splice(index, 1);
  }
  if (state.empT > 0) {
    state.empT -= dt;
    if (state.empT <= 0) {
      for (const camera of state.cameras) camera.disabled = false;
    }
  }
  player.slowT = Math.max(0, player.slowT - dt);
  state.messageT = Math.max(0, state.messageT - dt);
  return events;
}

// E near a safe starts the crack; E near a locked door starts the pick.
function tryInteract(state) {
  const player = state.player;
  for (const safe of state.safes) {
    if (safe.open) continue;
    if (Math.hypot(player.x - safe.x, player.y - safe.y) < 62) {
      if (startSafeCrack(state, safe)) return EVENT_TUMBLER;
    }
  }
  for (const door of state.doors) {
    if (door.open || !door.locked) continue;
    const centre = tileCenter(door.tx, door.ty);
    if (Math.hypot(player.x - centre.x, player.y - centre.y) < 62) {
      if (state.tools.picks <= 0) {
        state.message = 'No lockpicks left.';
        state.messageT = 2;
        return 0;
      }
      state.tools.picks -= 1;
      door.channelT = TOOLS.lockpickSeconds;
      door.x = centre.x;
      door.y = centre.y;
      player.channel = { door };
      return 0;
    }
  }
  return 0;
}

function finishLevel(world, state, events) {
  const timeBonus = Math.max(0, Math.round(state.level.par - state.time)) * 10;
  const ghost = state.maxAlarm <= SCORE.ghostAlarmMax;
  const ghostBonus = ghost ? SCORE.ghostBonus : 0;
  state.score += timeBonus + ghostBonus;
  state.levelClear = { timeBonus, ghostBonus, ghost, time: state.time };
  if (state.levelIndex + 1 >= LEVELS.length) {
    state.score += SCORE.winBonus;
    state.status = 'won';
    return events | EVENT_WIN;
  }
  state.status = 'cleared';
  return events | EVENT_CLEAR;
}

// --- Guards -------------------------------------------------------------------

function updateGuards(world, state, dt) {
  let events = 0;
  const player = state.player;
  let anyoneSees = false;
  for (const guard of state.guards) {
    const sees = guardSeesPlayer(state, guard);
    if (sees) {
      anyoneSees = true;
      guard.lastSeen = { x: player.x, y: player.y };
      guard.loseT = 0;
      const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
      guard.suspicion += GUARD.suspicionRate * (1.5 - dist / GUARD.visionRange) * dt;
      if (guard.suspicion >= 1 && guard.state !== 'alert') {
        guard.state = 'alert';
        guard.replanT = 0;
        state.stats.spotted += 1;
        events |= EVENT_SPOTTED;
      } else if (guard.suspicion >= 0.35 && guard.state === 'patrol') {
        guard.state = 'suspicious';
      }
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - 0.8 * dt);
      guard.loseT += dt;
      if (guard.state === 'alert' && guard.loseT > 3) {
        guard.state = 'search';
        guard.searchT = 2.5;
      } else if (guard.state === 'suspicious' && guard.suspicion <= 0.05) {
        guard.state = 'patrol';
      }
    }

    if (guard.state === 'patrol') {
      guard.dir = patrolDir(guard, dt);
      if (guard.pauseT > 0) {
        guard.pauseT -= dt;
        if (guard.pauseT <= 0) guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      } else {
        const target = guard.waypoints[guard.wpIndex];
        const arrived = followPath(state, guard, target.x, target.y, GUARD.patrolSpeed, dt);
        if (arrived) guard.pauseT = guard.pauseTotal;
      }
    } else if (guard.state === 'suspicious') {
      const arrived = followPath(state, guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.searchSpeed, dt);
      if (arrived) {
        guard.state = 'search';
        guard.searchT = 2;
      }
    } else if (guard.state === 'alert') {
      guard.replanT -= dt;
      if (guard.replanT <= 0) {
        guard.replanT = 0.4;
        const from = tileOf(guard.x, guard.y);
        const to = tileOf(player.x, player.y);
        guard.path = planPath(state, from.tx, from.ty, to.tx, to.ty, (tx, ty) => (solidAt(state, tx, ty) ? null : 1)) || [];
      }
      const next = guard.path[0];
      if (next) {
        const arrived = moveToward(state, guard, next.x, next.y, GUARD.chaseSpeed, dt);
        if (arrived) guard.path.shift();
      } else {
        moveToward(state, guard, player.x, player.y, GUARD.chaseSpeed, dt);
      }
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchRadius) {
        state.status = 'busted';
        state.stats.busts += 1;
        events |= EVENT_BUSTED;
      }
    } else if (guard.state === 'search') {
      guard.searchT -= dt;
      guard.dir += 1.6 * dt;
      if (guard.searchT <= 0) {
        guard.state = 'patrol';
        guard.wpIndex = nearestWaypoint(guard);
      }
    }
  }
  state.seenBy = anyoneSees ? 'guard' : state.seenBy === 'guard' ? null : state.seenBy;
  return events;
}

// A patrolling guard faces where it walks, and scans the room while it waits.
function patrolDir(guard, dt) {
  if (guard.pauseT > 0) {
    guard.scanT = (guard.scanT || 0) + dt;
    return guard.dir + Math.sin(guard.scanT * 1.4) * 0.02;
  }
  return guard.dir;
}

function nearestWaypoint(guard) {
  let best = 0;
  let bestDist = Infinity;
  guard.waypoints.forEach((point, index) => {
    const dist = Math.hypot(point.x - guard.x, point.y - guard.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

// Walk toward a point along the tile grid, routing around furniture instead of
// pushing into it. True when arrived.
function followPath(state, guard, tx, ty, speed, dt) {
  if (Math.hypot(tx - guard.x, ty - guard.y) < 6) return true;
  const targetKey = `${Math.round(tx)},${Math.round(ty)}`;
  if (guard.pathTarget !== targetKey || !guard.path.length) {
    const from = tileOf(guard.x, guard.y);
    const to = tileOf(tx, ty);
    guard.path = planPath(state, from.tx, from.ty, to.tx, to.ty, (x, y) => (solidAt(state, x, y) ? null : 1)) || [];
    guard.pathTarget = targetKey;
  }
  const next = guard.path[0];
  if (next) {
    if (moveToward(state, guard, next.x, next.y, speed, dt)) guard.path.shift();
    return false;
  }
  return moveToward(state, guard, tx, ty, speed, dt);
}

// Walk toward a point at speed; true when arrived. Direction follows movement.
function moveToward(state, entity, tx, ty, speed, dt) {
  const dx = tx - entity.x;
  const dy = ty - entity.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return true;
  const step = Math.min(dist, speed * dt);
  const nx = dx / dist;
  const ny = dy / dist;
  entity.dir = Math.atan2(ny, nx);
  moveCircle(state, entity, nx * step, ny * step);
  return false;
}

// --- Cameras --------------------------------------------------------------------

function updateCameras(state, dt) {
  let events = 0;
  let cameraSees = false;
  for (const camera of state.cameras) {
    if (camera.disabled) continue;
    camera.angle = camera.baseAngle + camera.sweep * Math.sin(state.time * camera.speed + camera.phase);
    if (cameraSeesPlayer(state, camera)) {
      cameraSees = true;
      camera.beepT -= dt;
      if (camera.beepT <= 0) {
        camera.beepT = 0.9;
        if (state.onCameraBeep) state.onCameraBeep();
      }
    }
  }
  if (cameraSees && state.seenBy !== 'guard') state.seenBy = 'camera';
  else if (!cameraSees && state.seenBy === 'camera') state.seenBy = null;
  return events;
}

// --- The autopilot: plays to win ------------------------------------------------

export function autopilotDrive(state) {
  const input = { x: 0, y: 0, sprint: false, interact: false, smoke: false, emp: false, disguise: false };
  const player = state.player;
  if (!player || state.status !== 'playing') return input;

  // Working a safe: the only job is to press E while the needle is in the green.
  if (state.crack) {
    const crack = state.crack;
    const margin = 0.02;
    input.interact = crack.needle >= crack.zoneStart + margin
      && crack.needle <= crack.zoneStart + crack.zoneWidth - margin;
    return input;
  }

  // Finishing a lockpick: stand still until the door gives.
  if (player.channel) return input;

  const pilot = state.pilot;
  pilot.replanT -= STEP;
  const goal = pickGoal(state);
  const goalKey = goal ? `${goal.tx},${goal.ty}` : '';
  if (pilot.replanT <= 0 || pilot.goalKey !== goalKey || !pilot.path.length) {
    pilot.replanT = 0.4;
    pilot.goalKey = goalKey;
    pilot.path = goal ? planAutopilotPath(state, goal.tx, goal.ty) : [];
  }

  // A safe is a bonus, not the job: crack one only when the room is quiet.
  const safe = nearestSafe(state);
  if (safe && !safe.open && state.alarm < 40 && nearestGuardDist(state) > 180) {
    const dist = Math.hypot(player.x - safe.x, player.y - safe.y);
    if (dist < 62) {
      input.interact = true;
      return input;
    }
  }

  // A locked door on the way: stand by it and pick it.
  const door = doorOnPath(state, pilot.path);
  if (door) {
    const centre = tileCenter(door.tx, door.ty);
    const dist = Math.hypot(player.x - centre.x, player.y - centre.y);
    if (dist < 62) {
      input.interact = true;
      return input;
    }
  }

  // A guard on the hunt is faster than a walk and almost as fast as a sprint:
  // do not keep walking the plan — run away from the hunter, toward the nearest
  // shadow where its cone cannot find you, and let it lose the scent.
  const hunter = state.guards.find((g) => g.state === 'alert');
  if (hunter) {
    const dist = Math.hypot(hunter.x - player.x, hunter.y - player.y);
    const fleeRange = state.lockdownT > 0 ? 400 : 260;
    if (dist < fleeRange) {
      if (state.tools.smoke > 0 && !state.smokes.length) input.smoke = true;
      let awayX = player.x - hunter.x;
      let awayY = player.y - hunter.y;
      const awayLen = Math.hypot(awayX, awayY) || 1;
      awayX /= awayLen;
      awayY /= awayLen;
      const shadow = nearestShadow(state);
      if (shadow) {
        const sx = shadow.x - player.x;
        const sy = shadow.y - player.y;
        const sLen = Math.hypot(sx, sy) || 1;
        awayX = awayX * 1.1 + (sx / sLen) * 0.9;
        awayY = awayY * 1.1 + (sy / sLen) * 0.9;
        const len = Math.hypot(awayX, awayY) || 1;
        awayX /= len;
        awayY /= len;
      }
      input.x = awayX;
      input.y = awayY;
      input.sprint = true;
      return input;
    }
  }

  // Tools for trouble: smoke when a guard is closing in, and an EMP pulse
  // BEFORE stepping into a live camera cone — not after the alarm is already
  // climbing. The pulse lasts eight seconds, long enough to lift the loot
  // the camera was watching and leave.
  const alertGuard = state.guards.find((g) => g.state === 'alert' && Math.hypot(g.x - player.x, g.y - player.y) < 170);
  if (alertGuard && state.tools.smoke > 0 && !state.smokes.length) input.smoke = true;
  if (state.tools.emp > 0 && state.empT <= 0) {
    const next = pilot.path[0];
    if (next) {
      const { tx, ty } = tileOf(next.x, next.y);
      if (cameraSeesTile(state, tx, ty)) input.emp = true;
    }
    if (state.seenBy === 'camera') input.emp = true;
  }

  // The disguise goes on whenever a guard is near enough to matter.
  if (state.level.mechanic === 'disguise' && !player.disguised && nearestGuardDist(state) < 280) {
    input.disguise = true;
  }

  const next = pilot.path[0];
  if (!next) return input;
  // A live beam is a wall of light: wait out the pulse rather than walk into
  // it. (If the thief is already on the beam, keep moving — never wait in it.)
  if (beamBlocksPoint(state, next.x, next.y) && !beamBlocksPoint(state, player.x, player.y)) {
    return input;
  }
  const dx = next.x - player.x;
  const dy = next.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 14) {
    pilot.path.shift();
    return autopilotDrive(state);
  }
  input.x = dx / dist;
  input.y = dy / dist;
  input.sprint = pilot.path.length > 6 && nearestGuardDist(state) > 220 && !tileSeenBy(state, tileOf(player.x, player.y).tx, tileOf(player.x, player.y).ty, true);
  return input;
}

function pickGoal(state) {
  const player = state.player;
  if (state.targetTaken && state.exit) {
    const { tx, ty } = tileOf(state.exit.x, state.exit.y);
    return { tx, ty };
  }
  let best = null;
  let bestDist = Infinity;
  for (const loot of state.loots) {
    if (loot.taken) continue;
    const dist = Math.hypot(loot.x - player.x, loot.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = loot;
    }
  }
  if (!best) return null;
  const { tx, ty } = tileOf(best.x, best.y);
  return { tx, ty };
}

function planAutopilotPath(state, toTx, toTy) {
  const from = tileOf(state.player.x, state.player.y);
  return planPath(state, from.tx, from.ty, toTx, toTy, (tx, ty) => {
    const ch = tileChar(state, tx, ty);
    if (ch === 'L') {
      const door = doorAt(state, tx, ty);
      return door && door.open ? 1 : 15;
    }
    if (solidAt(state, tx, ty)) return null;
    let cost = 1;
    if (tileSeenBy(state, tx, ty, true)) cost += 60;
    for (const beam of state.lasers) {
      if (!beam.on) continue;
      const centre = tileCenter(tx, ty);
      if (distanceToSegment(centre.x, centre.y, beam.x1, beam.y1, beam.x2, beam.y2) < 22) cost += 50;
    }
    for (const guard of state.guards) {
      const centre = tileCenter(tx, ty);
      if (Math.hypot(centre.x - guard.x, centre.y - guard.y) < TILE) cost += 20;
    }
    return cost;
  }) || [];
}

function nearestSafe(state) {
  let best = null;
  let bestDist = Infinity;
  for (const safe of state.safes) {
    if (safe.open) continue;
    const dist = Math.hypot(safe.x - state.player.x, safe.y - state.player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = safe;
    }
  }
  return best;
}

function nearestGuardDist(state) {
  let best = Infinity;
  for (const guard of state.guards) {
    best = Math.min(best, Math.hypot(guard.x - state.player.x, guard.y - state.player.y));
  }
  return best;
}

// Would a live camera see this tile right now?
function cameraSeesTile(state, tx, ty) {
  const centre = tileCenter(tx, ty);
  for (const camera of state.cameras) {
    if (camera.disabled) continue;
    const dist = Math.hypot(centre.x - camera.x, centre.y - camera.y);
    if (dist > CAMERA.range) continue;
    if (Math.abs(angleDiff(Math.atan2(centre.y - camera.y, centre.x - camera.x), camera.angle)) > CAMERA.halfAngle) continue;
    if (!lineOfSight(state, camera.x, camera.y, centre.x, centre.y)) continue;
    return true;
  }
  return false;
}

// Is this point about to be crossed by a live beam — on now, or firing within
// the next half second? The thief waits out the pulse instead of walking in.
function beamBlocksPoint(state, x, y) {
  for (const beam of state.lasers) {
    if (distanceToSegment(x, y, beam.x1, beam.y1, beam.x2, beam.y2) >= 22) continue;
    if (beam.on) return true;
    const cycle = beam.onSeconds + beam.offSeconds;
    if (cycle - (beam.t % cycle) < 0.6) return true;
  }
  return false;
}

// The nearest shadow tile: a guard's cone cannot find the thief there unless
// it is almost on top of them, so it is where a hunted thief runs.
function nearestShadow(state) {
  let best = null;
  let bestDist = Infinity;
  state.map.forEach((row, ty) => {
    [...row].forEach((ch, tx) => {
      if (ch !== 'v') return;
      const centre = tileCenter(tx, ty);
      const dist = Math.hypot(centre.x - state.player.x, centre.y - state.player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = centre;
      }
    });
  });
  return best;
}

function doorOnPath(state, path) {
  if (!path || !path.length) return null;
  for (const point of path.slice(0, 3)) {
    const { tx, ty } = tileOf(point.x, point.y);
    if (tileChar(state, tx, ty) === 'L') {
      const door = doorAt(state, tx, ty);
      if (door && !door.open) return door;
    }
  }
  return null;
}
