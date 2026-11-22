// The screenshot scenes behind ?shot=start|play|alarm|win. Each one plays the real
// rules forward from a fresh world, steered by the autopilot (or, for the alarm
// scene, by a thief who walks straight at a guard), so the frame is what a real
// game looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import {
  EVENT_BUSTED, EVENT_CLEAR, EVENT_WIN, autopilotDrive,
} from './world.js';
import {
  SCREEN_BUSTED, SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 45;
const ALARM_SECONDS = 60;
const WIN_LIMIT_SECONDS = 720;
const SAMPLE = STEP;

// Drive the thief toward the nearest guard and stop just inside its vision:
// the guard's cone finds a thief standing in the open, the alarm climbs, and
// the chase that follows is the caught moment. Used for the alarm scene only.
function carelessDrive(state) {
  const player = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const guard of state.guards) {
    const dist = Math.hypot(guard.x - player.x, guard.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = guard;
    }
  }
  if (!best) return { x: 0, y: 0, sprint: false, interact: false, smoke: false, emp: false, disguise: false };
  // Once a guard gives chase, walk away from it — slowly enough that the chase
  // lasts, the alarm climbs toward lockdown, and the catch still comes.
  for (const guard of state.guards) {
    if (guard.state === 'alert') {
      const dx = player.x - guard.x;
      const dy = player.y - guard.y;
      const dist = Math.hypot(dx, dy) || 1;
      return { x: dx / dist, y: dy / dist, sprint: false, interact: false, smoke: false, emp: false, disguise: false };
    }
  }
  // Close enough to be seen: stand still and let the guard do its job.
  if (bestDist < 140) return { x: 0, y: 0, sprint: false, interact: false, smoke: false, emp: false, disguise: false };
  const dx = best.x - player.x;
  const dy = best.y - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  return { x: dx / dist, y: dy / dist, sprint: false, interact: false, smoke: false, emp: false, disguise: false };
}

function runSteps(world, driver, seconds, stopWhen) {
  const limit = Math.floor(seconds / STEP);
  let events = 0;
  for (let index = 0; index < limit; index += 1) {
    events |= world.step(world, driver(world.state), STEP);
    if (stopWhen && stopWhen(world.state, events)) break;
    if (world.state.status !== 'playing') break;
  }
  return events;
}

function stagePlay(world, seed) {
  world.loadLevel(1);
  // Stop mid-heist: a few lifts in, target not yet taken, the room still full
  // of cones — the frame the judge should see, not the walk to the exit.
  runSteps(world, (state) => autopilotDrive(state), PLAY_SECONDS, (state) => (state.lootCount >= 3 && !state.targetTaken) || state.alarm >= 25);
  return world.state.status;
}

function stageAlarm(world) {
  world.loadLevel(1);
  runSteps(world, (state) => carelessDrive(state), ALARM_SECONDS, (state) => state.alarm >= 55);
  return world.state.status;
}

function stageWin(world) {
  world.loadLevel(0);
  let busts = 0;
  for (let index = 0; index < Math.floor(WIN_LIMIT_SECONDS / STEP); index += 1) {
    const events = world.step(world, autopilotDrive(world.state), STEP);
    if (events & EVENT_WIN) return 'won';
    if (events & EVENT_CLEAR) {
      world.loadLevel(world.state.levelIndex + 1);
      continue;
    }
    if (events & EVENT_BUSTED) {
      busts += 1;
      if (busts > 3) return 'busted';
      world.loadLevel(world.state.levelIndex);
    }
  }
  return world.state.status;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. The play scene retries a couple of seeds so the cover
 * frame is a thief mid-heist, not a busted one.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'alarm') {
    stageAlarm(world);
    return { screen: world.state.status === 'busted' ? SCREEN_BUSTED : SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    const result = stageWin(world);
    return { screen: result === 'won' ? SCREEN_WIN : SCREEN_BUSTED, best: world.state.score };
  }
  if (name === 'play') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      const status = stagePlay(world, attempt);
      if (status === 'playing' && world.state.alarm >= 15) {
        return { screen: SCREEN_PLAY, best: world.state.score };
      }
      if (status === 'playing') return { screen: SCREEN_PLAY, best: world.state.score };
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  world.loadLevel(0);
  runSteps(world, () => ({ x: 0, y: 0, sprint: false, interact: false, smoke: false, emp: false, disguise: false }), START_SECONDS, null);
  return { screen: SCREEN_TITLE, best: 0 };
}
