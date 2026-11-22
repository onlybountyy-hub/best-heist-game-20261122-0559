// engine.js — VAULTBREAK game state and update logic.
//
// Screens: title, howto, missions, crew, intro, play, paused, complete,
// busted. Everything the judge sees in a screenshot comes from one of
// these states; ?scene= modes (scenes.js) freeze 'play' mid-action.

import { MISSIONS, TILE, COLS, ROWS, HUD_H, GADGETS, parseGrid, blocksMove, isWallAt } from './maps.js';
import { mulberry32, clamp, lerp, dist, angleTo, angleDiff } from './random.js';
import { keys, wasPressed, mouse } from './input.js';
import { sfx, startDrill, stopDrill, ensureAudio, toggleMute } from './audio.js';

export const W = 1280;
export const H = 720;
export const SAVE_KEY = 'vaultbreak-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { unlocked: 1, best: {} };
    const s = JSON.parse(raw);
    return { unlocked: clamp(s.unlocked | 0, 1, 4), best: s.best || {} };
  } catch {
    return { unlocked: 1, best: {} };
  }
}

export function storeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

// --- line of sight -------------------------------------------------------
export function tileAtPx(parsed, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor((py - HUD_H) / TILE);
  return { tx, ty };
}

export function pointBlocked(parsed, px, py) {
  const { tx, ty } = tileAtPx(parsed, px, py);
  return blocksMove(parsed, tx, ty);
}

// Step along the segment in 6px hops; a wall anywhere blocks the view.
export function hasLOS(parsed, x0, y0, x1, y1) {
  const d = dist(x0, y0, x1, y1);
  const steps = Math.max(1, Math.ceil(d / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointBlocked(parsed, lerp(x0, x1, t), lerp(y0, y1, t))) return false;
  }
  return true;
}

export function inCone(ox, oy, angle, range, half, px, py) {
  const d = dist(ox, oy, px, py);
  if (d > range) return false;
  if (d < 14) return true;
  return Math.abs(angleDiff(angle, angleTo(ox, oy, px, py))) <= half;
}

// Is the segment blocked by a smoke cloud? (Guards cannot see through smoke.)
function smokeBlocks(state, x0, y0, x1, y1) {
  for (const c of state.smoke) {
    // cheap test: does the segment pass within the cloud radius?
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (dist(mx, my, c.x, c.y) < c.r * 0.8) return true;
    if (dist(x0, y0, c.x, c.y) < c.r || dist(x1, y1, c.x, c.y) < c.r) return true;
  }
  return false;
}

// --- game state ----------------------------------------------------------
export function createGame() {
  return {
    screen: 'title',
    save: loadSave(),
    missionIndex: 0,
    mission: null,
    parsed: null,
    rng: mulberry32(1),
    time: 0,          // wall-clock seconds since page load (drives animation)
    playTime: 0,      // seconds inside the current mission
    frozen: false,    // ?scene= modes: render a fixed moment, do not update
    sceneTime: 0,     // fixed clock used by frozen renders
    player: null,
    guards: [],
    cameras: [],
    civilians: [],
    noiseRings: [],
    smoke: [],
    alarm: 0,         // 0..3 float; level = floor
    alarmsRaised: 0,
    loot: 0,
    weight: 0,
    targetTaken: false,
    ghost: true,      // still true while nobody has ever spotted the thief
    bustedReason: '',
    lockpick: null,   // {kind, ref, needle, dir, speed, zone, hits, needed}
    drill: null,      // {ref, progress}
    hold: null,       // {kind, ref, progress, needed, label}
    interactTarget: null,
    gadgetId: null,
    gadgetCharges: 0,
    disguise: 0,
    empStun: 0,
    reinforcements: false,
    banner: null,     // {text, sub, t} transient center message
    menuSel: 0,
    crewSel: 0,
    flash: 0,         // red screen flash timer (spotted / laser)
    stepTimer: 0,
    sprintNoiseTimer: 0,
    complete: null,   // {loot, time, alarms, ghost, bonus, total}
    debug: {},
  };
}

