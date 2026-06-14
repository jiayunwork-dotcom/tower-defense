import type { GameMap, TerrainType, PathPoint } from '../types/game.types';

function createTerrain(width: number, height: number, type: TerrainType): TerrainType[][] {
  return Array(height).fill(null).map(() => Array(width).fill(type));
}

function generateSimplePath(startX: number, startY: number, endX: number, endY: number): PathPoint[] {
  const path: PathPoint[] = [];
  let x = startX;
  let y = startY;
  
  while (x !== endX || y !== endY) {
    path.push({ x, y });
    
    if (x < endX) x++;
    else if (x > endX) x--;
    else if (y < endY) y++;
    else if (y > endY) y--;
  }
  
  path.push({ x: endX, y: endY });
  return path;
}

const PRESET_MAPS: Record<string, Omit<GameMap, 'cellSize'>> = {
  easy: {
    name: '简单模式',
    difficulty: 'easy',
    width: 40,
    height: 30,
    basePosition: { x: 20, y: 15 },
    terrain: (() => {
      const terrain = createTerrain(40, 30, 'plain');
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 40; x++) {
          if (x >= 10 && x <= 12 && y >= 5 && y <= 8) terrain[y][x] = 'highland';
          if (x >= 28 && x <= 30 && y >= 20 && y <= 23) terrain[y][x] = 'highland';
          if (x >= 18 && x <= 22 && y >= 25 && y <= 27) terrain[y][x] = 'water';
        }
      }
      return terrain;
    })(),
    paths: [
      generateSimplePath(0, 15, 20, 15),
      generateSimplePath(39, 15, 20, 15),
    ],
    playerAreas: [
      { playerIndex: 0, bounds: { x: 0, y: 0, width: 20, height: 30 } },
      { playerIndex: 1, bounds: { x: 20, y: 0, width: 20, height: 30 } },
    ]
  },
  
  normal: {
    name: '普通模式',
    difficulty: 'normal',
    width: 40,
    height: 30,
    basePosition: { x: 20, y: 15 },
    terrain: (() => {
      const terrain = createTerrain(40, 30, 'plain');
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 40; x++) {
          if (x >= 5 && x <= 7 && y >= 8 && y <= 12) terrain[y][x] = 'highland';
          if (x >= 32 && x <= 34 && y >= 18 && y <= 22) terrain[y][x] = 'highland';
          if (x >= 15 && x <= 17 && y >= 3 && y <= 5) terrain[y][x] = 'highland';
          if (x >= 23 && x <= 25 && y >= 25 && y <= 27) terrain[y][x] = 'highland';
          if (x >= 10 && x <= 14 && y >= 20 && y <= 24) terrain[y][x] = 'water';
          if (x >= 26 && x <= 30 && y >= 6 && y <= 10) terrain[y][x] = 'water';
        }
      }
      return terrain;
    })(),
    paths: [
      generateSimplePath(0, 15, 20, 15),
      generateSimplePath(39, 15, 20, 15),
      generateSimplePath(20, 0, 20, 15),
    ],
    playerAreas: [
      { playerIndex: 0, bounds: { x: 0, y: 0, width: 20, height: 15 } },
      { playerIndex: 1, bounds: { x: 0, y: 15, width: 20, height: 15 } },
      { playerIndex: 2, bounds: { x: 20, y: 0, width: 20, height: 30 } },
    ]
  },
  
  hard: {
    name: '困难模式',
    difficulty: 'hard',
    width: 40,
    height: 30,
    basePosition: { x: 20, y: 15 },
    terrain: (() => {
      const terrain = createTerrain(40, 30, 'plain');
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 40; x++) {
          if (x >= 3 && x <= 5 && y >= 3 && y <= 6) terrain[y][x] = 'highland';
          if (x >= 35 && x <= 37 && y >= 3 && y <= 6) terrain[y][x] = 'highland';
          if (x >= 3 && x <= 5 && y >= 24 && y <= 27) terrain[y][x] = 'highland';
          if (x >= 35 && x <= 37 && y >= 24 && y <= 27) terrain[y][x] = 'highland';
          if (x >= 18 && x <= 22 && y >= 5 && y <= 8) terrain[y][x] = 'water';
          if (x >= 18 && x <= 22 && y >= 22 && y <= 25) terrain[y][x] = 'water';
          if (x >= 8 && x <= 12 && y >= 13 && y <= 17) terrain[y][x] = 'water';
          if (x >= 28 && x <= 32 && y >= 13 && y <= 17) terrain[y][x] = 'water';
        }
      }
      return terrain;
    })(),
    paths: [
      generateSimplePath(0, 8, 20, 15),
      generateSimplePath(0, 22, 20, 15),
      generateSimplePath(39, 8, 20, 15),
      generateSimplePath(39, 22, 20, 15),
    ],
    playerAreas: [
      { playerIndex: 0, bounds: { x: 0, y: 0, width: 20, height: 15 } },
      { playerIndex: 1, bounds: { x: 0, y: 15, width: 20, height: 15 } },
      { playerIndex: 2, bounds: { x: 20, y: 0, width: 20, height: 15 } },
      { playerIndex: 3, bounds: { x: 20, y: 15, width: 20, height: 15 } },
    ]
  },
  
  hell: {
    name: '地狱模式',
    difficulty: 'hell',
    width: 40,
    height: 30,
    basePosition: { x: 20, y: 15 },
    terrain: (() => {
      const terrain = createTerrain(40, 30, 'plain');
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 40; x++) {
          if ((x + y) % 7 === 0 && x > 2 && x < 38 && y > 2 && y < 28) terrain[y][x] = 'highland';
          if ((x * y) % 11 === 0 && x > 5 && x < 35 && y > 5 && y < 25) terrain[y][x] = 'water';
        }
      }
      return terrain;
    })(),
    paths: [
      generateSimplePath(0, 5, 20, 15),
      generateSimplePath(0, 15, 20, 15),
      generateSimplePath(0, 25, 20, 15),
      generateSimplePath(39, 5, 20, 15),
      generateSimplePath(39, 25, 20, 15),
    ],
    playerAreas: [
      { playerIndex: 0, bounds: { x: 0, y: 0, width: 20, height: 10 } },
      { playerIndex: 1, bounds: { x: 0, y: 10, width: 20, height: 10 } },
      { playerIndex: 2, bounds: { x: 0, y: 20, width: 20, height: 10 } },
      { playerIndex: 3, bounds: { x: 20, y: 0, width: 20, height: 30 } },
    ]
  },
  
  endless: {
    name: '无尽模式',
    difficulty: 'endless',
    width: 40,
    height: 30,
    basePosition: { x: 20, y: 15 },
    terrain: (() => {
      const terrain = createTerrain(40, 30, 'plain');
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 40; x++) {
          if (x >= 5 && x <= 8 && y >= 5 && y <= 8) terrain[y][x] = 'highland';
          if (x >= 32 && x <= 35 && y >= 5 && y <= 8) terrain[y][x] = 'highland';
          if (x >= 5 && x <= 8 && y >= 22 && y <= 25) terrain[y][x] = 'highland';
          if (x >= 32 && x <= 35 && y >= 22 && y <= 25) terrain[y][x] = 'highland';
          if (x >= 15 && x <= 25 && y >= 12 && y <= 18) terrain[y][x] = 'water';
        }
      }
      return terrain;
    })(),
    paths: [
      generateSimplePath(0, 10, 20, 15),
      generateSimplePath(0, 20, 20, 15),
      generateSimplePath(39, 10, 20, 15),
      generateSimplePath(39, 20, 20, 15),
    ],
    playerAreas: [
      { playerIndex: 0, bounds: { x: 0, y: 0, width: 20, height: 15 } },
      { playerIndex: 1, bounds: { x: 0, y: 15, width: 20, height: 15 } },
      { playerIndex: 2, bounds: { x: 20, y: 0, width: 20, height: 15 } },
      { playerIndex: 3, bounds: { x: 20, y: 15, width: 20, height: 15 } },
    ]
  }
};

export function getMapByName(name: string, cellSize: number): GameMap | null {
  const preset = PRESET_MAPS[name] || PRESET_MAPS['normal'];
  return {
    ...preset,
    cellSize
  };
}
