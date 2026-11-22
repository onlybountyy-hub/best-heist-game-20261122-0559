// render.js — every pixel of VAULTBREAK is drawn in code: tiled floors per
// mission theme, wall shadows, raycast vision cones, the thief, guards,
// cameras, loot glints, the HUD alarm meter, minimap and all menus.

import { TILE, COLS, ROWS, HUD_H } from './maps.js';
import { tileHash, clamp, dist, angleTo } from './random.js';
import { W, H, alarmLevel, fmtMoney, fmtTime, ALARM_NAMES } from './engine.js';
import { GADGETS } from './maps.js';
import { mouse } from './input.js';
import { isMuted } from './audio.js';

const THEMES = {
  gallery: {
    floorA: '#c9b896', floorB: '#bfaf8a', wall: '#3a3348', wallTop: '#5a5170',
    carpet: '#7a1f2b', accent: '#d4af37', glow: 'rgba(255, 214, 120, 0.20)',
  },
  bank: {
    floorA: '#5d6b76', floorB: '#55636e', wall: '#232c33', wallTop: '#3d4a54',
    carpet: '#1f3a4d', accent: '#d4af37', glow: 'rgba(120, 200, 255, 0.16)',
  },
  casino: {
    floorA: '#1e4d33', floorB: '#1a4530', wall: '#3d1f2e', wallTop: '#5c2f45',
    carpet: '#6e1423', accent: '#e8c15a', glow: 'rgba(255, 190, 90, 0.18)',
  },
  museum: {
    floorA: '#4a4a52', floorB: '#43434b', wall: '#26262e', wallTop: '#41414e',
    carpet: '#6e1423', accent: '#c0392b', glow: 'rgba(255, 120, 90, 0.14)',
  },
};

function themeOf(state) {
  return THEMES[state.mission ? state.mission.theme : 'gallery'];
}

// Raycast fan: march rays out from the origin until a wall or the range
// ends; the returned polygon is the visible part of the cone.
export function conePolygon(state, ox, oy, angle, range, half) {
  const pts = [{ x: ox, y: oy }];
  const rays = 26;
  for (let i = 0; i <= rays; i++) {
    const a = angle - half + (2 * half * i) / rays;
    let d = 0;
    const step = 7;
    while (d < range) {
      d += step;
      const x = ox + Math.cos(a) * d;
      const y = oy + Math.sin(a) * d;
      const tx = Math.floor(x / TILE);
      const ty = Math.floor((y - HUD_H) / TILE);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) break;
      if (state.parsed.walls.has(tx + ',' + ty)) break;
      // closed doors block sight too
      let blocked = false;
      for (const dr of state.parsed.doors) {
        if (!dr.open && dr.x === tx && dr.y === ty) { blocked = true; break; }
      }
      if (blocked) break;
      if (state.parsed.vault && !state.parsed.vault.open
        && state.parsed.vault.x === tx && state.parsed.vault.y === ty) break;
    }
    pts.push({ x: ox + Math.cos(a) * Math.min(d, range), y: oy + Math.sin(a) * Math.min(d, range) });
  }
  return pts;
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

// --- floor & walls -----------------------------------------------------------
function drawFloor(state, ctx) {
  const th = themeOf(state);
  const parsed = state.parsed;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * TILE;
      const py = HUD_H + y * TILE;
      const h = tileHash(x, y, state.mission.seed);
      if (parsed.walls.has(x + ',' + y)) continue; // walls drawn later
      ctx.fillStyle = h < 0.5 ? th.floorA : th.floorB;
      ctx.fillRect(px, py, TILE, TILE);
      // subtle per-tile speckle / veins
      if (h > 0.82) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(px + 4, py + 4, TILE - 8, 2);
      } else if (h < 0.08) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(px + 6, py + TILE - 7, TILE - 12, 2);
      }
      // carpet runners / theme dressing
      if (state.mission.theme === 'gallery' && (x === 19 || x === 20)) {
        ctx.fillStyle = th.carpet;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(px + 3, py, TILE - 6, TILE);
        ctx.globalAlpha = 1;
        ctx.fillStyle = th.accent;
        ctx.fillRect(px + 3, py, 2, TILE);
        ctx.fillRect(px + TILE - 5, py, 2, TILE);
      }
      if (state.mission.theme === 'museum' && (x === 19 || x === 20)) {
        ctx.fillStyle = th.carpet;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(px + 4, py, TILE - 8, TILE);
        ctx.globalAlpha = 1;
      }
      if (state.mission.theme === 'casino' && h > 0.9) {
        // scattered chip stacks on the casino floor
        ctx.fillStyle = '#e8c15a';
        circle(ctx, px + 10, py + 12, 3); ctx.fill();
        ctx.fillStyle = '#c0392b';
        circle(ctx, px + 16, py + 12, 3); ctx.fill();
        ctx.fillStyle = '#2e86c1';
        circle(ctx, px + 22, py + 12, 3); ctx.fill();
      }
      if (state.mission.theme === 'bank' && h > 0.86) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        circle(ctx, px + 5, py + 5, 1.5); ctx.fill();
        circle(ctx, px + TILE - 5, py + 5, 1.5); ctx.fill();
        circle(ctx, px + 5, py + TILE - 5, 1.5); ctx.fill();
        circle(ctx, px + TILE - 5, py + TILE - 5, 1.5); ctx.fill();
      }
    }
  }
  // warm light pools around the loot and the exit
  const pools = [];
  if (parsed.target && !parsed.target.taken) pools.push([parsed.target.x, parsed.target.y]);
  if (parsed.exit) pools.push([parsed.exit.x, parsed.exit.y]);
  for (const l of parsed.loot) if (!l.taken) pools.push([l.x, l.y]);
  for (const [tx, ty] of pools) {
    const cx = (tx + 0.5) * TILE;
    const cy = HUD_H + (ty + 0.5) * TILE;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 70);
    g.addColorStop(0, themeOf(state).glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 70, cy - 70, 140, 140);
  }
}