export function alarmLevel(state) {
  return Math.min(3, Math.floor(state.alarm + 0.0001));
}

const ALARM_NAMES = ['CALM', 'SUSPICIOUS', 'HUNTED', 'LOCKDOWN'];

// --- mission setup -------------------------------------------------------
export function startMission(state, index, gadgetId) {
  const mission = MISSIONS[index];
  const parsed = parseGrid(mission);
  const rng = mulberry32(mission.seed);
  state.missionIndex = index;
  state.mission = mission;
  state.parsed = parsed;
  state.rng = rng;
  state.playTime = 0;
  state.alarm = 0;
  state.alarmsRaised = 0;
  state.loot = 0;
  state.weight = 0;
  state.targetTaken = false;
  state.ghost = true;
  state.lockpick = null;
  state.drill = null;
  state.hold = null;
  state.noiseRings = [];
  state.smoke = [];
  state.gadgetId = gadgetId || null;
  state.gadgetCharges = gadgetId ? (GADGETS[gadgetId].charges || 0) : 0;
  state.disguise = 0;
  state.empStun = 0;
  state.reinforcements = false;
  state.flash = 0;
  state.complete = null;
  state.bustedReason = '';
  state.banner = { text: mission.name, sub: mission.subtitle + ' — ' + mission.targetName, t: 3.2 };
  const p = parsed.player;
  state.player = {
    x: (p.x + 0.5) * TILE,
    y: HUD_H + (p.y + 0.5) * TILE,
    angle: -Math.PI / 2,
    sneak: false,
    sprint: false,
    moving: false,
    stepPhase: 0,
  };
  state.guards = mission.guards.map((g) => ({
    x: (g.x + 0.5) * TILE,
    y: HUD_H + (g.y + 0.5) * TILE,
    angle: 0,
    state: 'patrol',
    suspicion: 0,
    waypoints: g.waypoints.map(([wx, wy]) => ({ x: (wx + 0.5) * TILE, y: HUD_H + (wy + 0.5) * TILE })),
    wp: 0,
    pauseTimer: 0.4 + rng() * 0.8,
    scanDir: 1,
    lastSeen: null,
    searchPoints: [],
    searchIndex: 0,
    searchTimer: 0,
    loseTimer: 0,
    stun: 0,
    alertCooldown: 0,
    home: { x: (g.x + 0.5) * TILE, y: HUD_H + (g.y + 0.5) * TILE },
  }));
  state.cameras = mission.cameras.map((c) => ({
    x: (c.x + 0.5) * TILE,
    y: HUD_H + (c.y + 0.5) * TILE,
    base: c.base,
    sweep: c.sweep,
    speed: c.speed,
    phase: rng() * Math.PI * 2,
    angle: c.base,
    disabled: 0,
    spotTimer: 0,
    cooldown: 0,
  }));
  state.civilians = (mission.civilians || []).map((c) => ({
    x: (c.x + 0.5) * TILE,
    y: HUD_H + (c.y + 0.5) * TILE,
    angle: rng() * Math.PI * 2,
    tx: (c.x + 0.5) * TILE,
    ty: HUD_H + (c.y + 0.5) * TILE,
    pause: rng() * 2,
    hue: rng(),
  }));
  state.screen = 'play';
}

export function emitNoise(state, x, y, radius) {
  state.noiseRings.push({ x, y, r: 8, maxR: radius, speed: 260 });
  for (const g of state.guards) {
    if (g.state === 'alert') continue;
    if (dist(g.x, g.y, x, y) <= radius + 40) {
      g.state = 'suspicious';
      g.lastSeen = { x, y };
      g.suspicion = Math.max(g.suspicion, 0.55);
    }
  }
}

