import { Game, Tower, Monster, GameMap, TowerType } from '../types/game.types';
import { TOWER_CONFIG, MONSTER_CONFIG, PLAYER_COLORS } from '../constants/game.constants';

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number = 32;
  private cameraX: number = 0;
  private cameraY: number = 0;
  private animationFrame: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context');
    this.ctx = ctx;
  }

  setCellSize(size: number): void {
    this.cellSize = size;
  }

  setCamera(x: number, y: number): void {
    this.cameraX = x;
    this.cameraY = y;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(game: Game, selectedTowerType: TowerType | null, selectedTowerId: string | null): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    this.ctx.translate(-this.cameraX, -this.cameraY);

    this.drawTerrain(game.map);
    this.drawPaths(game.map);
    this.drawPlayerAreas(game);
    this.drawBase(game.map);
    this.drawTowers(game.towers, selectedTowerId);
    this.drawMonsters(game.monsters);
    this.drawPings(game.pings);
    
    if (selectedTowerType) {
      // TODO: Draw placement preview
    }

    this.ctx.restore();
  }

  private drawTerrain(map: GameMap): void {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.terrain[y][x];
        const px = x * this.cellSize;
        const py = y * this.cellSize;

        switch (terrain) {
          case 'plain':
            this.ctx.fillStyle = '#2d5a27';
            break;
          case 'highland':
            this.ctx.fillStyle = '#8b7355';
            break;
          case 'water':
            this.ctx.fillStyle = '#1e90ff';
            break;
        }

        this.ctx.fillRect(px, py, this.cellSize, this.cellSize);
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(px, py, this.cellSize, this.cellSize);
      }
    }
  }

  private drawPaths(map: GameMap): void {
    for (let i = 0; i < map.paths.length; i++) {
      const path = map.paths[i];
      
      this.ctx.fillStyle = '#a0522d';
      for (const point of path) {
        const px = point.x * this.cellSize;
        const py = point.y * this.cellSize;
        this.ctx.fillRect(px, py, this.cellSize, this.cellSize);
      }

      if (path.length > 1) {
        this.ctx.strokeStyle = '#8b4513';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(
          path[0].x * this.cellSize + this.cellSize / 2,
          path[0].y * this.cellSize + this.cellSize / 2
        );
        
        for (let j = 1; j < path.length; j++) {
          this.ctx.lineTo(
            path[j].x * this.cellSize + this.cellSize / 2,
            path[j].y * this.cellSize + this.cellSize / 2
          );
        }
        this.ctx.stroke();
      }
    }
  }

  private drawPlayerAreas(game: Game): void {
    for (let i = 0; i < game.players.length; i++) {
      const player = game.players[i];
      const bounds = player.areaBounds;
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([10, 5]);
      this.ctx.strokeRect(
        bounds.x * this.cellSize,
        bounds.y * this.cellSize,
        bounds.width * this.cellSize,
        bounds.height * this.cellSize
      );
      this.ctx.setLineDash([]);
    }
  }

  private drawBase(map: GameMap): void {
    const px = map.basePosition.x * this.cellSize + this.cellSize / 2;
    const py = map.basePosition.y * this.cellSize + this.cellSize / 2;
    const size = this.cellSize * 1.5;

    this.ctx.fillStyle = '#ffd700';
    this.ctx.beginPath();
    this.ctx.moveTo(px, py - size / 2);
    this.ctx.lineTo(px + size / 2, py);
    this.ctx.lineTo(px + size / 3, py + size / 2);
    this.ctx.lineTo(px - size / 3, py + size / 2);
    this.ctx.lineTo(px - size / 2, py);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = '#b8860b';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  private drawTowers(towers: Tower[], selectedTowerId: string | null): void {
    for (const tower of towers) {
      const config = TOWER_CONFIG[tower.type];
      const px = tower.x * this.cellSize + this.cellSize / 2;
      const py = tower.y * this.cellSize + this.cellSize / 2;
      const size = this.cellSize * 0.8;

      if (tower.id === selectedTowerId) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.beginPath();
        this.ctx.arc(px, py, tower.range * this.cellSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }

      if (tower.isTrap) {
        this.ctx.fillStyle = config.color;
        this.ctx.fillRect(px - size / 2, py - size / 2, size, size);
        
        if (tower.trapCooldown && tower.trapCooldown > 0) {
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          const cooldownHeight = size * (tower.trapCooldown / 20);
          this.ctx.fillRect(px - size / 2, py - size / 2, size, cooldownHeight);
        }
      } else if (config.isAmplifier) {
        this.ctx.fillStyle = config.color;
        this.ctx.beginPath();
        this.ctx.moveTo(px, py - size / 2);
        this.ctx.lineTo(px + size / 2, py + size / 2);
        this.ctx.lineTo(px - size / 2, py + size / 2);
        this.ctx.closePath();
        this.ctx.fill();
      } else {
        this.ctx.fillStyle = config.color;
        this.ctx.beginPath();
        this.ctx.arc(px, py, size / 2, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }

      if (tower.level > 1) {
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Lv${tower.level}`, px, py + size / 2 + 12);
      }

      if (tower.branch) {
        const branchColor = tower.branch === 'a' ? '#00ff88' : '#ff4466';
        this.ctx.fillStyle = branchColor;
        this.ctx.beginPath();
        this.ctx.arc(px + size / 2 - 3, py - size / 2 + 3, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  private drawMonsters(monsters: Monster[]): void {
    for (const monster of monsters) {
      if (monster.isStealthed) {
        this.ctx.globalAlpha = 0.3;
      }

      const config = MONSTER_CONFIG[monster.type];
      const px = monster.x * this.cellSize + this.cellSize / 2;
      const py = monster.y * this.cellSize + this.cellSize / 2;
      const size = this.cellSize * config.size;

      if (monster.isFlying) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(px, py + size / 2, size / 2, size / 4, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.fillStyle = config.color;
      if (monster.type === 'boss') {
        this.ctx.fillRect(px - size / 2, py - size / 2, size, size);
      } else if (monster.type === 'elite') {
        this.ctx.beginPath();
        this.ctx.moveTo(px, py - size / 2);
        this.ctx.lineTo(px + size / 2, py);
        this.ctx.lineTo(px, py + size / 2);
        this.ctx.lineTo(px - size / 2, py);
        this.ctx.closePath();
        this.ctx.fill();
      } else {
        this.ctx.beginPath();
        this.ctx.arc(px, py, size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.globalAlpha = 1;

      const hpRatio = monster.hp / monster.maxHp;
      const barWidth = size * 1.2;
      const barHeight = 4;
      const barX = px - barWidth / 2;
      const barY = py - size / 2 - 8;

      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(barX, barY, barWidth, barHeight);

      let hpColor = '#4ade80';
      if (hpRatio < 0.3) hpColor = '#ef4444';
      else if (hpRatio < 0.6) hpColor = '#f59e0b';

      this.ctx.fillStyle = hpColor;
      this.ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

      if (monster.hasShield && monster.shieldHp) {
        const shieldRatio = monster.shieldHp / (monster.maxHp * 0.3);
        this.ctx.fillStyle = '#60a5fa';
        this.ctx.fillRect(barX, barY - 5, barWidth * shieldRatio, 3);
      }

      if (monster.poisonStacks && monster.poisonStacks > 0) {
        this.ctx.fillStyle = '#22c55e';
        this.ctx.font = 'bold 9px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`☠${monster.poisonStacks}`, px + size / 2, py - size / 2);
      }

      if (monster.slowTimer && monster.slowTimer > 0) {
        this.ctx.fillStyle = '#06b6d4';
        this.ctx.font = 'bold 9px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('❄', px - size / 2, py - size / 2);
      }

      if (monster.immuneType && monster.immuneType !== 'none') {
        const immuneColor = monster.immuneType === 'physical' ? '#fbbf24' : '#a78bfa';
        this.ctx.fillStyle = immuneColor;
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🛡', px, py);
      }

      if (monster.isRaging) {
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(px, py, size / 2 + 3, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
  }

  private drawPings(pings: { id: string; x: number; y: number; playerId: string; timer: number }[]): void {
    for (const ping of pings) {
      const px = ping.x * this.cellSize + this.cellSize / 2;
      const py = ping.y * this.cellSize + this.cellSize / 2;
      
      const alpha = ping.timer / 5;
      const pulse = 1 + Math.sin(Date.now() / 100) * 0.2;
      
      this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.7})`;
      this.ctx.font = `${20 * pulse}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText('❗', px, py);
    }
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX + this.cameraX) / this.cellSize,
      y: (screenY + this.cameraY) / this.cellSize
    };
  }

  worldToGrid(worldX: number, worldY: number): { gridX: number; gridY: number } {
    return {
      gridX: Math.floor(worldX),
      gridY: Math.floor(worldY)
    };
  }

  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}
