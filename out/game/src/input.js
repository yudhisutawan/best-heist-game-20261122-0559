// Keyboard and mouse for the heist. WASD or arrows move; Shift sprints (loud); E is
// the context action (grab the target, pick a lock, work a safe); Q drops a smoke
// bomb; R fires an EMP pulse; C toggles a disguise where the level offers one; Space
// confirms on menus; P pauses; M mutes. Clicking the canvas steers the thief toward
// the clicked tile, and clicking a menu button presses it.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RETRY = 4;
export const ACTION_MUTE = 8;

const KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let clickTarget = null;
  let interactPressed = false;
  let smokePressed = false;
  let empPressed = false;
  let disguisePressed = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    const move = KEYS[event.code];
    if (move) {
      held.add(move);
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.add('sprint');
    else if (event.code === 'KeyE') interactPressed = true;
    else if (event.code === 'KeyQ') smokePressed = true;
    else if (event.code === 'KeyR') empPressed = true;
    else if (event.code === 'KeyC') disguisePressed = true;
    else if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyX') actions |= ACTION_RETRY;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    const move = KEYS[event.code];
    if (move) held.delete(move);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.delete('sprint');
  }

  function onPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    clickTarget = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointer);

  return {
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('left')) x -= 1;
      if (held.has('right')) x += 1;
      if (held.has('up')) y -= 1;
      if (held.has('down')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y, sprint: held.has('sprint') };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClickTarget() {
      const target = clickTarget;
      clickTarget = null;
      return target;
    },
    takeInteract() {
      const pressed = interactPressed;
      interactPressed = false;
      return pressed;
    },
    takeSmoke() {
      const pressed = smokePressed;
      smokePressed = false;
      return pressed;
    },
    takeEmp() {
      const pressed = empPressed;
      empPressed = false;
      return pressed;
    },
    takeDisguise() {
      const pressed = disguisePressed;
      disguisePressed = false;
      return pressed;
    },
  };
}