function raiseAlarm(state, amount, reason) {
  const before = alarmLevel(state);
  state.alarm = clamp(state.alarm + amount, 0, 3);
  const after = alarmLevel(state);
  if (after > before) {
    state.alarmsRaised++;
    state.banner = { text: 'ALARM ' + ALARM_NAMES[after], sub: reason, t: 2.2 };
    sfx.alarm();
    state.flash = 0.35;
  }
}

// --- movement ------------------------------------------------------------
function moveCircle(state, e, dx, dy) {
  const r = 11;
  const tryMove = (nx, ny) => {
    const pts = [
      [nx - r, ny - r], [nx + r, ny - r],
      [nx - r, ny + r], [nx + r, ny + r],
      [nx, ny - r], [nx, ny + r], [nx - r, ny], [nx + r, ny],
    ];
    for (const [px, py] of pts) if (pointBlocked(state.parsed, px, py)) return false;
    // keep inside the canvas
    if (nx < r + 2 || nx > W - r - 2 || ny < HUD_H + r + 2 || ny > H - r - 2) return false;
    e.x = nx;
    e.y = ny;
    return true;
  };
  if (dx !== 0) tryMove(e.x + dx, e.y);
  if (dy !== 0) tryMove(e.x, e.y + dy);
}

// --- player --------------------------------------------------------------
function updatePlayer(state, dt) {
  const p = state.player;
  if (state.lockpick || state.drill) {
    p.moving = false;
    return; // frozen in place during the minigame / drill
  }
  let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  p.sneak = !!keys.sneak;
  p.sprint = !!keys.sprint && !p.sneak && len > 0;
  const weightSlow = 1 - Math.min(0.25, state.weight * 0.03);
  let speed = p.sneak ? 95 : p.sprint ? 250 : 165;
  speed *= weightSlow;
  p.moving = len > 0;
  if (len > 0) {
    p.angle = Math.atan2(my, mx);
    moveCircle(state, p, mx * speed * dt, my * speed * dt);
    p.stepPhase += speed * dt;
    state.stepTimer -= dt;
    if (state.stepTimer <= 0) {
      sfx.step(p.sneak);
      state.stepTimer = p.sneak ? 0.42 : p.sprint ? 0.26 : 0.34;
    }
    if (p.sprint) {
      state.sprintNoiseTimer -= dt;
      if (state.sprintNoiseTimer <= 0) {
        emitNoise(state, p.x, p.y, 130);
        state.sprintNoiseTimer = 0.55;
      }
    }
  }
  // lasers: crossing a live beam trips the alarm
  const { tx, ty } = tileAtPx(state.parsed, p.x, p.y);
  let onLaser = false;
  for (const lz of state.parsed.lasers) {
    if (lz.x === tx && lz.y === ty) {
      onLaser = true;
      const on = laserOn(state, lz);
      if (on && !state.debug['laserHit' + tx + ',' + ty]) {
        state.debug['laserHit' + tx + ',' + ty] = true;
        raiseAlarm(state, 0.5, 'Laser grid tripped');
        sfx.laserZap();
        state.flash = 0.3;
        state.ghost = false;
        emitNoise(state, p.x, p.y, 200);
      }
    }
  }
  if (!onLaser) {
    for (const k of Object.keys(state.debug)) {
      if (k.indexOf('laserHit') === 0) delete state.debug[k];
    }
  }
}

export function laserOn(state, lz) {
  const cycle = (state.playTime + lz.phase * 1.7) % 5;
  return cycle < 2.5;
}

// --- guards --------------------------------------------------------------
const GUARD_RANGE = 195;
const GUARD_HALF = 0.87; // ~50 degrees each side

