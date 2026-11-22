// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between six
// screens: title, play, paused, busted, level clear and the getaway.
//
// ?seed=N fixes the random source. ?shot=start|play|alarm|win stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. ?autopilot=1 plays the whole game with the autopilot as fast as the
// machine allows and reports window.__heistResult when it ends.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CLEAR, EVENT_DOOR, EVENT_EMP, EVENT_LOCKDOWN, EVENT_PICKUP, EVENT_SAFE_OPEN, EVENT_SMOKE, EVENT_SPOTTED, EVENT_TARGET, EVENT_TUMBLER, EVENT_WIN, EVENT_ZAPPED, autopilotDrive } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RETRY, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_CLEAR, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const AUTOPILOT_LIMIT_SECONDS = 300;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const autopilot = params.get('autopilot') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runAutopilot() {
  world.loadLevel(0);
  const started = performance.now();
  let steps = 0;
  let result = null;
  function finish(outcome) {
    result = {
      won: world.state.status === 'won',
      outcome,
      score: world.state.score,
      lootValue: world.state.lootValue,
      lootCount: world.state.lootCount,
      timeSeconds: Math.round(world.state.time * 100) / 100,
      levelIndex: world.state.levelIndex,
      steps,
      wallMs: Math.round(performance.now() - started),
      spotted: world.state.stats.spotted,
      zapped: world.state.timesZapped,
      busts: world.state.stats.busts,
      maxAlarm: Math.round(world.state.maxAlarm),
    };
    window.__heistResult = result;
    renderer.draw(world.state, world.state.status === 'won' ? SCREEN_WIN : SCREEN_BUSTED, result.score);
  }
  function batch() {
    if (result) return;
    for (let index = 0; index < 600; index += 1) {
      const events = world.step(world, autopilotDrive(world.state), STEP);
      steps += 1;
      if (events & EVENT_WIN) {
        finish('won');
        return;
      }
      if (events & EVENT_CLEAR) {
        world.loadLevel(world.state.levelIndex + 1);
        continue;
      }
      if (events & EVENT_BUSTED) {
        // One bust is not the end of the test: retry the floor, as a player would.
        if (world.state.stats.busts > 3) {
          finish('busted');
          return;
        }
        world.loadLevel(world.state.levelIndex);
      }
      if (world.state.time > AUTOPILOT_LIMIT_SECONDS) {
        finish('timeout');
        return;
      }
    }
    renderer.draw(world.state, SCREEN_PLAY, 0);
    setTimeout(batch, 0);
  }
  batch();
}

function runGame() {
  const audio = createAudio();
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  world.loadLevel(0);
  world.state.onCameraBeep = () => audio.cameraBeep();

  function announce(message) {
    status.textContent = message;
  }

  function playEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_TARGET) audio.targetTaken();
    if (events & EVENT_SPOTTED) audio.alertSting();
    if (events & EVENT_LOCKDOWN) audio.alertSting();
    if (events & EVENT_BUSTED) audio.caught();
    if (events & EVENT_CLEAR) audio.levelClear();
    if (events & EVENT_WIN) audio.getaway();
    if (events & EVENT_ZAPPED) audio.laserZap();
    if (events & EVENT_SMOKE) audio.smokePoof();
    if (events & EVENT_EMP) audio.empZap();
    if (events & EVENT_DOOR) audio.doorUnlock();
    if (events & EVENT_TUMBLER) audio.tumblerClick();
    if (events & EVENT_SAFE_OPEN) audio.safeOpen();
  }

  function startGame() {
    audio.unlock();
    world.loadLevel(0);
    world.state.onCameraBeep = () => audio.cameraBeep();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the Sun Idol, then reach the exit.');
  }

  function retryLevel() {
    audio.unlock();
    world.loadLevel(world.state.levelIndex);
    world.state.onCameraBeep = () => audio.cameraBeep();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Trying this floor again.');
  }

  function nextLevel() {
    audio.unlock();
    world.loadLevel(world.state.levelIndex + 1);
    world.state.onCameraBeep = () => audio.cameraBeep();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Floor ${world.state.levelIndex + 1}: ${world.state.level.name}.`);
  }

  function endGame() {
    screen = SCREEN_WIN;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Getaway! Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_BUSTED) {
      if (actions & (ACTION_CONFIRM | ACTION_RETRY)) retryLevel();
      return;
    }
    if (screen === SCREEN_CLEAR) {
      if (actions & ACTION_CONFIRM) nextLevel();
      return;
    }
    if (screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_TITLE;
        world.loadLevel(0);
        announce('Velvet Rope. Press Space to start.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function readInput() {
    const dir = input.direction();
    return {
      x: dir.x,
      y: dir.y,
      sprint: dir.sprint,
      interact: input.takeInteract(),
      smoke: input.takeSmoke(),
      emp: input.takeEmp(),
      disguise: input.takeDisguise(),
    };
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(world, readInput(), STEP);
    playEvents(events);
    if (events & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      announce('Busted! A guard caught you.');
    } else if (events & EVENT_WIN) {
      endGame();
    } else if (events & EVENT_CLEAR) {
      screen = SCREEN_CLEAR;
      announce(`Clean getaway from ${world.state.level.name}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Velvet Rope. Press Space to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (autopilot) runAutopilot();
else runGame();
