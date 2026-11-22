// main.js — bootstrap for VAULTBREAK.
//
// Wires the canvas, the input, the engine and the renderer together, runs
// the fixed-step loop, routes menu clicks, honours ?scene= / ?mission=
// query modes, and exposes a small read-only debug handle (window.__vb)
// that the playtest bot uses to assert the game actually changes state.

import { MISSIONS, COLS, ROWS } from './maps.js';
import { createGame, startMission, update, alarmLevel, W, H } from './engine.js';
import { render } from './render.js';
import { initInput, endFrame, mouse, wasPressed, keys } from './input.js';
import { applyScene } from './scenes.js';
import { ensureAudio, toggleMute } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

// Defensive map check: a bad grid must fail loudly at load, never ship.
function validateMaps() {
  for (const m of MISSIONS) {
    if (m.grid.length !== ROWS) throw new Error(m.name + ': grid has ' + m.grid.length + ' rows, need ' + ROWS);
    m.grid.forEach((row, i) => {
      if (row.length !== COLS) throw new Error(m.name + ' row ' + i + ': length ' + row.length + ', need ' + COLS);
    });
    const flat = m.grid.join('');
    for (const ch of ['P', 'T', 'X']) {
      const n = flat.split(ch).length - 1;
      if (n !== 1) throw new Error(m.name + ': needs exactly one ' + ch + ', has ' + n);
    }
  }
}

const state = createGame();
state.missionList = MISSIONS;
initInput(canvas);
validateMaps();

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') || params.get('shot');
const missionParam = params.get('mission');

// --- menu actions ------------------------------------------------------------
function clickButton(id) {
  ensureAudio();
  if (id === 'play') {
    // continue at the highest unlocked job
    const idx = Math.min(state.save.unlocked, 4) - 1;
    openCrew(idx);
  } else if (id === 'missions') {
    state.screen = 'missions';
  } else if (id === 'howto') {
    state.screen = 'howto';
  } else if (id === 'back') {
    state.screen = 'title';
  } else if (id.startsWith('mission:')) {
    openCrew(Number(id.split(':')[1]));
  } else if (id.startsWith('gadget:')) {
    state.crewSel = Number(id.split(':')[1]);
  } else if (id === 'start') {
    startMission(state, state.crewMission, state.missionList[state.crewMission].gadgets[state.crewSel]);
  } else if (id === 'resume') {
    state.screen = 'play';
  } else if (id === 'restart') {
    startMission(state, state.missionIndex, state.gadgetId);
  } else if (id === 'quit') {
    state.screen = 'title';
    state.mission = null;
  } else if (id === 'retry') {
    startMission(state, state.missionIndex, state.gadgetId);
  } else if (id === 'replay') {
    startMission(state, state.missionIndex, state.gadgetId);
  } else if (id === 'next') {
    if (state.missionIndex < 3) openCrew(state.missionIndex + 1);
    else state.screen = 'title';
  }
}

function openCrew(index) {
  state.crewMission = index;
  state.crewSel = 0;
  state.screen = 'crew';
}

function handleMenuKeys() {
  if (wasPressed('confirm') || wasPressed('interact')) {
    if (state.screen === 'title') clickButton('play');
    else if (state.screen === 'crew') clickButton('start');
    else if (state.screen === 'complete') clickButton('next');
    else if (state.screen === 'busted') clickButton('retry');
    else if (state.screen === 'paused') clickButton('resume');
  }
  if (state.screen === 'crew') {
    if (wasPressed('left') || wasPressed('up')) state.crewSel = 0;
    if (wasPressed('right') || wasPressed('down')) state.crewSel = 1;
  }
  if (wasPressed('mute')) toggleMute();
  if (state.screen === 'title' && wasPressed('pause')) { /* nothing */ }
}

// --- debug handle (read-only state for the playtest bot) -----------------------
window.__vb = {
  state,
  startMission: (i, g) => startMission(state, i, g),
  applyScene: (name) => applyScene(state, name),
  alarmLevel: () => alarmLevel(state),
  version: 'vaultbreak-1.0.0',
};

// --- modes ---------------------------------------------------------------------
if (sceneName) {
  applyScene(state, sceneName);
} else if (missionParam) {
  const idx = Math.max(0, Math.min(3, Number(missionParam) - 1 || 0));
  startMission(state, idx, MISSIONS[idx].gadgets[0]);
}

if (state.screen === 'title' || !state.mission) {
  statusEl.textContent = 'VAULTBREAK — The Meridian Job. A top-down stealth heist: steal the target and reach the getaway without being seen.';
}

// --- main loop -------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // menu clicks (mouse.clicked is a single-frame edge)
  if (mouse.clicked) {
    for (const b of state.ui || []) {
      if (!b.disabled && mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h) {
        clickButton(b.id);
        break;
      }
    }
  }

  if (state.screen === 'title' || state.screen === 'howto' || state.screen === 'missions'
    || state.screen === 'crew' || state.screen === 'complete' || state.screen === 'busted') {
    handleMenuKeys();
  }
  update(state, dt);
  render(state, ctx);
  endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