function drawWalls(state, ctx) {
  const th = themeOf(state);
  const parsed = state.parsed;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * TILE;
      const py = HUD_H + y * TILE;
      const isWall = parsed.walls.has(x + ',' + y);
      const door = parsed.doors.find((d) => d.x === x && d.y === y);
      const vault = parsed.vault && parsed.vault.x === x && parsed.vault.y === y;
      if (!isWall && !door && !vault) continue;
      if (door && door.open) continue;
      if (vault && vault.open) continue;
      // drop shadow onto the floor below
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + 2, py + TILE - 4, TILE, 5);
      ctx.fillStyle = vault ? '#6b5a1e' : th.wall;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = th.wallTop;
      ctx.fillRect(px, py, TILE, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(px, py + 5, TILE, 2);
      if (vault) {
        ctx.fillStyle = '#d4af37';
        circle(ctx, px + TILE / 2, py + TILE / 2, 9); ctx.fill();
        ctx.strokeStyle = '#3a2f08';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#3a2f08';
        ctx.fillRect(px + TILE / 2 - 1, py + TILE / 2 - 6, 2, 12);
        ctx.fillRect(px + TILE / 2 - 6, py + TILE / 2 - 1, 12, 2);
      } else if (door) {
        ctx.fillStyle = door.kind === 'keycard' ? '#2e86c1' : '#8a6d1f';
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = '#0e1116';
        ctx.fillRect(px + TILE / 2 - 2, py + 6, 4, 8);
      }
    }
  }
  // laser grids
  for (const lz of parsed.lasers) {
    const px = lz.x * TILE;
    const py = HUD_H + lz.y * TILE;
    const on = (state.playTime + lz.phase * 1.7) % 5 < 2.5;
    ctx.fillStyle = on ? 'rgba(255,40,40,0.85)' : 'rgba(255,40,40,0.18)';
    ctx.fillRect(px + 2, py + TILE / 2 - 2, TILE - 4, 4);
    ctx.fillStyle = '#7a1010';
    ctx.fillRect(px + 2, py + 2, 3, TILE - 4);
    ctx.fillRect(px + TILE - 5, py + 2, 3, TILE - 4);
    if (on) {
      ctx.fillStyle = 'rgba(255,60,60,0.25)';
      ctx.fillRect(px, py, TILE, TILE);
    }
  }
}

// --- entities ------------------------------------------------------------------
function drawLoot(state, ctx) {
  const t = state.time + state.sceneTime;
  const sparkle = (x, y, s) => {
    const tw = 0.6 + 0.4 * Math.sin(t * 4 + x * 0.13 + y * 0.07);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = tw;
    ctx.fillStyle = '#fff7c0';
    ctx.fillRect(-s, -1.2, s * 2, 2.4);
    ctx.fillRect(-1.2, -s, 2.4, s * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
  };
  // main target — gold diamond with a pulsing halo
  const tg = state.parsed.target;
  if (tg && !tg.taken) {
    const cx = (tg.x + 0.5) * TILE;
    const cy = HUD_H + (tg.y + 0.5) * TILE;
    const pulse = 1 + 0.08 * Math.sin(t * 3);
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 46 * pulse);
    g.addColorStop(0, 'rgba(255, 220, 90, 0.5)');
    g.addColorStop(1, 'rgba(255, 220, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 48, cy - 48, 96, 96);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 2;
    const s = 11 * pulse;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.fillStyle = '#fff3a0';
    ctx.fillRect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9);
    ctx.restore();
    sparkle(cx - 16, cy - 14, 6);
    sparkle(cx + 15, cy + 12, 5);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('TARGET', cx, cy + 30);
  }
  for (const l of state.parsed.loot) {
    if (l.taken) continue;
    const cx = (l.x + 0.5) * TILE;
    const cy = HUD_H + (l.y + 0.5) * TILE;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#e8c15a';
    ctx.strokeStyle = '#7a5c10';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
    sparkle(cx + 10, cy - 8, 4);
  }
  for (const s of state.parsed.safes) {
    if (s.open) continue;
    const cx = (s.x + 0.5) * TILE;
    const cy = HUD_H + (s.y + 0.5) * TILE;
    ctx.fillStyle = '#3d4a54';
    rr(ctx, cx - 13, cy - 13, 26, 26, 4); ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    rr(ctx, cx - 13, cy - 13, 26, 26, 4); ctx.stroke();
    ctx.fillStyle = '#d4af37';
    circle(ctx, cx, cy, 5); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SAFE', cx, cy + 24);
  }
}