function guardSeesPlayer(state, g) {
  const p = state.player;
  if (state.disguise > 0 && dist(g.x, g.y, p.x, p.y) > 70) return 0;
  if (!inCone(g.x, g.y, g.angle, GUARD_RANGE, GUARD_HALF, p.x, p.y)) return 0;
  if (!hasLOS(state.parsed, g.x, g.y, p.x, p.y)) return 0;
  if (smokeBlocks(state, g.x, g.y, p.x, p.y)) return 0;
  const d = dist(g.x, g.y, p.x, p.y);
  let rate = 1.5 * (1 - (d / GUARD_RANGE) * 0.55);
  if (p.sneak) rate *= 0.5;
  if (p.sprint) rate *= 1.5;
  // crowd cover: standing in a group makes you hard to single out
  for (const c of state.civilians) {
    if (dist(p.x, p.y, c.x, c.y) < 64) { rate *= 0.5; break; }
  }
  const lvl = alarmLevel(state);
  if (lvl >= 2) rate *= 1.25;
  if (lvl >= 3) rate *= 1.3;
  return rate;
}

function guardSpeed(state, base) {
  return base * (1 + 0.15 * alarmLevel(state));
}

function moveToward(state, e, tx, ty, speed, dt) {
  const d = dist(e.x, e.y, tx, ty);
  if (d < 4) return true;
  const a = angleTo(e.x, e.y, tx, ty);
  e.angle = a;
  moveCircle(state, e, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
  return dist(e.x, e.y, tx, ty) < 6;
}

function updateGuard(state, g, dt) {
  if (g.alertCooldown > 0) g.alertCooldown -= dt;
  if (g.stun > 0) { g.stun -= dt; return; }

  const seen = guardSeesPlayer(state, g);
  const p = state.player;

  if (seen > 0) {
    g.suspicion = clamp(g.suspicion + seen * dt, 0, 1);
    g.lastSeen = { x: p.x, y: p.y };
    g.loseTimer = 0;
    if (g.suspicion >= 1 && g.state !== 'alert') {
      g.state = 'alert';
      state.ghost = false;
      if (g.alertCooldown <= 0) {
        raiseAlarm(state, 1, 'Guard spotted Rook');
        g.alertCooldown = 6;
      }
      sfx.spotted();
      // nearby guards turn to look
      for (const o of state.guards) {
        if (o !== g && o.state !== 'alert' && dist(o.x, o.y, g.x, g.y) < 320) {
          o.state = 'suspicious';
          o.lastSeen = { x: p.x, y: p.y };
          o.suspicion = Math.max(o.suspicion, 0.6);
        }
      }
    } else if (g.suspicion >= 0.5 && g.state === 'patrol') {
      g.state = 'suspicious';
    }
  } else {
    g.suspicion = clamp(g.suspicion - 0.22 * dt, 0, 1);
    if (g.state === 'suspicious' && g.suspicion < 0.25 && !g.lastSeen) g.state = 'patrol';
  }

  if (g.state === 'patrol') {
    const wp = g.waypoints[g.wp];
    if (g.pauseTimer > 0) {
      g.pauseTimer -= dt;
      g.angle += g.scanDir * 0.9 * dt;
      if (Math.abs(angleDiff(g.angle, Math.atan2(wp.y - g.y, wp.x - g.x))) > 1.2) g.scanDir *= -1;
    } else if (moveToward(state, g, wp.x, wp.y, guardSpeed(state, 68), dt)) {
      g.wp = (g.wp + 1) % g.waypoints.length;
      g.pauseTimer = 1.0 + state.rng() * 0.8;
    }
  } else if (g.state === 'suspicious') {
    const t = g.lastSeen;
    if (t && moveToward(state, g, t.x, t.y, guardSpeed(state, 108), dt)) {
      g.pauseTimer += dt;
      g.angle += 1.4 * dt;
      if (g.pauseTimer > 2.2) {
        g.pauseTimer = 0;
        g.lastSeen = null;
        g.state = 'patrol';
      }
    }
  } else if (g.state === 'alert') {
    if (seen > 0) {
      moveToward(state, g, p.x, p.y, guardSpeed(state, 168), dt);
      g.loseTimer = 0;
    } else {
      g.loseTimer += dt;
      if (g.lastSeen) moveToward(state, g, g.lastSeen.x, g.lastSeen.y, guardSpeed(state, 150), dt);
      if (g.loseTimer > 3) {
        g.state = 'search';
        g.searchTimer = 0;
        g.searchIndex = 0;
        g.searchPoints = [];
        for (let i = 0; i < 3; i++) {
          const a = state.rng() * Math.PI * 2;
          const r = 60 + state.rng() * 90;
          g.searchPoints.push({
            x: clamp(g.lastSeen.x + Math.cos(a) * r, 40, W - 40),
            y: clamp(g.lastSeen.y + Math.sin(a) * r, HUD_H + 40, H - 40),
          });
        }
      }
    }
    // caught!
    if (dist(g.x, g.y, p.x, p.y) < 24) {
      bust(state, 'Caught by a guard');
    }
  } else if (g.state === 'search') {
    g.searchTimer += dt;
    const pt = g.searchPoints[g.searchIndex];
    if (pt && moveToward(state, g, pt.x, pt.y, guardSpeed(state, 92), dt)) {
      g.searchIndex++;
      g.pauseTimer = 0.6;
    }
    if (g.searchTimer > 6 || g.searchIndex >= g.searchPoints.length) {
      g.state = 'patrol';
      g.suspicion = 0.2;
    }
  }
}

// --- cameras ---------------------------------------------------------------
const CAM_RANGE = 175;
const CAM_HALF = 0.5;

function updateCamera(state, cam, dt) {
  if (cam.disabled > 0) {
    cam.disabled -= dt;
    return;
  }
  cam.angle = cam.base + Math.sin(state.playTime * cam.speed + cam.phase) * cam.sweep;
  if (cam.cooldown > 0) { cam.cooldown -= dt; return; }
  const p = state.player;
  const sees = inCone(cam.x, cam.y, cam.angle, CAM_RANGE, CAM_HALF, p.x, p.y)
    && hasLOS(state.parsed, cam.x, cam.y, p.x, p.y)
    && !smokeBlocks(state, cam.x, cam.y, p.x, p.y)
    && !(state.disguise > 0 && dist(cam.x, cam.y, p.x, p.y) > 80);
  if (sees) {
    cam.spotTimer += dt;
    if (cam.spotTimer > 0.6) {
      cam.spotTimer = 0;
      cam.cooldown = 4;
      state.ghost = false;
      raiseAlarm(state, 1, 'Camera spotted Rook');
      sfx.cameraBeep();
    }
  } else {
    cam.spotTimer = Math.max(0, cam.spotTimer - dt * 2);
  }
}

// --- civilians ---------------------------------------------------------------
function updateCivilian(state, c, dt) {
  if (c.pause > 0) {
    c.pause -= dt;
    return;
  }
  const d = dist(c.x, c.y, c.tx, c.ty);
  if (d < 8) {
    // pick a new nearby wander target on open floor
    for (let tries = 0; tries < 8; tries++) {
      const a = state.rng() * Math.PI * 2;
      const r = 50 + state.rng() * 120;
      const nx = clamp(c.x + Math.cos(a) * r, 40, W - 40);
      const ny = clamp(c.y + Math.sin(a) * r, HUD_H + 40, H - 40);
      if (!pointBlocked(state.parsed, nx, ny)) { c.tx = nx; c.ty = ny; break; }
    }
    c.pause = 0.8 + state.rng() * 2.2;
    return;
  }
  const a = angleTo(c.x, c.y, c.tx, c.ty);
  c.angle = a;
  moveCircle(state, c, Math.cos(a) * 42 * dt, Math.sin(a) * 42 * dt);
}

// --- interaction -------------------------------------------------------------
function nearestInteractable(state) {
  const p = state.player;
  const px = p.x, py = p.y;
  const near = (tx, ty, range) => dist(px, py, (tx + 0.5) * TILE, HUD_H + (ty + 0.5) * TILE) <= range;
  // main target
  const t = state.parsed.target;
  if (t && !t.taken && near(t.x, t.y, 52)) return { kind: 'target', ref: t, label: 'Grab the ' + state.mission.targetName + '  [hold E]' };
  // side loot
  for (const l of state.parsed.loot) {
    if (!l.taken && near(l.x, l.y, 44)) return { kind: 'loot', ref: l, label: 'Pocket the loot  [E]' };
  }
  // safes
  for (const s of state.parsed.safes) {
    if (!s.open && near(s.x, s.y, 52)) return { kind: 'safe', ref: s, label: 'Crack the safe  [E]' };
  }
  // vault door
  const v = state.parsed.vault;
  if (v && !v.open && near(v.x, v.y, 56)) return { kind: 'vault', ref: v, label: 'Crack the vault  [E]' };
  // locked / keycard doors
  for (const d of state.parsed.doors) {
    if (!d.open && near(d.x, d.y, 52)) return { kind: 'door', ref: d, label: d.kind === 'keycard' ? 'Bypass the keycard door  [E]' : 'Pick the lock  [E]' };
  }
  // cameras (hack)
  for (const c of state.cameras) {
    if (c.disabled <= 0 && dist(px, py, c.x, c.y) <= 58) return { kind: 'camera', ref: c, label: 'Hack the camera  [hold E]' };
  }
  return null;
}

function lockpickNeeded(state) {
  return state.gadgetId === 'lockpick' ? 2 : 3;
}

function startLockpick(state, kind, ref) {
  const zoneW = 0.22;
  state.lockpick = {
    kind, ref,
    needle: 0,
    dir: 1,
    speed: 0.85 + state.rng() * 0.3,
    zone: 0.15 + state.rng() * (1 - zoneW - 0.3),
    zoneW,
    hits: 0,
    needed: lockpickNeeded(state),
  };
  sfx.lockTick();
}

function finishLockpick(state) {
  const lp = state.lockpick;
  if (!lp) return;
  if (lp.kind === 'door') {
    lp.ref.open = true;
    state.parsed.walls.delete(lp.ref.x + ',' + lp.ref.y);
    sfx.unlock();
    state.banner = { text: 'Door open', sub: lp.ref.kind === 'keycard' ? 'Keycard bypassed.' : 'Lock picked clean.', t: 1.6 };
  } else if (lp.kind === 'safe') {
    lp.ref.open = true;
    state.loot += lp.ref.value;
    state.weight += 1;
    sfx.unlock();
    sfx.coin();
    state.banner = { text: 'Safe cracked', sub: '+' + fmtMoney(lp.ref.value) + ' in untraceable bills.', t: 1.8 };
  } else if (lp.kind === 'vault') {
    state.drill = { ref: lp.ref, progress: 0, noiseTimer: 0 };
    sfx.unlock();
    state.banner = { text: 'Lock beaten — drill the vault', sub: 'Hold E. It is loud. Watch the patrols.', t: 2.4 };
  }
  state.lockpick = null;
}

function updateLockpick(state, dt) {
  const lp = state.lockpick;
  lp.needle += lp.dir * lp.speed * dt;
  if (lp.needle >= 1) { lp.needle = 1; lp.dir = -1; }
  if (lp.needle <= 0) { lp.needle = 0; lp.dir = 1; }
  if (wasPressed('interact') || mouse.clicked) {
    if (lp.needle >= lp.zone && lp.needle <= lp.zone + lp.zoneW) {
      lp.hits++;
      sfx.lockGood();
      if (lp.hits >= lp.needed) {
        finishLockpick(state);
      } else {
        lp.zone = 0.08 + state.rng() * (1 - lp.zoneW - 0.16);
        lp.speed += 0.12;
      }
    } else {
      sfx.lockBad();
      emitNoise(state, state.player.x, state.player.y, 260);
      state.banner = { text: 'Pick slipped!', sub: 'That clatter will bring a guard over.', t: 1.6 };
    }
  }
  if (wasPressed('pause')) state.lockpick = null;
}

function updateDrill(state, dt) {
  const d = state.drill;
  if (keys.interact) {
    startDrill();
    d.progress += dt / 8;
    d.noiseTimer -= dt;
    if (d.noiseTimer <= 0) {
      emitNoise(state, state.player.x, state.player.y, 300);
      d.noiseTimer = 1;
    }
    if (d.progress >= 1) {
      stopDrill();
      d.ref.open = true;
      state.parsed.walls.delete(d.ref.x + ',' + d.ref.y);
      state.drill = null;
      sfx.jingle();
      state.banner = { text: 'Vault open', sub: 'The gold is yours. Grab it and run.', t: 2.4 };
    }
  } else {
    stopDrill();
    d.progress = Math.max(0, d.progress - dt * 0.08);
  }
  if (wasPressed('pause')) { stopDrill(); state.drill = null; }
}

// Hold-to-interact: main target grab and camera hack.
function updateHold(state, dt) {
  const it = state.interactTarget;
  if (!it) { state.hold = null; return; }
  if (it.kind === 'loot') {
    if (wasPressed('interact')) {
      it.ref.taken = true;
      state.loot += it.ref.value;
      state.weight += 1;
      sfx.coin();
    }
    return;
  }
  if (it.kind === 'door' || it.kind === 'safe' || it.kind === 'vault') {
    if (wasPressed('interact') && !state.lockpick && !state.drill) startLockpick(state, it.kind, it.ref);
    return;
  }
  // target / camera: hold E
  const needed = it.kind === 'target' ? 1.2 : 2.0;
  const label = it.kind === 'target' ? 'Grabbing…' : 'Hacking…';
  if (keys.interact) {
    if (!state.hold || state.hold.kind !== it.kind) state.hold = { kind: it.kind, ref: it.ref, progress: 0, needed, label };
    state.hold.progress += dt / needed;
    if (state.hold.progress >= 1) {
      if (it.kind === 'target') {
        it.ref.taken = true;
        state.targetTaken = true;
        state.loot += state.mission.targetValue;
        state.weight += 2;
        sfx.pickup();
        sfx.jingle();
        state.banner = { text: state.mission.targetName + ' secured', sub: 'Get to the getaway marker. Now.', t: 2.6 };
      } else {
        it.ref.disabled = 20;
        sfx.unlock();
        state.banner = { text: 'Camera down', sub: 'Blind for 20 seconds.', t: 1.6 };
      }
      state.hold = null;
    }
  } else {
    state.hold = null;
  }
}

function updateGadget(state) {
  if (!state.gadgetId || state.gadgetCharges <= 0) return;
  if (!wasPressed('gadget')) return;
  const id = state.gadgetId;
  if (id === 'smoke') {
    state.smoke.push({ x: state.player.x, y: state.player.y, r: 95, t: 5 });
    state.gadgetCharges--;
    sfx.gadget();
  } else if (id === 'emp') {
    for (const c of state.cameras) c.disabled = Math.max(c.disabled, 15);
    for (const g of state.guards) g.stun = Math.max(g.stun, 3);
    state.gadgetCharges--;
    sfx.gadget();
    state.banner = { text: 'EMP burst', sub: 'Cameras dark for 15 s. Guards scrambled.', t: 2 };
  } else if (id === 'disguise') {
    state.disguise = 20;
    state.gadgetCharges--;
    sfx.gadget();
    state.banner = { text: 'Disguise on', sub: 'You look like staff — for 20 s.', t: 2 };
  }
}

// --- win / lose --------------------------------------------------------------
function bust(state, reason) {
  if (state.screen !== 'play') return;
  state.screen = 'busted';
  state.bustedReason = reason;
  stopDrill();
  sfx.busted();
}

function completeMission(state) {
  const m = state.mission;
  const ghostBonus = state.ghost ? Math.round(state.loot * 0.25) : 0;
  const total = state.loot + ghostBonus;
  state.complete = {
    loot: state.loot,
    time: state.playTime,
    alarms: state.alarmsRaised,
    ghost: state.ghost,
    bonus: ghostBonus,
    total,
  };
  const save = state.save;
  if (!save.best[m.id] || total > save.best[m.id]) save.best[m.id] = total;
  if (m.id < 4) save.unlocked = Math.max(save.unlocked, m.id + 1);
  storeSave(save);
  state.screen = 'complete';
  sfx.jingle();
}

// --- main update ---------------------------------------------------------------
export function update(state, dt) {
  state.time += dt;
  if (state.flash > 0) state.flash -= dt;
  if (state.banner && state.banner.t > 0) state.banner.t -= dt;
  if (state.frozen) return;

  if (state.screen === 'play') {
    state.playTime += dt;
    if (state.disguise > 0) state.disguise -= dt;
    if (state.empStun > 0) state.empStun -= dt;
    for (const c of state.smoke) c.t -= dt;
    state.smoke = state.smoke.filter((c) => c.t > 0);
    for (const r of state.noiseRings) r.r += r.speed * dt;
    state.noiseRings = state.noiseRings.filter((r) => r.r < r.maxR);

    // alarm decay when nobody is watching
    const anyoneSees = state.guards.some((g) => guardSeesPlayer(state, g) > 0);
    if (!anyoneSees) state.alarm = clamp(state.alarm - 0.03 * dt, 0, 3);

    // lockdown reinforcements
    if (alarmLevel(state) === 3 && !state.reinforcements) {
      state.reinforcements = true;
      const ex = state.parsed.exit;
      for (let i = 0; i < 2; i++) {
        state.guards.push({
          x: (ex.x + 0.5) * TILE + (i === 0 ? -70 : 70),
          y: HUD_H + (ex.y + 0.5) * TILE - 30,
          angle: 0, state: 'patrol', suspicion: 0.3,
          waypoints: [
            { x: (ex.x - 3) * TILE, y: HUD_H + (ex.y - 1) * TILE },
            { x: (ex.x + 3) * TILE, y: HUD_H + (ex.y - 1) * TILE },
          ],
          wp: 0, pauseTimer: 0, scanDir: 1, lastSeen: null, searchPoints: [],
          searchIndex: 0, searchTimer: 0, loseTimer: 0, stun: 0, alertCooldown: 0,
          home: { x: (ex.x + 0.5) * TILE, y: HUD_H + (ex.y + 0.5) * TILE },
        });
      }
      state.banner = { text: 'LOCKDOWN', sub: 'Reinforcements are guarding the exit.', t: 2.6 };
    }

    updatePlayer(state, dt);
    for (const g of state.guards) updateGuard(state, g, dt);
    for (const c of state.cameras) updateCamera(state, c, dt);
    for (const c of state.civilians) updateCivilian(state, c, dt);
    if (state.screen !== 'play') return; // busted mid-frame

    state.interactTarget = state.lockpick || state.drill ? null : nearestInteractable(state);
    if (state.lockpick) updateLockpick(state, dt);
    else if (state.drill) updateDrill(state, dt);
    else updateHold(state, dt);
    updateGadget(state);

    // getaway
    if (state.targetTaken) {
      const ex = state.parsed.exit;
      if (dist(state.player.x, state.player.y, (ex.x + 0.5) * TILE, HUD_H + (ex.y + 0.5) * TILE) < 30) {
        completeMission(state);
        return;
      }
    }
    // timed mission
    if (state.mission.timeLimit > 0 && state.playTime > state.mission.timeLimit) {
      bust(state, 'Out of time — the crew left without you');
    }
    if (wasPressed('pause')) state.screen = 'paused';
    if (wasPressed('mute')) toggleMute();
  } else if (state.screen === 'paused') {
    if (wasPressed('pause')) state.screen = 'play';
  }
}

export function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

export { ALARM_NAMES };
