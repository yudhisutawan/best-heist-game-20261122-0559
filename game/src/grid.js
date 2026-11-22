// The tile grid: what a tile is, what blocks movement and sight, and the geometry
// the guards, cameras, lasers and autopilot all share. Coordinates are pixels in
// world space (WORLD_X + col * TILE, WORLD_Y + row * TILE); tile (tx, ty) is the
// tile whose top-left corner is at that point.
import { COLS, ROWS, TILE, WORLD_X, WORLD_Y } from './config.js';

// Tiles that stop the thief and the guards.
export const SOLID = new Set(['#', 'C', 'K', 'X', 'S']);
// Tiles that stop a glance: the same solids, plus a locked door still shut.
export const SIGHT_SOLID = new Set(['#', 'C', 'K', 'X', 'S']);

export function tileCenter(tx, ty) {
  return { x: WORLD_X + (tx + 0.5) * TILE, y: WORLD_Y + (ty + 0.5) * TILE };
}

export function tileOf(x, y) {
  return {
    tx: Math.floor((x - WORLD_X) / TILE),
    ty: Math.floor((y - WORLD_Y) / TILE),
  };
}

export function inBounds(tx, ty) {
  return tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS;
}

export function tileChar(state, tx, ty) {
  if (!inBounds(tx, ty)) return '#';
  return state.map[ty][tx];
}

// A locked door is solid until picked; an open one is floor.
export function doorAt(state, tx, ty) {
  for (let index = 0; index < state.doors.length; index += 1) {
    const door = state.doors[index];
    if (door.tx === tx && door.ty === ty) return door;
  }
  return null;
}

export function solidAt(state, tx, ty) {
  const ch = tileChar(state, tx, ty);
  if (SOLID.has(ch)) return true;
  if (ch === 'L') {
    const door = doorAt(state, tx, ty);
    return !door || !door.open;
  }
  return false;
}

export function blocksSightAt(state, tx, ty) {
  const ch = tileChar(state, tx, ty);
  if (SIGHT_SOLID.has(ch)) return true;
  if (ch === 'L') {
    const door = doorAt(state, tx, ty);
    return !door || !door.open;
  }
  return false;
}

// True when the segment between two points crosses no sight-blocking tile.
export function lineOfSight(state, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const { tx, ty } = tileOf(x1 + dx * t, y1 + dy * t);
    if (blocksSightAt(state, tx, ty)) return false;
  }
  return true;
}

// Is the point inside any smoke cloud?
export function inSmoke(state, x, y) {
  for (let index = 0; index < state.smokes.length; index += 1) {
    const smoke = state.smokes[index];
    if (Math.hypot(x - smoke.x, y - smoke.y) < smoke.radius) return true;
  }
  return false;
}

// Does the segment pass through smoke? A cloud hides whatever is behind it.
export function smokeBetween(state, x1, y1, x2, y2) {
  for (let index = 0; index < state.smokes.length; index += 1) {
    const smoke = state.smokes[index];
    if (distanceToSegment(smoke.x, smoke.y, x1, y1, x2, y2) < smoke.radius) return true;
  }
  return false;
}

export function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Move a circle (entity with x, y, radius) by (dx, dy), axis by axis, sliding
// along solid tiles instead of stopping dead.
export function moveCircle(state, entity, dx, dy) {
  const r = entity.radius;
  if (dx !== 0) {
    const nx = entity.x + dx;
    if (!circleHitsSolid(state, nx, entity.y, r)) entity.x = nx;
  }
  if (dy !== 0) {
    const ny = entity.y + dy;
    if (!circleHitsSolid(state, entity.x, ny, r)) entity.y = ny;
  }
}

export function circleHitsSolid(state, x, y, r) {
  const left = Math.floor((x - r - WORLD_X) / TILE);
  const right = Math.floor((x + r - WORLD_X) / TILE);
  const top = Math.floor((y - r - WORLD_Y) / TILE);
  const bottom = Math.floor((y + r - WORLD_Y) / TILE);
  for (let ty = top; ty <= bottom; ty += 1) {
    for (let tx = left; tx <= right; tx += 1) {
      if (!solidAt(state, tx, ty)) continue;
      const cx = Math.max(WORLD_X + tx * TILE, Math.min(x, WORLD_X + (tx + 1) * TILE));
      const cy = Math.max(WORLD_Y + ty * TILE, Math.min(y, WORLD_Y + (ty + 1) * TILE));
      if (Math.hypot(x - cx, y - cy) < r) return true;
    }
  }
  return false;
}

// Breadth-first path over walkable tiles from (fromTx, fromTy) to (toTx, toTy).
// `cost(tx, ty)` adds a penalty per tile (danger, detours); null from cost means
// the tile is off-limits. Returns a list of tile centres, start excluded.
export function planPath(state, fromTx, fromTy, toTx, toTy, cost) {
  const key = (x, y) => `${x},${y}`;
  const open = [{ x: fromTx, y: fromTy, g: 0 }];
  const came = new Map([[key(fromTx, fromTy), null]]);
  const costSoFar = new Map([[key(fromTx, fromTy), 0]]);
  let head = 0;
  while (head < open.length) {
    // Cheapest first: the queue is tiny (420 tiles), a linear scan is fine.
    let best = head;
    for (let index = head + 1; index < open.length; index += 1) {
      if (open[index].g < open[best].g) best = index;
    }
    const current = open[best];
    open[best] = open[head];
    open[head] = current;
    head += 1;
    if (current.x === toTx && current.y === toTy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!inBounds(nx, ny)) continue;
      const stepCost = cost ? cost(nx, ny) : 1;
      if (stepCost === null) continue;
      const next = current.g + stepCost;
      const k = key(nx, ny);
      if (costSoFar.has(k) && costSoFar.get(k) <= next) continue;
      costSoFar.set(k, next);
      came.set(k, key(current.x, current.y));
      open.push({ x: nx, y: ny, g: next });
    }
  }
  if (!came.has(key(toTx, toTy))) return null;
  const path = [];
  let cursor = key(toTx, toTy);
  while (cursor !== null && cursor !== key(fromTx, fromTy)) {
    const [x, y] = cursor.split(',').map(Number);
    path.unshift(tileCenter(x, y));
    cursor = came.get(cursor);
  }
  return path;
}