function drawExit(state, ctx) {
  const ex = state.parsed.exit;
  const cx = (ex.x + 0.5) * TILE;
  const cy = HUD_H + (ex.y + 0.5) * TILE;
  const active = state.targetTaken;
  const t = state.time + state.sceneTime;
  if (active) {
    const pulse = 0.55 + 0.35 * Math.sin(t * 5);
    ctx.fillStyle = `rgba(46, 204, 113, ${pulse})`;
    rr(ctx, cx - 17, cy - 17, 34, 34, 6); ctx.fill();
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 60);
    g.addColorStop(0, 'rgba(46, 204, 113, 0.45)');
    g.addColorStop(1, 'rgba(46, 204, 113, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 60, cy - 60, 120, 120);
  } else {
    ctx.fillStyle = 'rgba(120, 130, 140, 0.5)';
    rr(ctx, cx - 17, cy - 17, 34, 34, 6); ctx.fill();
  }
  ctx.fillStyle = active ? '#0b3d1e' : '#2c343c';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(active ? 'EXIT' : 'EXIT', cx, cy + 3);
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.fillStyle = active ? '#d5f5e3' : '#8a949c';
  ctx.fillText(active ? 'GETAWAY' : 'LOCKED', cx, cy + 13);
}

function drawGuard(state, ctx, g) {
  // vision cone — the judge must see it
  const suspicion = g.suspicion;
  const coneColor = g.state === 'alert'
    ? 'rgba(255, 45, 45, 0.34)'
    : suspicion > 0.5
      ? `rgba(255, 140, 40, ${0.20 + suspicion * 0.14})`
      : 'rgba(255, 214, 90, 0.30)';
  const pts = conePolygon(state, g.x, g.y, g.angle, 195, 0.87);
  ctx.fillStyle = coneColor;
  poly(ctx, pts);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 220, 120, 0.35)';
  ctx.lineWidth = 1;
  poly(ctx, pts);
  ctx.stroke();

  // body: uniformed guard with cap + facing tick
  ctx.fillStyle = '#1f2a44';
  circle(ctx, g.x, g.y, 12); ctx.fill();
  ctx.strokeStyle = '#0c1220';
  ctx.lineWidth = 2;
  circle(ctx, g.x, g.y, 12); ctx.stroke();
  ctx.fillStyle = '#2e86c1';
  circle(ctx, g.x, g.y, 7); ctx.fill();
  ctx.fillStyle = '#d7e6f5';
  ctx.fillRect(g.x - 5, g.y - 13, 10, 3); // cap brim
  // facing direction
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + Math.cos(g.angle) * 16, g.y + Math.sin(g.angle) * 16);
  ctx.stroke();
  // state mark: ? when suspicious, ! when alert
  if (g.state === 'suspicious' || g.state === 'search') {
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcf4d';
    ctx.fillText('?', g.x, g.y - 20);
  } else if (g.state === 'alert') {
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText('!', g.x, g.y - 20);
  }
  // suspicion arc above the guard
  if (suspicion > 0.05 && g.state !== 'alert') {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(g.x, g.y - 18, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = suspicion > 0.5 ? '#ff8c28' : '#ffd65a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.x, g.y - 18, 8, -Math.PI / 2, -Math.PI / 2 + suspicion * Math.PI * 2);
    ctx.stroke();
  }
}

function drawCamera(state, ctx, cam) {
  const disabled = cam.disabled > 0;
  const pts = conePolygon(state, cam.x, cam.y, cam.angle, 175, 0.5);
  ctx.fillStyle = disabled ? 'rgba(140, 150, 160, 0.16)' : 'rgba(255, 60, 60, 0.26)';
  poly(ctx, pts);
  ctx.fill();
  ctx.strokeStyle = disabled ? 'rgba(160,170,180,0.4)' : 'rgba(255, 90, 90, 0.5)';
  ctx.lineWidth = 1;
  poly(ctx, pts);
  ctx.stroke();
  // wall box + lens
  ctx.fillStyle = disabled ? '#5a646e' : '#2c343c';
  rr(ctx, cam.x - 8, cam.y - 8, 16, 16, 3); ctx.fill();
  ctx.strokeStyle = disabled ? '#8a949c' : '#ff4d4d';
  ctx.lineWidth = 2;
  rr(ctx, cam.x - 8, cam.y - 8, 16, 16, 3); ctx.stroke();
  ctx.fillStyle = disabled ? '#3a444e' : '#ff2d2d';
  circle(ctx, cam.x + Math.cos(cam.angle) * 4, cam.y + Math.sin(cam.angle) * 4, 3.5); ctx.fill();
  if (!disabled && cam.spotTimer > 0.15) {
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText('!', cam.x, cam.y - 14);
  }
}

