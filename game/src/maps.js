// maps.js — the four missions of VAULTBREAK, as ASCII tile grids.
//
// Legend:
//   #  wall            .  floor           D  locked door (lockpick)
//   K  keycard door    V  vault door      T  main loot target
//   L  side loot       S  safe (lockpick side loot)
//   C  camera          G  guard spawn     P  player start
//   X  getaway exit    =  laser grid      o  civilian (casino cover)
// Every grid is 40 columns x 21 rows. The loader validates that at build
// time (see validateMaps in main.js) so a typo can never ship silently.

export const TILE = 32;
export const COLS = 40;
export const ROWS = 21;
export const HUD_H = 48; // top HUD bar height in px; map starts below it

export const MISSIONS = [
  {
    id: 1,
    name: 'The Gallery',
    subtitle: 'Steal the Jade Fox',
    targetName: 'Jade Fox statue',
    targetValue: 12000,
    theme: 'gallery',
    seed: 101,
    par: 150,
    timeLimit: 0,
    intro: 'Two guards, one camera. Walk in like you own the place — then walk out with the Fox.',
    gadgets: ['smoke', 'lockpick'],
    grid: [
      '########################################',
      '#......................................#',
      '#..L........####........####........L..#',
      '#......................................#',
      '#....##########......##########........#',
      '#......................................#',
      '#..G..........#.........#...........G..#',
      '#......................................#',
      '#...####...........T...........####....#',
      '#......................................#',
      '#..C...................................#',
      '#......................................#',
      '#....##########......##########........#',
      '#......................................#',
      '#..L........####........####........L..#',
      '#......................................#',
      '#......................................#',
      '#...........D..........................#',
      '#......................................#',
      '#..P...............................X...#',
      '########################################',
    ],
    guards: [
      { x: 3, y: 6, waypoints: [[3, 6], [20, 6], [36, 6], [20, 6]], pause: 1.4 },
      { x: 36, y: 6, waypoints: [[36, 6], [20, 13], [3, 13], [20, 13]], pause: 1.2 },
    ],
    cameras: [
      { x: 3, y: 10, base: 0, sweep: 1.1, speed: 0.55 },
    ],
    civilians: [],
  },
  {
    id: 2,
    name: 'Meridian Bank',
    subtitle: 'Crack the vault',
    targetName: 'Meridian vault gold',
    targetValue: 45000,
    theme: 'bank',
    seed: 202,
    par: 260,
    timeLimit: 0,
    intro: 'Keycard doors, a timed vault drill, four guards who never blink. The drill is loud — plan around the patrols.',
    gadgets: ['emp', 'lockpick'],
    grid: [
      '########################################',
      '#......................................#',
      '#..L......####....K....####........L...#',
      '#......................................#',
      '#....##########.......##########.......#',
      '#......................................#',
      '#..G..........#.........#...........G..#',
      '#......................................#',
      '#.....####....#....V....#.....####.....#',
      '#............#..........#..............#',
      '#..C........#....T.....#.........C.....#',
      '#............#..........#..............#',
      '#.....####....#....S....#.....####.....#',
      '#......................................#',
      '#....##########.......##########.......#',
      '#......................................#',
      '#..L......####....K....####........L...#',
      '#......................................#',
      '#......................................#',
      '#..P...............................X...#',
      '########################################',
    ],
    guards: [
      { x: 3, y: 6, waypoints: [[3, 6], [20, 6], [36, 6], [20, 6]], pause: 1.0 },
      { x: 36, y: 6, waypoints: [[36, 6], [20, 13], [3, 13], [20, 13]], pause: 1.0 },
      { x: 10, y: 13, waypoints: [[10, 13], [10, 3], [29, 3], [29, 13]], pause: 1.3 },
      { x: 29, y: 16, waypoints: [[29, 16], [29, 3], [10, 3], [10, 17]], pause: 1.3 },
    ],
    cameras: [
      { x: 3, y: 10, base: 0, sweep: 1.2, speed: 0.6 },
      { x: 36, y: 10, base: Math.PI, sweep: 1.2, speed: 0.6 },
      { x: 20, y: 1, base: Math.PI / 2, sweep: 1.0, speed: 0.5 },
    ],
    civilians: [],
  },
  {
    id: 3,
    name: 'The Casino',
    subtitle: 'Lift the chip case',
    targetName: 'High-roller chip case',
    targetValue: 30000,
    theme: 'casino',
    seed: 303,
    par: 300,
    timeLimit: 0,
    intro: 'Five guards, four cameras — and a crowded floor. Stay near the crowd and you are just another face. The count room holds the case.',
    gadgets: ['disguise', 'smoke'],
    grid: [
      '########################################',
      '#......................................#',
      '#..L......####........####.........L...#',
      '#......o.......................o.......#',
      '#....##########......##########........#',
      '#......................................#',
      '#..G........#...........#...........G..#',
      '#.......o.......................o......#',
      '#....####.....####..####......####.....#',
      '#......................................#',
      '#..C.......#......T.......#.......C....#',
      '#......................................#',
      '#....####.....####..####......####.....#',
      '#.......o.......................o......#',
      '#..G........#...........#...........G..#',
      '#......................................#',
      '#....##########......##########........#',
      '#......o.......................o.......#',
      '#..L......####........####.........L...#',
      '#..P...............................X...#',
      '########################################',
    ],
    guards: [
      { x: 3, y: 6, waypoints: [[3, 6], [20, 6], [36, 6], [20, 6]], pause: 1.1 },
      { x: 36, y: 6, waypoints: [[36, 6], [20, 14], [3, 14], [20, 14]], pause: 1.1 },
      { x: 3, y: 14, waypoints: [[3, 14], [20, 14], [36, 14], [20, 14]], pause: 1.0 },
      { x: 36, y: 14, waypoints: [[36, 14], [20, 6], [3, 6], [20, 6]], pause: 1.0 },
      { x: 20, y: 10, waypoints: [[20, 10], [10, 10], [20, 10], [29, 10]], pause: 1.5 },
    ],
    cameras: [
      { x: 3, y: 10, base: 0, sweep: 1.1, speed: 0.55 },
      { x: 36, y: 10, base: Math.PI, sweep: 1.1, speed: 0.55 },
      { x: 20, y: 1, base: Math.PI / 2, sweep: 1.0, speed: 0.5 },
      { x: 20, y: 19, base: -Math.PI / 2, sweep: 1.0, speed: 0.5 },
    ],
    civilians: [
      { x: 7, y: 3 }, { x: 32, y: 3 }, { x: 8, y: 7 }, { x: 31, y: 7 },
      { x: 8, y: 13 }, { x: 31, y: 13 }, { x: 7, y: 17 }, { x: 32, y: 17 },
    ],
  },
  {
    id: 4,
    name: 'The Museum',
    subtitle: 'The Star of Meridian',
    targetName: 'Star of Meridian diamond',
    targetValue: 80000,
    theme: 'museum',
    seed: 404,
    par: 360,
    timeLimit: 300,
    intro: 'Six guards, five cameras, laser grids on every approach. Grab the Star, then run for the roof hatch before lockdown seals it.',
    gadgets: ['emp', 'disguise'],
    grid: [
      '########################################',
      '#......................................#',
      '#..L......####....==....####.......L...#',
      '#......................................#',
      '#....##########.......##########.......#',
      '#......................................#',
      '#..G..........#.........#...........G..#',
      '#......................................#',
      '#.....####....#....==...#.....####.....#',
      '#............#..........#..............#',
      '#..C........#....T.....#.........C.....#',
      '#............#..........#..............#',
      '#.....####....#....==...#.....####.....#',
      '#......................................#',
      '#....##########.......##########.......#',
      '#...................................X..#',
      '#..G......####....==....####........G..#',
      '#......................................#',
      '#..L.................................L.#',
      '#..P...................................#',
      '########################################',
    ],
    guards: [
      { x: 3, y: 6, waypoints: [[3, 6], [20, 6], [36, 6], [20, 6]], pause: 0.9 },
      { x: 36, y: 6, waypoints: [[36, 6], [20, 13], [3, 13], [20, 13]], pause: 0.9 },
      { x: 3, y: 16, waypoints: [[3, 16], [20, 16], [36, 16], [20, 16]], pause: 0.9 },
      { x: 36, y: 16, waypoints: [[36, 16], [20, 6], [3, 6], [20, 6]], pause: 0.9 },
      { x: 10, y: 10, waypoints: [[10, 10], [10, 3], [29, 3], [29, 10]], pause: 1.2 },
      { x: 29, y: 10, waypoints: [[29, 10], [29, 17], [10, 17], [10, 10]], pause: 1.2 },
    ],
    cameras: [
      { x: 3, y: 10, base: 0, sweep: 1.2, speed: 0.65 },
      { x: 36, y: 10, base: Math.PI, sweep: 1.2, speed: 0.65 },
      { x: 20, y: 1, base: Math.PI / 2, sweep: 1.0, speed: 0.55 },
      { x: 10, y: 19, base: -Math.PI / 2, sweep: 1.0, speed: 0.55 },
      { x: 29, y: 19, base: -Math.PI / 2, sweep: 1.0, speed: 0.55 },
    ],
    civilians: [],
  },
];

