// Level packs and looks. Every level is one screen: a 30 by 14 tile map plus the
// cast that lives in it. Map letters: '#' wall, '.' floor, 'r' public floor
// (the casino's open gaming floor, drawn as carpet), 'C' cover (blocks sight
// and movement), 'D' open door, 'L' locked door, 'P' the thief's start, 'E' the
// getaway door, 'G' a guard spawn, 'K' a wall camera, 'X' a laser emitter post
// (solid; a beam runs between a pair of them), 'o' small loot, 'O' big loot,
// 'T' the target loot the whole level is about, 'S' a safe, 'v' shadow (a guard's
// cone cannot find the thief there unless it is almost on top of them).
//
// Each candidate is one theme with one signature mechanic:
//   museum  — laser grids that cycle on and off across the corridors;
//   casino  — a disguise that fools guards (never cameras) at a distance;
//   bank    — safe-cracking under pressure, more guards, tighter patrols.
// This file ships the casino pack; the museum and bank packs are its siblings.
//
// Layout skeleton, shared by the three floors: two divider walls (columns 12 and
// 24) split the floor into a west wing, a middle wing and a vault wing, joined by
// doors and by two open corridors (rows 5 and 10), so every room has several
// routes in and out. The casino's public floor ('r') is where the disguise
// earns its keep: guards stroll it expecting guests, not thieves.
export const THEMES = {
  museum: {
    name: 'The Gilded Vault',
    floorA: '#3a2f2b',
    floorB: '#342a26',
    carpet: '#5e1f24',
    wall: '#241a20',
    wallTop: '#4a2c33',
    cover: '#6b4f2a',
    coverTop: '#a97e3f',
    shadow: 'rgba(8, 6, 18, 0.55)',
    accent: '#e8b64c',
    accentSoft: '#f5d98a',
    lootGlow: '#ffd76a',
    danger: '#e5484d',
    text: '#f3e6c8',
    muted: '#b9a684',
    smallLoot: 'Painting',
    bigLoot: 'Golden Idol',
  },
  casino: {
    name: 'Neon Cut',
    floorA: '#14291f',
    floorB: '#10231a',
    carpet: '#3d1a5e',
    wall: '#0d1526',
    wallTop: '#1d2f52',
    cover: '#1f6f5c',
    coverTop: '#2fb394',
    shadow: 'rgba(6, 8, 20, 0.55)',
    accent: '#ff4fd8',
    accentSoft: '#7df9ff',
    lootGlow: '#ff5ce1',
    danger: '#ff3b30',
    text: '#eaf6ff',
    muted: '#9fc6d8',
    smallLoot: 'Chip Stack',
    bigLoot: 'Cash Case',
  },
  bank: {
    name: 'The Black Ledger',
    floorA: '#1d2431',
    floorB: '#181e29',
    carpet: '#232c3d',
    wall: '#0e1420',
    wallTop: '#24344d',
    cover: '#3c4a63',
    coverTop: '#6b7fa3',
    shadow: 'rgba(4, 6, 16, 0.6)',
    accent: '#6ea8ff',
    accentSoft: '#a8c8ff',
    lootGlow: '#7db4ff',
    danger: '#ff5347',
    text: '#dfe9ff',
    muted: '#93a5c4',
    smallLoot: 'Cash Bundle',
    bigLoot: 'Gold Bars',
  },
};