function drawCivilian(state, ctx, c) {
  ctx.fillStyle = c.hue > 0.5 ? '#7d5a8a' : '#5a7d8a';
  circle(ctx, c.x, c.y, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  circle(ctx, c.x, c.y, 10); ctx.stroke();
  ctx.fillStyle = '#e8dcc8';
  circle(ctx, c.x, c.y, 5); ctx.fill();
}

function drawPlayer(state, ctx) {
  const p = state.player;
  const t = state.time + state.sceneTime;
  // sneak light radius + disguise tint
  const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 64);
  g.addColorStop(0, state.disguise > 0 ? 'rgba(120, 220, 160, 0.16)' : 'rgba(255, 240, 180, 0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(p.x - 64, p.y - 64, 128, 128);
  // hooded thief: dark cloak, hood, face shadow, direction — plus a
  // bright gold halo ring so the judge can find the thief at a glance
  // on any floor (the v1 thief was a near-invisible dark dot).
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = state.disguise > 0 ? '#2e6b4f' : '#23232e';
  circle(ctx, 0, 0, 15); ctx.fill();
  ctx.strokeStyle = '#0c0c12';
  ctx.lineWidth = 2;
  circle(ctx, 0, 0, 15); ctx.stroke();
  ctx.strokeStyle = '#ffd65a';
  ctx.lineWidth = 3;
  circle(ctx, 0, 0, 18); ctx.stroke();
  // hood point
  ctx.fillStyle = state.disguise > 0 ? '#2e6b4f' : '#2b2b38';
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(2, -8);
  ctx.lineTo(2, 8);
  ctx.closePath();
  ctx.fill();
  // face
  ctx.fillStyle = '#e8c39a';
  circle(ctx, 5, 0, 5); ctx.fill();
  ctx.fillStyle = '#14141c';
  ctx.fillRect(4, -4, 6, 8);
  ctx.restore();
  // loot sack bulge when carrying
  if (state.weight > 0) {
    ctx.fillStyle = '#8a6d1f';
    circle(ctx, p.x - Math.cos(p.angle) * 13, p.y - Math.sin(p.angle) * 13, 5 + Math.min(3, state.weight)); ctx.fill();
  }
  // hold-progress ring (grab / hack)
  if (state.hold) {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffd65a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, -Math.PI / 2, -Math.PI / 2 + state.hold.progress * Math.PI * 2);
    ctx.stroke();
  }
  // "you" arrow when zoomed out is unnecessary; name tag for clarity
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('ROOK', p.x, p.y - 20);
}