export const GADGETS = {
  smoke: {
    id: 'smoke', name: 'Smoke Bomb', key: 'Q',
    desc: 'Drop a smoke cloud. Guards cannot see through it for 5 s.',
    charges: 2,
  },
  emp: {
    id: 'emp', name: 'EMP Burst', key: 'Q',
    desc: 'Knock out every camera for 15 s and scramble guard senses for 3 s.',
    charges: 2,
  },
  lockpick: {
    id: 'lockpick', name: 'Lockpick Kit', key: 'passive',
    desc: 'Every lock opens in 2 good picks instead of 3. Always on.',
    charges: 0,
  },
  disguise: {
    id: 'disguise', name: 'Disguise', key: 'Q',
    desc: 'Look like staff for 20 s. Guards ignore you unless you get very close.',
    charges: 2,
  },
};

// Parse one mission grid into a lookup table + entity spawn lists.
// Walls block movement and sight; doors block until opened; lasers are
// floor tiles that hurt when their cycle is ON.
export function parseGrid(mission) {
  const walls = new Set();
  const doors = [];
  const loot = [];
  const safes = [];
  const lasers = [];
  let player = null;
  let target = null;
  let exit = null;
  let vault = null;
  const grid = mission.grid;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = grid[y][x];
      const key = x + ',' + y;
      if (ch === '#') walls.add(key);
      else if (ch === 'D' || ch === 'K') doors.push({ x, y, kind: ch === 'K' ? 'keycard' : 'locked', open: false });
      else if (ch === 'V') { vault = { x, y, open: false }; walls.add(key); }
      else if (ch === 'T') target = { x, y, taken: false };
      else if (ch === 'L') loot.push({ x, y, value: 1500 + ((x * 7 + y * 13) % 5) * 500, taken: false, kind: 'loot' });
      else if (ch === 'S') safes.push({ x, y, value: 6000, open: false, kind: 'safe' });
      else if (ch === 'C') { /* cameras come from mission.cameras */ }
      else if (ch === 'G') { /* guards come from mission.guards */ }
      else if (ch === 'P') player = { x, y };
      else if (ch === 'X') exit = { x, y };
      else if (ch === '=') lasers.push({ x, y, phase: (x + y) % 2 });
    }
  }
  return { walls, doors, loot, safes, lasers, player, target, exit, vault };
}

export function isWallAt(parsed, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return parsed.walls.has(tx + ',' + ty);
}

// A tile blocks movement if it is a wall, a closed door, or a closed vault.
export function blocksMove(parsed, tx, ty) {
  if (isWallAt(parsed, tx, ty)) return true;
  for (const d of parsed.doors) if (d.x === tx && d.y === ty && !d.open) return true;
  if (parsed.vault && parsed.vault.x === tx && parsed.vault.y === ty && !parsed.vault.open) return true;
  return false;
}