// The casino pack: three floors of the Meridian Casino, from the neon gaming
// floor up to the vault where the house keeps its gold. The disguise is the
// whole game here: walk the public floor like a guest, and only run when no
// guard is watching.
export const LEVELS = [
  {
    name: 'The Neon Floor',
    subtitle: 'Blend in. Lift the Meridian Chip.',
    theme: 'casino',
    mechanic: 'disguise',
    par: 90,
    targetName: 'The Meridian Chip',
    tools: { smoke: 2, emp: 1, picks: 2 },
    map: [
      '##############################',
      '#P...v......#....o......#...T#',
      '#....C......#....C..r...#.S..#',
      '#....o...r..D....o......D....#',
      '#....r......#....r......#....#',
      '#...C......r..v........rC....#',
      '#....C......#....v......#..o.#',
      '#..G........D....C...G..D....#',
      '#....r......#....r......#....#',
      '#..o..v.....#..o...rC...#....#',
      '#....rC.................C....#',
      '#....C......#.....rK....#....#',
      '#..o...G....D...O.......#..E.#',
      '##############################',
    ],
    guards: [
      { x: 3, y: 7, waypoints: [[3, 7], [11, 7], [11, 8], [3, 8]], pause: 1.0 },
      { x: 21, y: 7, waypoints: [[21, 7], [18, 7], [18, 8], [21, 8]], pause: 1.2 },
      { x: 8, y: 12, waypoints: [[8, 12], [3, 12], [3, 9], [8, 9]], pause: 0.8 },
    ],
    lasers: [],
  },
  {
    name: 'The High-Roller Suite',
    subtitle: 'The suite is watched. Wear the tux.',
    theme: 'casino',
    mechanic: 'disguise',
    par: 120,
    targetName: "The High-Roller's Hoard",
    tools: { smoke: 2, emp: 2, picks: 2 },
    map: [
      '##############################',
      '#P...v......#....o......#...T#',
      '#....C...S..#....C..r...#.S..#',
      '#....o...r..L....o......D....#',
      '#....r......#....r......#....#',
      '#...C......r..v........rC....#',
      '#....v......#....CX.....#..o.#',
      '#..G........D....G......D....#',
      '#....r......#....r......#....#',
      '#..C..o.....#..v..Xo....#..C.#',
      '#....rC.................C....#',
      '#....C......#.....K.....#....#',
      '#..G...o....D....O..G...#..E.#',
      '##############################',
    ],
    guards: [
      { x: 3, y: 7, waypoints: [[3, 7], [11, 7], [11, 8], [3, 8]], pause: 1.0 },
      { x: 17, y: 7, waypoints: [[17, 7], [21, 7], [21, 8], [17, 8]], pause: 1.1 },
      { x: 3, y: 12, waypoints: [[3, 12], [10, 12]], pause: 0.9 },
      { x: 20, y: 12, waypoints: [[20, 12], [23, 12]], pause: 1.3 },
    ],
    // One beam across the middle band: the suite's back room is lasered, so
    // the disguise alone will not carry the big loot out.
    lasers: [
      { x1: 18, y1: 6, x2: 18, y2: 9, on: 2.2, off: 1.6, phase: 0.0 },
    ],
  },
  {
    name: 'The Meridian Vault',
    subtitle: 'Past the tables, past the lasers: the gold.',
    theme: 'casino',
    mechanic: 'disguise',
    par: 150,
    targetName: 'The Vault Gold',
    tools: { smoke: 3, emp: 2, picks: 2 },
    map: [
      '##############################',
      '#P...v......#....oX.....#...T#',
      '#....C...S..#....C..r...#.S..#',
      '#....o...r..L....o......D....#',
      '#....r......#.....X.....#....#',
      '#...C......r..v........rC....#',
      '#....v......#....CX.....#..o.#',
      '#..G........D....G......D....#',
      '#....r......#....r......#....#',
      '#..C..o.....#..v..Xo....#..C.#',
      '#....rC.................C....#',
      '#....C......#....KX.....#....#',
      '#..G...o....D....OX.G...#..E.#',
      '##############################',
    ],
    guards: [
      { x: 3, y: 7, waypoints: [[3, 7], [11, 7], [11, 8], [3, 8]], pause: 0.9 },
      { x: 17, y: 7, waypoints: [[17, 7], [21, 7], [21, 8], [17, 8]], pause: 1.0 },
      { x: 3, y: 12, waypoints: [[3, 12], [10, 12]], pause: 0.8 },
      { x: 20, y: 12, waypoints: [[20, 12], [23, 12]], pause: 1.2 },
    ],
    lasers: [
      { x1: 18, y1: 1, x2: 18, y2: 4, on: 2.2, off: 1.5, phase: 0.0 },
      { x1: 18, y1: 6, x2: 18, y2: 9, on: 1.8, off: 1.8, phase: 0.9 },
      { x1: 18, y1: 11, x2: 18, y2: 12, on: 2.6, off: 1.4, phase: 0.4 },
    ],
  },
];