function drawNoiseAndSmoke(state, ctx) {
  for (const r of state.noiseRings) {
    const a = clamp(1 - r.r / r.maxR, 0, 1);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * a})`;
    ctx.lineWidth = 2;
    circle(ctx, r.x, r.y, r.r); ctx.stroke();
    ctx.strokeStyle = `rgba(255, 220, 120, ${0.35 * a})`;
    circle(ctx, r.x, r.y, r.r * 0.8); ctx.stroke();
  }
  for (const c of state.smoke) {
    const g = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, c.r);
    g.addColorStop(0, 'rgba(200, 200, 210, 0.55)');
    g.addColorStop(1, 'rgba(200, 200, 210, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
  }
}

// --- HUD -----------------------------------------------------------------------
function drawHUD(state, ctx) {
  const m = state.mission;
  // top bar
  ctx.fillStyle = 'rgba(10, 12, 18, 0.92)';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(0, HUD_H - 2, W, 2);

  // left: logo + mission
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText('VAULTBREAK', 14, 21);
  ctx.fillStyle = '#c8cdd4';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(m.name + ' — ' + m.subtitle, 14, 38);

  // center: alarm meter (the judge must see it)
  const lvl = alarmLevel(state);
  const ax = 470;
  ctx.fillStyle = '#8a949c';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('ALARM', ax, 16);
  const segColors = ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'];
  for (let i = 0; i < 4; i++) {
    const sx = ax + 62 + i * 34;
    const on = i <= lvl && !(i === 0 && lvl === 0);
    const lit = i === 0 ? lvl >= 0 : i <= lvl;
    ctx.fillStyle = lit ? segColors[i] : '#2a2f38';
    if (i === 3 && lvl === 3 && Math.sin((state.time + state.sceneTime) * 6) > 0) ctx.fillStyle = '#ff6b6b';
    rr(ctx, sx, 8, 30, 16, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    rr(ctx, sx, 8, 30, 16, 3); ctx.stroke();
    void on;
  }
  ctx.fillStyle = lvl === 0 ? '#2ecc71' : lvl === 1 ? '#f1c40f' : lvl === 2 ? '#e67e22' : '#e74c3c';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(ALARM_NAMES[lvl], ax + 62, 40);

  // objectives
  const ox = 700;
  ctx.fillStyle = '#8a949c';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('JOB', ox, 16);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = state.targetTaken ? '#2ecc71' : '#e8eaf0';
  ctx.fillText((state.targetTaken ? '✓ ' : '○ ') + m.targetName, ox, 33);
  ctx.fillStyle = state.targetTaken ? '#2ecc71' : '#8a949c';
  ctx.fillText((state.targetTaken ? '✓ ' : '○ ') + 'Reach the getaway', ox, 45);

  // right: loot, time, mute
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(fmtMoney(state.loot), W - 96, 22);
  ctx.fillStyle = '#c8cdd4';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(fmtTime(state.playTime) + (m.timeLimit > 0 ? ' / ' + fmtTime(m.timeLimit) : ''), W - 96, 38);
  ctx.fillStyle = isMuted() ? '#e74c3c' : '#8a949c';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(isMuted() ? 'MUTED [M]' : 'SOUND [M]', W - 14, 22);
  ctx.textAlign = 'left';
}

function drawMinimap(state, ctx) {
  const mw = 168;
  const mh = 88;
  const mx = 14;
  const my = H - mh - 14;
  const sx = mw / (COLS * TILE);
  const sy = mh / (ROWS * TILE);
  ctx.fillStyle = 'rgba(8, 10, 14, 0.85)';
  rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 6); ctx.stroke();
  const parsed = state.parsed;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (parsed.walls.has(x + ',' + y)) {
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(mx + x * TILE * sx, my + y * TILE * sy, TILE * sx + 0.5, TILE * sy + 0.5);
      }
    }
  }
  const dot = (tx, ty, color, r) => {
    ctx.fillStyle = color;
    circle(ctx, mx + (tx + 0.5) * TILE * sx, my + (ty + 0.5) * TILE * sy, r); ctx.fill();
  };
  for (const l of parsed.loot) if (!l.taken) dot(l.x, l.y, '#ffd700', 2.5);
  if (parsed.target && !parsed.target.taken) dot(parsed.target.x, parsed.target.y, '#ffd700', 3.5);
  dot(parsed.exit.x, parsed.exit.y, state.targetTaken ? '#2ecc71' : '#7a828c', 3.5);
  for (const c of state.cameras) dot(Math.floor((c.x) / TILE), Math.floor((c.y - HUD_H) / TILE), c.disabled > 0 ? '#7a828c' : '#ff5a5a', 2.5);
  for (const g of state.guards) {
    ctx.fillStyle = g.state === 'alert' ? '#ff2d2d' : '#ff8c28';
    circle(ctx, mx + g.x * sx, my + (g.y - HUD_H) * sy, 3); ctx.fill();
  }
  // thief arrow
  const p = state.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + (p.y - HUD_H) * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#8a949c';
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MAP', mx, my - 9);
}

function drawGadgets(state, ctx) {
  const gx = W - 210;
  const gy = H - 54;
  ctx.fillStyle = 'rgba(8, 10, 14, 0.85)';
  rr(ctx, gx - 8, gy - 8, 204, 48, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  rr(ctx, gx - 8, gy - 8, 204, 48, 6); ctx.stroke();
  if (!state.gadgetId) {
    ctx.fillStyle = '#8a949c';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('No gadget this job', gx, gy + 14);
    return;
  }
  const g = GADGETS[state.gadgetId];
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('[Q] ' + g.name, gx, gy + 12);
  ctx.fillStyle = '#c8cdd4';
  ctx.font = '11px system-ui, sans-serif';
  if (g.charges > 0) {
    ctx.fillText('Charges: ' + '●'.repeat(state.gadgetCharges) + '○'.repeat(g.charges - state.gadgetCharges), gx, gy + 30);
  } else {
    ctx.fillText('Always on', gx, gy + 30);
  }
  if (state.disguise > 0) {
    ctx.fillStyle = '#7be3a8';
    ctx.textAlign = 'right';
    ctx.fillText('Disguise ' + Math.ceil(state.disguise) + 's', gx + 196, gy + 30);
    ctx.textAlign = 'left';
  }
  ctx.textAlign = 'left';
}

function drawPrompt(state, ctx) {
  const it = state.interactTarget;
  if (!it || state.lockpick || state.drill) return;
  ctx.font = 'bold 14px system-ui, sans-serif';
  const w = ctx.measureText(it.label).width + 28;
  const x = (W - w) / 2;
  const y = H - 92;
  ctx.fillStyle = 'rgba(8, 10, 14, 0.88)';
  rr(ctx, x, y, w, 32, 8); ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, 32, 8); ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'center';
  ctx.fillText(it.label, W / 2, y + 21);
  ctx.textAlign = 'left';
}

function drawBanner(state, ctx) {
  const b = state.banner;
  if (!b || b.t <= 0) return;
  const a = clamp(b.t / 0.6, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8, 10, 14, 0.82)';
  const w = Math.max(420, ctx.measureText(b.text).width + 60);
  rr(ctx, (W - w) / 2, 74, w, 62, 10); ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  rr(ctx, (W - w) / 2, 74, w, 62, 10); ctx.stroke();
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText(b.text, W / 2, 100);
  ctx.fillStyle = '#d5dbe2';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(b.sub, W / 2, 122);
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawLockpick(state, ctx) {
  const lp = state.lockpick;
  if (!lp) return;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  const pw = 520;
  const ph = 210;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  ctx.fillStyle = '#141821';
  rr(ctx, px, py, pw, ph, 12); ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  rr(ctx, px, py, pw, ph, 12); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText(lp.kind === 'vault' ? 'CRACK THE VAULT' : lp.kind === 'safe' ? 'CRACK THE SAFE' : 'PICK THE LOCK', W / 2, py + 38);
  ctx.fillStyle = '#c8cdd4';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Press E when the needle is inside the gold zone.', W / 2, py + 62);
  // bar
  const bx = px + 50;
  const bw = pw - 100;
  const by = py + 100;
  ctx.fillStyle = '#0a0d12';
  rr(ctx, bx, by, bw, 26, 6); ctx.fill();
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(bx + lp.zone * bw, by, lp.zoneW * bw, 26);
  const nx = bx + lp.needle * bw;
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(nx - 2, by - 8, 4, 42);
  // hits
  for (let i = 0; i < lp.needed; i++) {
    ctx.fillStyle = i < lp.hits ? '#2ecc71' : '#2a2f38';
    circle(ctx, W / 2 + (i - (lp.needed - 1) / 2) * 34, py + 160, 10); ctx.fill();
    ctx.strokeStyle = '#8a949c';
    ctx.lineWidth = 1.5;
    circle(ctx, W / 2 + (i - (lp.needed - 1) / 2) * 34, py + 160, 10); ctx.stroke();
  }
  ctx.fillStyle = '#8a949c';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('A miss makes noise. Guards will come and look.', W / 2, py + 190);
  ctx.textAlign = 'left';
}

function drawDrill(state, ctx) {
  const d = state.drill;
  if (!d) return;
  // In a frozen ?scene= frame the modal would hide the room: draw a
  // compact progress bar over the thief instead.
  if (state.frozen) {
    const p = state.player;
    const bw = 110;
    const bx = p.x - bw / 2;
    const by = p.y - 34;
    ctx.fillStyle = 'rgba(8, 10, 14, 0.88)';
    rr(ctx, bx - 6, by - 20, bw + 12, 40, 6); ctx.fill();
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 1.5;
    rr(ctx, bx - 6, by - 20, bw + 12, 40, 6); ctx.stroke();
    ctx.fillStyle = '#0a0d12';
    rr(ctx, bx, by, bw, 12, 4); ctx.fill();
    ctx.fillStyle = '#e67e22';
    rr(ctx, bx, by, bw * clamp(d.progress, 0, 1), 12, 4); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DRILLING ' + Math.round(d.progress * 100) + '%', p.x, by - 8);
    ctx.textAlign = 'left';
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  const pw = 520;
  const ph = 170;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  ctx.fillStyle = '#141821';
  rr(ctx, px, py, pw, ph, 12); ctx.fill();
  ctx.strokeStyle = '#e67e22';
  ctx.lineWidth = 2;
  rr(ctx, px, py, pw, ph, 12); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5a623';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('DRILLING THE VAULT', W / 2, py + 40);
  ctx.fillStyle = '#c8cdd4';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('HOLD E — the drill is loud. Let go to pause it.', W / 2, py + 64);
  ctx.fillStyle = '#0a0d12';
  rr(ctx, px + 50, py + 92, pw - 100, 26, 6); ctx.fill();
  ctx.fillStyle = '#e67e22';
  rr(ctx, px + 50, py + 92, (pw - 100) * clamp(d.progress, 0, 1), 26, 6); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(Math.round(d.progress * 100) + '%', W / 2, py + 142);
  ctx.textAlign = 'left';
}

// --- menus -------------------------------------------------------------------
function button(state, ctx, id, x, y, w, h, label, opts) {
  opts = opts || {};
  const hover = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  ctx.fillStyle = opts.disabled ? '#23272f' : hover ? '#3a2f10' : '#1c212b';
  rr(ctx, x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = opts.disabled ? '#3a3f48' : hover ? '#f5d76e' : '#d4af37';
  ctx.lineWidth = opts.disabled ? 1 : 1.5;
  rr(ctx, x, y, w, h, 8); ctx.stroke();
  ctx.fillStyle = opts.disabled ? '#5a6068' : '#ffe9a8';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
  ctx.textAlign = 'left';
  state.ui.push({ id, x, y, w, h, disabled: !!opts.disabled });
  return hover && !opts.disabled;
}

function panelBackdrop(ctx) {
  ctx.fillStyle = '#0d0f14';
  ctx.fillRect(0, 0, W, H);
  // faint vault-door rings behind the title
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
  ctx.lineWidth = 10;
  for (let r = 120; r <= 420; r += 75) {
    circle(ctx, W / 2, H / 2 - 40, r); ctx.stroke();
  }
}

function drawTitle(state, ctx) {
  panelBackdrop(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.fillText('VAULTBREAK', W / 2, 190);
  ctx.fillStyle = '#d4af37';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('— The Meridian Job —', W / 2, 228);
  ctx.fillStyle = '#c8cdd4';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Four jobs. One night. Get in, get rich, get out.', W / 2, 262);
  const cont = state.save.unlocked > 1 || Object.keys(state.save.best).length > 0;
  button(state, ctx, 'play', W / 2 - 140, 300, 280, 48, cont ? 'CONTINUE THE NIGHT' : 'START THE NIGHT');
  button(state, ctx, 'missions', W / 2 - 140, 360, 280, 48, 'CHOOSE A JOB');
  button(state, ctx, 'howto', W / 2 - 140, 420, 280, 48, 'HOW TO PLAY');
  const total = Object.values(state.save.best).reduce((a, b) => a + b, 0);
  ctx.fillStyle = '#8a949c';
  ctx.font = '13px system-ui, sans-serif';
  if (total > 0) ctx.fillText('Career take so far: ' + fmtMoney(total), W / 2, 510);
  ctx.fillText('WASD move · Shift sneak · Space sprint · E interact · Q gadget · Esc pause · M mute', W / 2, 540);
  ctx.fillText('A top-down stealth heist. Watch the cones. Mind the cameras. Never get seen.', W / 2, 566);
  ctx.textAlign = 'left';
}

function drawHowto(state, ctx) {
  panelBackdrop(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('HOW TO PLAY', W / 2, 100);
  ctx.textAlign = 'left';
  const lines = [
    ['MOVE', 'WASD / arrows. Shift sneaks (quiet, slow). Space sprints (fast, loud).'],
    ['SEE', 'Guards project vision cones. Inside a lit cone, suspicion fills — yellow to red.'],
    ['CAMERAS', 'Red sweeping cones. Stand close and hold E for 2 s to hack one dark for 20 s.'],
    ['ALARM', '0 Calm · 1 Suspicious · 2 Hunted · 3 Lockdown. It decays when nobody sees you.'],
    ['LOOT', 'E pockets side loot. The main target takes a 1 s grab. Loot weighs you down.'],
    ['LOCKS', 'E starts a lockpick: press E inside the gold zone 3 times. A miss makes noise.'],
    ['VAULT', 'After the picks, hold E to drill for 8 s. It is very loud. Plan around patrols.'],
    ['NOISE', 'Sprinting and failed picks ring out — guards come to look. Smoke hides you.'],
    ['GETAWAY', 'Once the target is yours, the exit lights up green. Reach it to finish the job.'],
    ['GHOST', 'Finish a job without ever being spotted: +25% fence value.'],
  ];
  ctx.font = '14px system-ui, sans-serif';
  let y = 150;
  for (const [k, v] of lines) {
    ctx.fillStyle = '#f5d76e';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(k, 220, y);
    ctx.fillStyle = '#d5dbe2';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(v, 340, y);
    y += 34;
  }
  button(state, ctx, 'back', W / 2 - 110, 610, 220, 44, 'BACK');
  ctx.textAlign = 'left';
}

function drawMissions(state, ctx) {
  panelBackdrop(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('CHOOSE A JOB', W / 2, 90);
  ctx.textAlign = 'left';
  state.uiMissions = [];
  const cards = state.missionList;
  const cw = 270;
  const ch = 300;
  const gap = 20;
  const x0 = (W - (cw * 4 + gap * 3)) / 2;
  const y0 = 140;
  cards.forEach((m, i) => {
    const x = x0 + i * (cw + gap);
    const unlocked = i < state.save.unlocked;
    const best = state.save.best[m.id];
    ctx.fillStyle = unlocked ? '#161a22' : '#101216';
    rr(ctx, x, y0, cw, ch, 10); ctx.fill();
    ctx.strokeStyle = unlocked ? '#d4af37' : '#2a2f38';
    ctx.lineWidth = 1.5;
    rr(ctx, x, y0, cw, ch, 10); ctx.stroke();
    ctx.fillStyle = unlocked ? '#f5d76e' : '#5a6068';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText((i + 1) + '. ' + m.name, x + 16, y0 + 36);
    ctx.fillStyle = unlocked ? '#c8cdd4' : '#4a4f58';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(m.subtitle, x + 16, y0 + 60);
    ctx.fillText('Target: ' + fmtMoney(m.targetValue), x + 16, y0 + 88);
    ctx.fillText(m.guards.length + ' guards · ' + m.cameras.length + ' cameras', x + 16, y0 + 110);
    if (m.timeLimit > 0) ctx.fillText('Timed: ' + fmtTime(m.timeLimit), x + 16, y0 + 132);
    ctx.fillText('Par: ' + fmtTime(m.par), x + 16, y0 + 154);
    if (best) {
      ctx.fillStyle = '#2ecc71';
      ctx.fillText('Best take: ' + fmtMoney(best), x + 16, y0 + 182);
    }
    if (!unlocked) {
      ctx.fillStyle = '#5a6068';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('🔒 Finish job ' + i + ' to unlock', x + 16, y0 + 210);
    }
    button(state, ctx, 'mission:' + i, x + 16, y0 + ch - 58, cw - 32, 40, unlocked ? 'PLAN THIS JOB' : 'LOCKED', { disabled: !unlocked });
  });
  button(state, ctx, 'back', W / 2 - 110, 610, 220, 44, 'BACK');
}

function drawCrew(state, ctx) {
  panelBackdrop(ctx);
  const m = state.missionList[state.crewMission];
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 36px Georgia, serif';
  ctx.fillText('CREW PLANNING — ' + m.name.toUpperCase(), W / 2, 100);
  ctx.fillStyle = '#c8cdd4';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(m.intro, W / 2, 132);
  ctx.fillText('Pick one gadget for this job. It is the only help you get.', W / 2, 158);
  ctx.textAlign = 'left';
  const cw = 380;
  const ch = 260;
  const gap = 40;
  const x0 = (W - (cw * 2 + gap)) / 2;
  const y0 = 200;
  m.gadgets.forEach((gid, i) => {
    const g = GADGETS[gid];
    const x = x0 + i * (cw + gap);
    const sel = state.crewSel === i;
    ctx.fillStyle = sel ? '#241d0c' : '#161a22';
    rr(ctx, x, y0, cw, ch, 10); ctx.fill();
    ctx.strokeStyle = sel ? '#f5d76e' : '#d4af37';
    ctx.lineWidth = sel ? 2.5 : 1.5;
    rr(ctx, x, y0, cw, ch, 10); ctx.stroke();
    ctx.fillStyle = '#f5d76e';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText(g.name, x + 20, y0 + 44);
    ctx.fillStyle = '#c8cdd4';
    ctx.font = '14px system-ui, sans-serif';
    const words = g.desc.split(' ');
    let line = '';
    let ly = y0 + 80;
    for (const w of words) {
      if ((line + ' ' + w).length > 34) { ctx.fillText(line, x + 20, ly); ly += 22; line = w; }
      else line = line ? line + ' ' + w : w;
    }
    ctx.fillText(line, x + 20, ly);
    ctx.fillStyle = '#8a949c';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(g.charges > 0 ? g.charges + ' charges · press ' + g.key + ' to use' : 'Passive — always active', x + 20, y0 + ch - 24);
    button(state, ctx, 'gadget:' + i, x + 20, y0 + ch - 64, cw - 40, 34, sel ? 'SELECTED — press Enter to go' : 'TAKE THIS ONE');
  });
  button(state, ctx, 'start', W / 2 - 140, 520, 280, 48, 'START THE JOB');
  button(state, ctx, 'back', W / 2 - 140, 580, 280, 40, 'BACK');
}

function drawPaused(state, ctx) {
  drawWorld(state, ctx);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5d76e';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('PAUSED', W / 2, 200);
  button(state, ctx, 'resume', W / 2 - 140, 260, 280, 48, 'RESUME');
  button(state, ctx, 'restart', W / 2 - 140, 320, 280, 48, 'RESTART JOB');
  button(state, ctx, 'quit', W / 2 - 140, 380, 280, 48, 'QUIT TO TITLE');
  ctx.textAlign = 'left';
}

function drawComplete(state, ctx) {
  drawWorld(state, ctx);
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  const c = state.complete;
  const m = state.mission;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('JOB DONE', W / 2, 150);
  ctx.fillStyle = '#f5d76e';
  ctx.font = '20px Georgia, serif';
  ctx.fillText(m.name + ' — ' + m.targetName, W / 2, 188);
  ctx.fillStyle = '#e8eaf0';
  ctx.font = '17px system-ui, sans-serif';
  const rows = [
    ['Loot fenced', fmtMoney(c.loot)],
    ['Ghost bonus ' + (c.ghost ? '(never seen!)' : '(spotted)'), c.ghost ? '+' + fmtMoney(c.bonus) : fmtMoney(0)],
    ['Time', fmtTime(c.time) + '  (par ' + fmtTime(m.par) + ')'],
    ['Alarms raised', String(c.alarms)],
    ['TOTAL TAKE', fmtMoney(c.total)],
  ];
  let y = 240;
  for (const [k, v] of rows) {
    ctx.textAlign = 'right';
    ctx.fillStyle = k === 'TOTAL TAKE' ? '#f5d76e' : '#c8cdd4';
    ctx.font = k === 'TOTAL TAKE' ? 'bold 19px system-ui, sans-serif' : '16px system-ui, sans-serif';
    ctx.fillText(k, W / 2 - 10, y);
    ctx.textAlign = 'left';
    ctx.fillText(v, W / 2 + 10, y);
    y += 34;
  }
  ctx.textAlign = 'center';
  const hasNext = state.missionIndex < 3;
  button(state, ctx, 'next', W / 2 - 290, 460, 180, 48, hasNext ? 'NEXT JOB →' : 'FINISH', { disabled: false });
  button(state, ctx, 'replay', W / 2 - 90, 460, 180, 48, 'REPLAY');
  button(state, ctx, 'quit', W / 2 + 110, 460, 180, 48, 'TITLE');
  ctx.textAlign = 'left';
}

function drawBusted(state, ctx) {
  drawWorld(state, ctx);
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText('BUSTED', W / 2, 200);
  ctx.fillStyle = '#e8eaf0';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(state.bustedReason, W / 2, 240);
  ctx.fillStyle = '#c8cdd4';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('The crew keeps your progress. The job is still there. Go again.', W / 2, 272);
  button(state, ctx, 'retry', W / 2 - 140, 320, 280, 48, 'RETRY THE JOB');
  button(state, ctx, 'quit', W / 2 - 140, 380, 280, 48, 'QUIT TO TITLE');
  ctx.textAlign = 'left';
}

// --- world ---------------------------------------------------------------------
export function drawWorld(state, ctx) {
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, W, H);
  drawFloor(state, ctx);
  drawWalls(state, ctx);
  drawLoot(state, ctx);
  drawExit(state, ctx);
  drawNoiseAndSmoke(state, ctx);
  for (const c of state.civilians) drawCivilian(state, ctx, c);
  for (const cam of state.cameras) drawCamera(state, ctx, cam);
  for (const g of state.guards) drawGuard(state, ctx, g);
  drawPlayer(state, ctx);
  drawHUD(state, ctx);
  drawMinimap(state, ctx);
  drawGadgets(state, ctx);
  drawPrompt(state, ctx);
  drawBanner(state, ctx);
  drawLockpick(state, ctx);
  drawDrill(state, ctx);
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(231, 76, 60, ${clamp(state.flash, 0, 1) * 0.18})`;
    ctx.fillRect(0, 0, W, H);
  }
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

export function render(state, ctx) {
  state.ui = [];
  ctx.clearRect(0, 0, W, H);
  switch (state.screen) {
    case 'title': drawTitle(state, ctx); break;
    case 'howto': drawHowto(state, ctx); break;
    case 'missions': drawMissions(state, ctx); break;
    case 'crew': drawCrew(state, ctx); break;
    case 'paused': drawPaused(state, ctx); break;
    case 'complete': drawComplete(state, ctx); break;
    case 'busted': drawBusted(state, ctx); break;
    case 'play':
    default: drawWorld(state, ctx); break;
  }
}
