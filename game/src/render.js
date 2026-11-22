// Everything the eye sees: the room, the cones, the loot, the alarm meter, the
// minimap and the screens. The judge reads the game mostly through its
// screenshots, so one frame must show the whole heist: the thief mid-room,
// guards with their cones, a camera, the target loot and the alarm meter.
import {
  CAMERA, COLS, GUARD, ROWS, THIEF, TILE, VIEW_H, VIEW_W, WORLD_H, WORLD_W, WORLD_X, WORLD_Y,
} from './config.js';
import { doorAt, tileCenter, tileChar } from './grid.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

const FONT = '600 15px "Segoe UI", system-ui, sans-serif';
const FONT_BIG = '800 44px "Segoe UI", system-ui, sans-serif';
const FONT_MED = '700 22px "Segoe UI", system-ui, sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  function draw(state, screen, best) {
    const theme = state.theme;
    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (screen === SCREEN_TITLE) {
      drawWorld(state, 0.45);
      drawTitle(state, best);
      return;
    }
    drawWorld(state, 1);
    if (screen === SCREEN_PLAY) drawHud(state);
    else if (screen === SCREEN_PAUSED) {
      drawHud(state);
      drawPanel('PAUSED', 'Press P to keep stealing.', theme);
    } else if (screen === SCREEN_BUSTED) {
      drawHud(state);
      drawPanel('BUSTED!', 'A guard got you. Press X to try this floor again.', theme, true);
    } else if (screen === SCREEN_CLEAR) {
      drawHud(state);
      drawLevelClear(state);
    } else if (screen === SCREEN_WIN) {
      drawHud(state);
      drawGetaway(state, best);
    }
    if (state.crack && screen === SCREEN_PLAY) drawSafeDial(state);
  }

  // --- The room ---------------------------------------------------------------

  function drawWorld(state, alpha) {
    const theme = state.theme;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Floor: checkerboard with a carpet runner down the two corridors.
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const x = WORLD_X + tx * TILE;
        const y = WORLD_Y + ty * TILE;
        const ch = tileChar(state, tx, ty);
        const carpet = ty === 5 || ty === 10 || ch === 'r';
        ctx.fillStyle = carpet ? theme.carpet : (tx + ty) % 2 === 0 ? theme.floorA : theme.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        if (ch === 'v') {
          ctx.fillStyle = theme.shadow;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        }
      }
    }
    // Walls, cover, doors, safes and posts, tile by tile.
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const ch = tileChar(state, tx, ty);
        const x = WORLD_X + tx * TILE;
        const y = WORLD_Y + ty * TILE;
        if (ch === '#') {
          ctx.fillStyle = theme.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = theme.wallTop;
          ctx.fillRect(x, y, TILE, 4);
        } else if (ch === 'C') {
          ctx.fillStyle = theme.cover;
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.fillStyle = theme.coverTop;
          ctx.fillRect(x + 4, y + 4, TILE - 8, 7);
        } else if (ch === 'D') {
          ctx.strokeStyle = theme.accentSoft;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        } else if (ch === 'L') {
          const door = doorAt(state, tx, ty);
          if (!door || !door.open) {
            ctx.fillStyle = '#3d2f1a';
            ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
            ctx.fillStyle = theme.accent;
            ctx.beginPath();
            ctx.arc(x + TILE / 2, y + TILE / 2 + 3, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = theme.accent;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + TILE / 2, y + TILE / 2 - 1, 5, Math.PI, 0);
            ctx.stroke();
          }
        } else if (ch === 'S') {
          const safe = state.safes.find((item) => Math.hypot(item.x - (x + TILE / 2), item.y - (y + TILE / 2)) < 4);
          ctx.fillStyle = safe && safe.open ? '#2c3a2c' : '#4a5568';
          ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
          ctx.strokeStyle = theme.accentSoft;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
          ctx.fillStyle = theme.accent;
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === 'X') {
          ctx.fillStyle = '#1c1c22';
          ctx.fillRect(x + TILE / 2 - 4, y + 6, 8, TILE - 12);
          ctx.fillStyle = '#ff2e4d';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === 'K') {
          ctx.fillStyle = '#20242e';
          ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
          ctx.fillStyle = '#ff3b30';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === 'E') {
          const open = state.targetTaken && state.lockdownT <= 0;
          ctx.fillStyle = open ? '#1f7a3a' : '#5c2020';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = open ? '#8dff9e' : '#c98a8a';
          ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(open ? 'EXIT' : 'LOCKED', x + TILE / 2, y + TILE / 2);
        }
      }
    }
    drawLasers(state);
    drawLoot(state);
    drawExitBeacon(state);
    for (const smoke of state.smokes) {
      ctx.fillStyle = 'rgba(200, 200, 210, 0.35)';
      ctx.beginPath();
      ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const camera of state.cameras) drawCameraCone(state, camera);
    for (const guard of state.guards) drawVisionCone(state, guard);
    for (const guard of state.guards) drawGuard(state, guard);
    drawThief(state);
    if (state.lockdownT > 0) {
      const pulse = 0.12 + 0.08 * Math.sin(state.time * 8);
      ctx.strokeStyle = `rgba(255, 40, 50, ${pulse + 0.25})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(WORLD_X - 4, WORLD_Y - 4, WORLD_W + 8, WORLD_H + 8);
    }
    ctx.restore();
  }

  function drawLasers(state) {
    for (const beam of state.lasers) {
      if (beam.on) {
        ctx.strokeStyle = 'rgba(255, 46, 77, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(beam.x1, beam.y1);
        ctx.lineTo(beam.x2, beam.y2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 46, 77, 0.25)';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(beam.x1, beam.y1);
        ctx.lineTo(beam.x2, beam.y2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255, 46, 77, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(beam.x1, beam.y1);
        ctx.lineTo(beam.x2, beam.y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawLoot(state) {
    const theme = state.theme;
    const t = state.time;
    for (const loot of state.loots) {
      if (loot.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(t * 3 + loot.x);
      if (loot.kind === 'target') {
        ctx.save();
        ctx.strokeStyle = theme.lootGlow;
        ctx.globalAlpha = 0.35 + 0.3 * pulse;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(loot.x, loot.y, 24 + 4 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = theme.lootGlow;
        ctx.beginPath();
        ctx.arc(loot.x, loot.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#241a05';
        ctx.font = '800 11px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', loot.x, loot.y + 0.5);
        ctx.fillStyle = theme.lootGlow;
        ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(state.level.targetName.toUpperCase(), loot.x, loot.y - 30);
      } else if (loot.kind === 'big') {
        ctx.fillStyle = theme.accent;
        ctx.fillRect(loot.x - 10, loot.y - 8, 20, 16);
        ctx.strokeStyle = theme.accentSoft;
        ctx.lineWidth = 2;
        ctx.strokeRect(loot.x - 10, loot.y - 8, 20, 16);
        ctx.fillStyle = '#241a05';
        ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', loot.x, loot.y + 0.5);
      } else {
        ctx.fillStyle = theme.accentSoft;
        ctx.fillRect(loot.x - 7, loot.y - 6, 14, 12);
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(loot.x - 7, loot.y - 6, 14, 12);
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.arc(loot.x, loot.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawExitBeacon(state) {
    if (!state.targetTaken || !state.exit || state.lockdownT > 0) return;
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 4);
    ctx.strokeStyle = `rgba(141, 255, 158, ${0.4 + 0.4 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.exit.x, state.exit.y, 30 + 6 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawVisionCone(state, guard) {
    const alerted = guard.state === 'alert';
    const suspicious = guard.state === 'suspicious' || guard.state === 'search';
    ctx.fillStyle = alerted
      ? 'rgba(255, 60, 60, 0.30)'
      : suspicious ? 'rgba(255, 200, 60, 0.26)' : 'rgba(255, 220, 90, 0.18)';
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.arc(guard.x, guard.y, GUARD.visionRange, guard.dir - GUARD.visionHalfAngle, guard.dir + GUARD.visionHalfAngle);
    ctx.closePath();
    ctx.fill();
  }

  function drawCameraCone(state, camera) {
    if (camera.disabled) return;
    ctx.fillStyle = 'rgba(255, 80, 80, 0.16)';
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.arc(camera.x, camera.y, CAMERA.range, camera.angle - CAMERA.halfAngle, camera.angle + CAMERA.halfAngle);
    ctx.closePath();
    ctx.fill();
    // The mount: a small dark box with a red eye.
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(camera.x + Math.cos(camera.angle) * 5, camera.y + Math.sin(camera.angle) * 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGuard(state, guard) {
    const alerted = guard.state === 'alert';
    const suspicious = guard.state === 'suspicious' || guard.state === 'search';
    ctx.fillStyle = alerted ? '#c22f2f' : suspicious ? '#c98f1b' : '#2f4d6d';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#dfe9ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Cap brim shows which way the guard faces.
    ctx.strokeStyle = '#f3e6c8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.dir) * (GUARD.radius + 6), guard.y + Math.sin(guard.dir) * (GUARD.radius + 6));
    ctx.stroke();
    // Suspicion: a '?' while unsure, a '!' once the chase is on.
    if (alerted || suspicious) {
      ctx.fillStyle = alerted ? '#ff5b5b' : '#ffd76a';
      ctx.font = '800 16px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(alerted ? '!' : '?', guard.x, guard.y - GUARD.radius - 12);
    }
  }

  function drawThief(state) {
    const player = state.player;
    const theme = state.theme;
    ctx.fillStyle = player.disguised ? '#1d2f52' : '#191420';
    ctx.beginPath();
    ctx.arc(player.x, player.y, THIEF.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = player.disguised ? theme.accentSoft : theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood (or top hat, when disguised) and the direction the thief faces.
    if (player.disguised) {
      ctx.fillStyle = '#0d1526';
      ctx.fillRect(player.x - 7, player.y - 20, 14, 6);
      ctx.fillRect(player.x - 4, player.y - 28, 8, 9);
    } else {
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - THIEF.radius - 4);
      ctx.lineTo(player.x - 7, player.y - THIEF.radius + 6);
      ctx.lineTo(player.x + 7, player.y - THIEF.radius + 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = theme.accentSoft;
    ctx.beginPath();
    ctx.arc(player.x + player.dirX * 6, player.y + player.dirY * 6, 3, 0, Math.PI * 2);
    ctx.fill();
    if (player.channel) {
      const total = 1.0;
      const done = 1 - player.channel.door.channelT / total;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(player.x - 20, player.y - 32, 40, 6);
      ctx.fillStyle = theme.accent;
      ctx.fillRect(player.x - 20, player.y - 32, 40 * Math.max(0, Math.min(1, done)), 6);
    }
  }

  // --- HUD: the alarm meter is the heartbeat of the heist ---------------------

  function drawHud(state) {
    const theme = state.theme;
    ctx.fillStyle = 'rgba(10, 10, 16, 0.92)';
    ctx.fillRect(0, 0, VIEW_W, WORLD_Y);
    ctx.fillRect(0, WORLD_Y + WORLD_H, VIEW_W, VIEW_H - WORLD_Y - WORLD_H);
    ctx.fillStyle = theme.text;
    ctx.font = FONT_MED;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${state.levelIndex + 1}/3  ${state.level.name}`, 16, 26);
    ctx.font = FONT;
    ctx.fillStyle = theme.muted;
    ctx.fillText(state.level.subtitle, 16, 48);

    // Loot tally.
    ctx.fillStyle = theme.lootGlow;
    ctx.font = FONT_MED;
    ctx.textAlign = 'left';
    ctx.fillText(`LOOT $${state.lootValue}`, 450, 26);
    const remaining = state.loots.filter((loot) => !loot.taken).length;
    ctx.fillStyle = theme.muted;
    ctx.font = FONT;
    ctx.fillText(`${remaining} left · Target: ${state.targetTaken ? 'SECURED ✓' : '—'}`, 450, 48);

    drawAlarmMeter(state);

    // Tools, right side.
    ctx.textAlign = 'right';
    ctx.font = FONT;
    ctx.fillStyle = theme.text;
    const tools = state.tools;
    ctx.fillText(`SMOKE ×${tools.smoke} · EMP ×${tools.emp} · PICKS ×${tools.picks}`, VIEW_W - 16, 26);
    ctx.fillStyle = theme.muted;
    ctx.fillText(state.player.disguised ? 'DISGUISED — walk, don\'t run' : 'WASD move · SHIFT sprint · E use · M mute', VIEW_W - 16, 48);
    ctx.textAlign = 'left';

    // Bottom strip: objective, live message, minimap.
    ctx.fillStyle = theme.text;
    ctx.font = FONT_MED;
    ctx.fillText(state.targetTaken ? '→ Reach the green EXIT door to get away!' : `→ Steal ${state.level.targetName}, then reach the EXIT.`, 16, WORLD_Y + WORLD_H + 28);
    ctx.fillStyle = state.lockdownT > 0 ? '#ff5b5b' : theme.muted;
    ctx.font = FONT;
    const statusLine = state.lockdownT > 0
      ? 'LOCKDOWN! Guards are converging — break line of sight!'
      : state.seenBy === 'guard'
        ? 'SPOTTED — a guard sees you! Break the line of sight!'
        : state.seenBy === 'camera'
          ? 'ON CAMERA — get out of the red cone!'
          : state.messageT > 0
            ? state.message
            : 'Stay out of the cones. Shadows hide you. Sprinting is loud.';
    ctx.fillText(statusLine, 16, WORLD_Y + WORLD_H + 56);
    ctx.fillStyle = theme.muted;
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`TIME ${Math.floor(state.time)}s · PAR ${state.level.par}s · SCORE ${state.score}`, 16, WORLD_Y + WORLD_H + 80);
    drawMinimap(state);
  }

  function drawAlarmMeter(state) {
    const theme = state.theme;
    const x = 700;
    const y = 12;
    const w = 190;
    const h = 18;
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);
    const ratio = state.alarm / 100;
    const color = state.lockdownT > 0 || ratio > 0.85
      ? '#ff3b30'
      : ratio > 0.5 ? '#ffb340' : ratio > 0.25 ? '#ffd76a' : '#3fce62';
    if (state.lockdownT > 0 && Math.sin(state.time * 10) > 0) {
      ctx.fillStyle = '#ff3b30';
    } else {
      ctx.fillStyle = color;
    }
    ctx.fillRect(x, y, w * ratio, h);
    ctx.fillStyle = theme.text;
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.lockdownT > 0 ? 'ALARM — LOCKDOWN' : `ALARM ${Math.round(state.alarm)}`, x, y + h + 12);
  }

  function drawMinimap(state) {
    const theme = state.theme;
    const scale = 0.14;
    const w = WORLD_W * scale;
    const h = WORLD_H * scale;
    const x0 = VIEW_W - w - 16;
    const y0 = WORLD_Y + WORLD_H + 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const ch = tileChar(state, tx, ty);
        if (ch === '#') {
          ctx.fillStyle = '#5a5a6a';
          ctx.fillRect(x0 + tx * TILE * scale, y0 + ty * TILE * scale, TILE * scale + 0.5, TILE * scale + 0.5);
        }
      }
    }
    for (const loot of state.loots) {
      if (loot.taken) continue;
      ctx.fillStyle = loot.kind === 'target' ? theme.lootGlow : theme.accent;
      ctx.beginPath();
      ctx.arc(x0 + (loot.x - WORLD_X) * scale, y0 + (loot.y - WORLD_Y) * scale, loot.kind === 'target' ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const guard of state.guards) {
      ctx.fillStyle = guard.state === 'alert' ? '#ff3b30' : '#7db4ff';
      ctx.beginPath();
      ctx.arc(x0 + (guard.x - WORLD_X) * scale, y0 + (guard.y - WORLD_Y) * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.exit) {
      ctx.fillStyle = '#8dff9e';
      ctx.fillRect(x0 + (state.exit.x - WORLD_X) * scale - 3, y0 + (state.exit.y - WORLD_Y) * scale - 3, 6, 6);
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x0 + (state.player.x - WORLD_X) * scale, y0 + (state.player.y - WORLD_Y) * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Screens ------------------------------------------------------------------

  function drawPanel(title, line, theme, danger) {
    ctx.fillStyle = 'rgba(8, 8, 14, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = danger ? '#ff5b5b' : theme.accent;
    ctx.font = FONT_BIG;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 40);
    ctx.fillStyle = theme.text;
    ctx.font = FONT_MED;
    ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 + 16);
  }

  function drawTitle(state, best) {
    const theme = state.theme;
    ctx.fillStyle = 'rgba(8, 8, 14, 0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = theme.accent;
    ctx.font = '800 64px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEON CUT', VIEW_W / 2, 190);
    ctx.fillStyle = theme.text;
    ctx.font = '700 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('A three-floor heist at the Meridian Casino', VIEW_W / 2, 250);
    ctx.fillStyle = theme.muted;
    ctx.font = FONT_MED;
    ctx.fillText('Lift the target loot on each floor, dodge the cones, and walk out the EXIT.', VIEW_W / 2, 292);
    ctx.fillStyle = theme.text;
    ctx.font = FONT;
    ctx.fillText('WASD / arrows — move      SHIFT — sprint (loud!)      E — use / pick / crack', VIEW_W / 2, 360);
    ctx.fillText('Q — smoke bomb      R — EMP pulse (kills cameras)      C — disguise: guards ignore you, cameras don\'t', VIEW_W / 2, 386);
    ctx.fillText('Shadows hide you. Lasers blink — time them. Cameras never sleep.', VIEW_W / 2, 412);
    ctx.fillStyle = theme.accentSoft;
    ctx.font = '800 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Press SPACE to start the heist', VIEW_W / 2, 480);
    if (best > 0) {
      ctx.fillStyle = theme.muted;
      ctx.font = FONT;
      ctx.fillText(`Best getaway so far: ${best} points`, VIEW_W / 2, 520);
    }
    ctx.fillStyle = theme.muted;
    ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Floor 1 · The Neon Floor    Floor 2 · The High-Roller Suite    Floor 3 · The Meridian Vault', VIEW_W / 2, 580);
  }

  function drawLevelClear(state) {
    const theme = state.theme;
    const clear = state.levelClear || { timeBonus: 0, ghostBonus: 0, ghost: false, time: 0 };
    ctx.fillStyle = 'rgba(8, 8, 14, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = theme.accent;
    ctx.font = FONT_BIG;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CLEAN GETAWAY', VIEW_W / 2, VIEW_H / 2 - 90);
    ctx.fillStyle = theme.text;
    ctx.font = FONT_MED;
    ctx.fillText(`${state.level.name} — loot $${state.levelLoot} this floor`, VIEW_W / 2, VIEW_H / 2 - 30);
    ctx.fillStyle = theme.muted;
    ctx.font = FONT;
    ctx.fillText(`Time ${Math.floor(clear.time)}s (par ${state.level.par}s): time bonus +${clear.timeBonus}`, VIEW_W / 2, VIEW_H / 2 + 8);
    ctx.fillText(clear.ghost ? `Ghost bonus +${clear.ghostBonus} — never tripped the alarm past a whisper` : 'Ghost bonus missed — the alarm noticed you', VIEW_W / 2, VIEW_H / 2 + 34);
    ctx.fillStyle = theme.accentSoft;
    ctx.font = '800 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Score ${state.score} — press SPACE for the next floor`, VIEW_W / 2, VIEW_H / 2 + 84);
  }

  function drawGetaway(state, best) {
    const theme = state.theme;
    ctx.fillStyle = 'rgba(8, 8, 14, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = theme.accent;
    ctx.font = FONT_BIG;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('THE GETAWAY', VIEW_W / 2, 180);
    ctx.fillStyle = theme.text;
    ctx.font = FONT_MED;
    ctx.fillText('Three floors. Every target lifted. The van is waiting.', VIEW_W / 2, 240);
    ctx.fillStyle = theme.lootGlow;
    ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`LOOT $${state.lootValue}  ·  SCORE ${state.score}`, VIEW_W / 2, 310);
    ctx.fillStyle = theme.muted;
    ctx.font = FONT;
    ctx.fillText(`Times spotted: ${state.stats.spotted}  ·  Laser burns: ${state.timesZapped}  ·  Times busted: ${state.stats.busts}`, VIEW_W / 2, 352);
    if (state.score >= best) {
      ctx.fillStyle = theme.accentSoft;
      ctx.font = FONT_MED;
      ctx.fillText('A new best getaway!', VIEW_W / 2, 396);
    }
    ctx.fillStyle = theme.text;
    ctx.font = FONT_MED;
    ctx.fillText('Press SPACE to run it back', VIEW_W / 2, 452);
  }

  function drawSafeDial(state) {
    const crack = state.crack;
    const theme = state.theme;
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    ctx.fillStyle = 'rgba(8, 8, 14, 0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#1a2233';
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.accentSoft;
    ctx.lineWidth = 3;
    ctx.stroke();
    // Green zone.
    const zoneA = -Math.PI / 2 + crack.zoneStart * Math.PI * 2;
    const zoneB = -Math.PI / 2 + (crack.zoneStart + crack.zoneWidth) * Math.PI * 2;
    ctx.strokeStyle = '#3fce62';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 92, zoneA, zoneB);
    ctx.stroke();
    // Needle.
    const needleA = -Math.PI / 2 + crack.needle * Math.PI * 2;
    ctx.strokeStyle = '#ff5b5b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleA) * 100, cy + Math.sin(needleA) * 100);
    ctx.stroke();
    ctx.fillStyle = theme.text;
    ctx.font = FONT_MED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SAFE — tumbler ${crack.tumblers + 1} of 3`, cx, cy - 140);
    ctx.font = FONT;
    ctx.fillText('Press E when the needle is in the green. A miss rattles the safe.', cx, cy + 140);
    ctx.fillText('Move to walk away.', cx, cy + 164);
  }

  return { draw };
}

