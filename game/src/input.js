// input.js — keyboard + mouse state. The game polls `keys` each frame;
// edge-triggered presses are queued in `pressed` and consumed by the
// engine once per frame, so a quick tap is never lost between frames.

export const keys = Object.create(null);
export const pressed = new Set();
export const mouse = { x: 0, y: 0, clicked: false, down: false };

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
  Space: 'sprint',
  KeyE: 'interact',
  KeyQ: 'gadget',
  KeyM: 'mute',
  Escape: 'pause',
  Enter: 'confirm',
};

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pressed.add(action);
    keys[action] = true;
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) keys[action] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
}

// True once for the frame after the key went down.
export function wasPressed(action) {
  return pressed.has(action);
}

// Call at the end of each frame: edge presses are single-frame events.
export function endFrame() {
  pressed.clear();
  mouse.clicked = false;
}
