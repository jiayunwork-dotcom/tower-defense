import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { 
  Game, Tower, Monster, Player, TowerType, TargetStrategy, 
  MonsterType, EliteAbility, BossSkill, ImmuneType, GameMap,
  GameState, SkillType, Position
} from '../types/game.types';
import { 
  TOWER_CONFIG, MONSTER_CONFIG, INITIAL_LIVES, BOSS_LIFE_COST, 
  NORMAL_LIFE_COST, PLAYER_COLORS, SKILL_COOLDOWN, INTEREST_RATE,
  INTEREST_MAX, INTEREST_PER_UNIT, WAVE_PREP_TIME, GAME_TICK_RATE,
  HIGHLAND_DAMAGE_BONUS, WATER_SLOW_AMOUNT, CELL_SIZE
} from '../constants/game.constants';
import { getMapByName } from '../config/maps.config';

@Injectable()
export class GameEngineService {
  private games: Map<string, Game> = new Map();
  private gameIntervals: Map<string, NodeJS.Timeout> = new Map();

  createGame(roomId: string, mapName: string, players: Player[]): Game {
    const map = getMapByName(mapName, CELL_SIZE);
    if (!map) throw new Error('Map not found');

    const isEndless = mapName === 'endless';
    const totalWaves = isEndless ? Infinity : mapName === 'hell' ? 50 : 30;
    
    const initialGold = this.getInitialGold(players.length);

    const game: Game = {
      id: roomId,
      state: 'preparing',
      map,
      players: players.map((p, i) => ({
        ...p,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        assignedPaths: this.assignPathsToPlayer(i, players.length, map.paths.length),
        areaBounds: map.playerAreas[i]?.bounds || { x: 0, y: 0, width: 20, height: 30 },
        skillCooldown: 0,
        kills: 0,
        isConnected: true
      })),
      towers: [],
      monsters: [],
      gold: initialGold,
      lives: INITIAL_LIVES,
      maxLives: INITIAL_LIVES,
      currentWave: 0,
      totalWaves,
      waveTimer: WAVE_PREP_TIME,
      isWaveActive: false,
      waveMonsterIndex: 0,
      spawnTimer: 0,
      gameSpeed: 1,
      speedVote: [],
      skipWaveVote: [],
      pings: [],
      elapsedTime: 0,
      difficulty: map.difficulty,
      isEndless,
      endlessMultiplier: 1,
      towerDamageBuffs: new Map()
    };

    this.games.set(roomId, game);
    return game;
  }

  private getInitialGold(playerCount: number): number {
    const perPlayer = [0, 0, 250, 200, 150][playerCount] || 150;
    return perPlayer * playerCount;
  }

  private assignPathsToPlayer(playerIndex: number, playerCount: number, pathCount: number): number[] {
    const paths: number[] = [];
    const pathsPerPlayer = Math.ceil(pathCount / playerCount);
    const start = playerIndex * pathsPerPlayer;
    for (let i = 0; i < pathsPerPlayer && start + i < pathCount; i++) {
      paths.push(start + i);
    }
    return paths;
  }

  startGameLoop(gameId: string, onTick: (game: Game) => void): void {
    const game = this.games.get(gameId);
    if (!game) return;

    game.state = 'playing';
    
    const interval = setInterval(() => {
      const g = this.games.get(gameId);
      if (!g) {
        clearInterval(interval);
        return;
      }
      
      if (g.state === 'playing') {
        this.tick(g);
        onTick(g);
      }
    }, 1000 / GAME_TICK_RATE);

    this.gameIntervals.set(gameId, interval);
  }

  stopGameLoop(gameId: string): void {
    const interval = this.gameIntervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.gameIntervals.delete(gameId);
    }
  }

  private tick(game: Game): void {
    const deltaTime = (1 / GAME_TICK_RATE) * game.gameSpeed;
    game.elapsedTime += deltaTime;

    if (!game.isWaveActive) {
      this.updateWaveTimer(game, deltaTime);
    } else {
      this.updateWave(game, deltaTime);
    }

    this.updateMonsters(game, deltaTime);
    this.updateTowers(game, deltaTime);
    this.updatePlayerSkills(game, deltaTime);
    this.updatePings(game, deltaTime);
    this.updateTowerBuffs(game);
    this.checkGameEnd(game);
  }

  private updateWaveTimer(game: Game, deltaTime: number): void {
    game.waveTimer -= deltaTime;
    if (game.waveTimer <= 0 || game.skipWaveVote.length >= game.players.filter(p => p.isConnected).length) {
      this.startWave(game);
    }
  }

  private startWave(game: Game): void {
    game.currentWave++;
    game.isWaveActive = true;
    game.waveMonsterIndex = 0;
    game.spawnTimer = 0;
    game.skipWaveVote = [];
    
    if (game.isEndless && game.currentWave > 10 && game.currentWave % 10 === 1) {
      game.endlessMultiplier *= 1.2;
    }
  }

  private updateWave(game: Game, deltaTime: number): void {
    game.spawnTimer -= deltaTime;
    
    if (game.spawnTimer <= 0) {
      this.spawnNextMonster(game);
    }

    if (game.monsters.length === 0 && this.allMonstersSpawned(game)) {
      this.endWave(game);
    }
  }

  private getWaveMonsters(game: Game): { type: MonsterType; count: number; interval: number; pathId?: number }[] {
    const wave = game.currentWave;
    const monsters: { type: MonsterType; count: number; interval: number; pathId?: number }[] = [];
    
    const isBossWave = wave % 10 === 0;
    
    if (wave <= 5) {
      monsters.push({ type: 'normal', count: 5 + wave * 3, interval: 1 });
    } else if (wave <= 10) {
      monsters.push({ type: 'normal', count: 10 + wave * 2, interval: 0.8 });
      monsters.push({ type: 'elite', count: Math.floor(wave / 3), interval: 2 });
      if (wave >= 8) {
        monsters.push({ type: 'flying', count: Math.floor(wave / 4), interval: 1.5 });
      }
    } else {
      monsters.push({ type: 'normal', count: 15 + wave, interval: 0.6 });
      monsters.push({ type: 'elite', count: Math.floor(wave / 2), interval: 1.5 });
      monsters.push({ type: 'flying', count: Math.floor(wave / 3), interval: 1.2 });
    }

    if (isBossWave) {
      monsters.push({ type: 'boss', count: 1, interval: 0 });
    }

    return monsters;
  }

  private allMonstersSpawned(game: Game): boolean {
    const waveMonsters = this.getWaveMonsters(game);
    let totalCount = 0;
    for (const m of waveMonsters) {
      totalCount += m.count;
    }
    return game.waveMonsterIndex >= totalCount;
  }

  private spawnNextMonster(game: Game): void {
    const waveMonsters = this.getWaveMonsters(game);
    
    let countSoFar = 0;
    let currentMonsterConfig: { type: MonsterType; count: number; interval: number; pathId?: number } | null = null;
    
    for (const m of waveMonsters) {
      if (game.waveMonsterIndex < countSoFar + m.count) {
        currentMonsterConfig = m;
        break;
      }
      countSoFar += m.count;
    }

    if (!currentMonsterConfig) {
      game.spawnTimer = 1;
      return;
    }

    const pathId = currentMonsterConfig.pathId ?? 
      Math.floor(Math.random() * game.map.paths.length);
    
    this.spawnMonster(game, currentMonsterConfig.type, pathId);
    game.waveMonsterIndex++;
    game.spawnTimer = currentMonsterConfig.interval;
  }

  private spawnMonster(game: Game, type: MonsterType, pathId: number): void {
    const config = MONSTER_CONFIG[type];
    const path = game.map.paths[pathId];
    if (!path || path.length === 0) return;

    const multiplier = game.endlessMultiplier;
    
    let hp = config.baseHp * multiplier;
    let armor = config.baseArmor;
    let magicResist = config.baseMagicResist;
    let speed = config.baseSpeed;

    if (game.difficulty === 'hard') {
      hp *= 1.3;
      armor += 0.1;
    } else if (game.difficulty === 'hell') {
      hp *= 1.6;
      armor += 0.15;
      magicResist += 0.1;
      speed *= 1.1;
    }

    const monster: Monster = {
      id: uuidv4(),
      type,
      hp,
      maxHp: hp,
      armor,
      magicResist,
      speed,
      baseSpeed: speed,
      x: path[0].x,
      y: path[0].y,
      pathIndex: 0,
      pathId,
      progress: 0,
      gold: config.gold,
      isFlying: type === 'flying',
      poisonStacks: 0,
      slowTimer: 0
    };

    if (type === 'elite') {
      const abilities: EliteAbility[] = ['stealth', 'split', 'regen', 'shield'];
      monster.eliteAbility = abilities[Math.floor(Math.random() * abilities.length)];
      
      if (monster.eliteAbility === 'shield') {
        monster.hasShield = true;
        monster.shieldHp = hp * 0.3;
      }
      if (monster.eliteAbility === 'stealth') {
        monster.isStealthed = true;
        monster.stealthTimer = 5;
      }
      if (monster.eliteAbility === 'regen') {
        monster.regenTimer = 0;
      }
    }

    if (type === 'boss') {
      const skills: BossSkill[] = ['stomp', 'summon', 'rage', 'immune'];
      monster.bossSkills = skills.slice(0, 2 + Math.floor(Math.random() * 2));
      monster.immuneType = 'none';
      monster.immuneTimer = 10;
      monster.isRaging = false;
    }

    game.monsters.push(monster);
  }

  private endWave(game: Game): void {
    game.isWaveActive = false;
    
    if (game.currentWave < game.totalWaves || game.isEndless) {
      game.waveTimer = WAVE_PREP_TIME;
    }

    const interest = Math.min(
      Math.floor(game.gold / INTEREST_PER_UNIT) * INTEREST_RATE * INTEREST_PER_UNIT,
      INTEREST_MAX
    );
    game.gold += interest;
  }

  private updateMonsters(game: Game, deltaTime: number): void {
    for (let i = game.monsters.length - 1; i >= 0; i--) {
      const monster = game.monsters[i];
      
      this.updateMonsterEffects(monster, deltaTime, game);
      
      if (monster.hp <= 0) {
        this.killMonster(game, monster, i);
        continue;
      }

      if (monster.slowTimer && monster.slowTimer > 0) {
        monster.slowTimer -= deltaTime;
        if (monster.slowTimer <= 0) {
          monster.speed = monster.baseSpeed;
          monster.slowAmount = 0;
        }
      }

      this.moveMonster(monster, deltaTime, game);

      if (this.hasReachedBase(monster, game)) {
        this.monsterReachBase(game, monster, i);
      }
    }
  }

  private updateMonsterEffects(monster: Monster, deltaTime: number, game: Game): void {
    if (monster.poisonStacks && monster.poisonStacks > 0 && monster.poisonTimer && monster.poisonTimer > 0) {
      const dotDamage = 8 * monster.poisonStacks * deltaTime;
      this.applyDamage(monster, dotDamage, 'magic');
      monster.poisonTimer -= deltaTime;
      if (monster.poisonTimer <= 0) {
        monster.poisonStacks = 0;
      }
    }

    if (monster.eliteAbility === 'regen' && monster.regenTimer !== undefined) {
      monster.regenTimer += deltaTime;
      if (monster.regenTimer >= 3) {
        monster.hp = Math.min(monster.maxHp, monster.hp + monster.maxHp * 0.02 * deltaTime);
      }
    }

    if (monster.isStealthed && monster.stealthTimer !== undefined) {
      monster.stealthTimer -= deltaTime;
      if (monster.stealthTimer <= 0) {
        monster.isStealthed = false;
      }
    }

    if (monster.type === 'boss' && monster.immuneTimer !== undefined) {
      monster.immuneTimer -= deltaTime;
      if (monster.immuneTimer <= 0) {
        monster.immuneType = monster.immuneType === 'physical' ? 'magic' : 
                            monster.immuneType === 'magic' ? 'none' : 'physical';
        monster.immuneTimer = 10;
      }
    }

    if (monster.type === 'boss' && monster.bossSkills?.includes('rage') && !monster.isRaging) {
      if (monster.hp / monster.maxHp < 0.3) {
        monster.isRaging = true;
        monster.baseSpeed *= 2;
        monster.speed *= 2;
      }
    }
  }

  private moveMonster(monster: Monster, deltaTime: number, game: Game): void {
    if (monster.isFlying) {
      this.moveFlyingMonster(monster, deltaTime, game);
      return;
    }

    const path = game.map.paths[monster.pathId];
    if (!path || monster.pathIndex >= path.length - 1) return;

    const current = path[monster.pathIndex];
    const next = path[monster.pathIndex + 1];
    
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const terrain = game.map.terrain[Math.floor(monster.y)]?.[Math.floor(monster.x)];
    let speed = monster.speed;
    if (terrain === 'water') {
      speed *= (1 - WATER_SLOW_AMOUNT);
    }

    const moveDistance = speed * deltaTime;
    monster.progress += moveDistance;

    if (monster.progress >= distance) {
      monster.progress -= distance;
      monster.pathIndex++;
      if (monster.pathIndex < path.length) {
        monster.x = path[monster.pathIndex].x;
        monster.y = path[monster.pathIndex].y;
      }
    } else {
      const ratio = monster.progress / distance;
      monster.x = current.x + dx * ratio;
      monster.y = current.y + dy * ratio;
    }
  }

  private moveFlyingMonster(monster: Monster, deltaTime: number, game: Game): void {
    const base = game.map.basePosition;
    const dx = base.x - monster.x;
    const dy = base.y - monster.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const moveDistance = monster.speed * deltaTime;
    
    if (distance <= moveDistance) {
      monster.x = base.x;
      monster.y = base.y;
    } else {
      monster.x += (dx / distance) * moveDistance;
      monster.y += (dy / distance) * moveDistance;
    }
  }

  private hasReachedBase(monster: Monster, game: Game): boolean {
    const base = game.map.basePosition;
    const dx = base.x - monster.x;
    const dy = base.y - monster.y;
    return Math.sqrt(dx * dx + dy * dy) < 0.5;
  }

  private monsterReachBase(game: Game, monster: Monster, index: number): void {
    const lifeCost = monster.type === 'boss' ? BOSS_LIFE_COST : NORMAL_LIFE_COST;
    game.lives -= lifeCost;
    game.monsters.splice(index, 1);
  }

  private killMonster(game: Game, monster: Monster, index: number): void {
    game.gold += monster.gold;
    
    if (monster.eliteAbility === 'split' && monster.hp <= 0 && monster.maxHp / monster.maxHp === 1) {
      this.splitMonster(game, monster);
    }

    game.monsters.splice(index, 1);
  }

  private splitMonster(game: Game, monster: Monster): void {
    for (let i = 0; i < 2; i++) {
      const splitMonster: Monster = {
        ...monster,
        id: uuidv4(),
        hp: monster.maxHp * 0.5,
        maxHp: monster.maxHp * 0.5,
        type: 'normal',
        eliteAbility: undefined,
        gold: Math.floor(monster.gold / 3),
        x: monster.x + (Math.random() - 0.5) * 2,
        y: monster.y + (Math.random() - 0.5) * 2,
        hasShield: false,
        isStealthed: false
      };
      game.monsters.push(splitMonster);
    }
  }

  private updateTowers(game: Game, deltaTime: number): void {
    for (const tower of game.towers) {
      if (tower.isTrap) {
        this.updateTrapTower(tower, deltaTime, game);
      } else if (TOWER_CONFIG[tower.type].isAmplifier) {
        continue;
      } else {
        this.updateAttackTower(tower, deltaTime, game);
      }
    }
  }

  private updateTrapTower(tower: Tower, deltaTime: number, game: Game): void {
    if (tower.trapCooldown && tower.trapCooldown > 0) {
      tower.trapCooldown -= deltaTime;
      return;
    }

    for (const monster of game.monsters) {
      if (monster.isFlying) continue;
      
      const dx = monster.x - tower.x;
      const dy = monster.y - tower.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= 1) {
        this.applyDamage(monster, tower.damage, 'physical');
        tower.trapCooldown = 20;
        break;
      }
    }
  }

  private updateAttackTower(tower: Tower, deltaTime: number, game: Game): void {
    tower.lastAttackTime += deltaTime;
    
    const cooldown = 1 / tower.attackSpeed;
    if (tower.lastAttackTime < cooldown) return;

    const targets = this.findTargets(tower, game);
    if (targets.length === 0) return;

    tower.lastAttackTime = 0;
    
    const config = TOWER_CONFIG[tower.type];
    const mainTarget = targets[0];
    
    const terrain = game.map.terrain[tower.y]?.[tower.x];
    let damage = tower.damage;
    if (terrain === 'highland') {
      damage *= (1 + HIGHLAND_DAMAGE_BONUS);
    }

    const buffMultiplier = 1 + (game.towerDamageBuffs.get(tower.id) || 0);
    damage *= buffMultiplier;

    if (config.isAOE) {
      for (const target of targets) {
        const dx = target.x - mainTarget.x;
        const dy = target.y - mainTarget.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= (config.aoeRadius || 1)) {
          if (config.isSlow) {
            this.applySlow(target, config.slowAmount || 0.3, config.slowDuration || 2);
          } else {
            this.applyDamage(target, damage, tower.type === 'magic' ? 'magic' : 'physical');
          }
        }
      }
    } else if (config.isDOT) {
      this.applyPoison(mainTarget, tower);
    } else if (tower.type === 'arc') {
      this.applyChainLightning(tower, mainTarget, targets, damage, game);
    } else {
      const damageType = tower.type === 'magic' ? 'magic' : 'physical';
      this.applyDamage(mainTarget, damage, damageType);
    }
  }

  private findTargets(tower: Tower, game: Game): Monster[] {
    const config = TOWER_CONFIG[tower.type];
    const targets: Monster[] = [];

    for (const monster of game.monsters) {
      if (monster.isStealthed && !this.canDetectStealth(tower, monster, game)) continue;
      
      if (monster.isFlying && !config.isAntiAir) continue;

      const dx = monster.x - tower.x;
      const dy = monster.y - tower.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= tower.range) {
        targets.push(monster);
      }
    }

    return this.sortTargetsByStrategy(targets, tower.targetStrategy, game);
  }

  private canDetectStealth(tower: Tower, monster: Monster, game: Game): boolean {
    for (const t of game.towers) {
      if (t.type === 'poison' || t.isTrap) {
        const dx = monster.x - t.x;
        const dy = monster.y - t.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= (TOWER_CONFIG[t.type].range || 3)) {
          return true;
        }
      }
    }
    return false;
  }

  private sortTargetsByStrategy(targets: Monster[], strategy: TargetStrategy, game: Game): Monster[] {
    return targets.sort((a, b) => {
      switch (strategy) {
        case 'nearest':
          return a.pathIndex - b.pathIndex || a.progress - b.progress;
        case 'lowestHp':
          return a.hp - b.hp;
        case 'nearestBase':
          return b.pathIndex - a.pathIndex || b.progress - a.progress;
        case 'bossFirst':
          if (a.type === 'boss' && b.type !== 'boss') return -1;
          if (b.type === 'boss' && a.type !== 'boss') return 1;
          return a.pathIndex - b.pathIndex;
        case 'strongest':
          return b.hp - a.hp;
        default:
          return a.pathIndex - b.pathIndex;
      }
    });
  }

  private applyDamage(monster: Monster, damage: number, type: 'physical' | 'magic'): void {
    if (monster.type === 'boss' && monster.immuneType === type) return;

    let actualDamage = damage;
    
    if (type === 'physical') {
      actualDamage *= (1 - monster.armor);
    } else {
      actualDamage *= (1 - monster.magicResist);
    }

    if (monster.hasShield && monster.shieldHp && monster.shieldHp > 0) {
      if (actualDamage <= monster.shieldHp) {
        monster.shieldHp -= actualDamage;
        return;
      } else {
        actualDamage -= monster.shieldHp;
        monster.shieldHp = 0;
        monster.hasShield = false;
      }
    }

    monster.hp -= actualDamage;
    
    if (monster.eliteAbility === 'regen') {
      monster.regenTimer = 0;
    }
  }

  private applySlow(monster: Monster, amount: number, duration: number): void {
    if (!monster.slowAmount || amount > monster.slowAmount) {
      monster.slowAmount = amount;
      monster.speed = monster.baseSpeed * (1 - amount);
    }
    monster.slowTimer = Math.max(monster.slowTimer || 0, duration);
  }

  private applyPoison(monster: Monster, tower: Tower): void {
    const config = TOWER_CONFIG[tower.type];
    const maxStacks = config.maxStacks || 3;
    
    if ((monster.poisonStacks || 0) < maxStacks) {
      monster.poisonStacks = (monster.poisonStacks || 0) + 1;
    }
    monster.poisonTimer = config.dotDuration || 5;
  }

  private applyChainLightning(
    tower: Tower, 
    firstTarget: Monster, 
    allTargets: Monster[],
    baseDamage: number,
    game: Game
  ): void {
    const config = TOWER_CONFIG[tower.type];
    const chainCount = config.chainCount || 3;
    const chainMult = config.chainDamageMultiplier || 0.5;
    
    const hitTargets = new Set<string>();
    let currentTarget = firstTarget;
    let currentDamage = baseDamage;

    for (let i = 0; i < chainCount && currentTarget; i++) {
      this.applyDamage(currentTarget, currentDamage, 'magic');
      hitTargets.add(currentTarget.id);
      currentDamage *= chainMult;

      let nextTarget: Monster | null = null;
      let minDist = Infinity;
      
      for (const m of allTargets) {
        if (hitTargets.has(m.id)) continue;
        const dx = m.x - currentTarget.x;
        const dy = m.y - currentTarget.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3 && dist < minDist) {
          minDist = dist;
          nextTarget = m;
        }
      }
      
      currentTarget = nextTarget;
    }
  }

  private updateTowerBuffs(game: Game): void {
    game.towerDamageBuffs.clear();
    
    for (const tower of game.towers) {
      const config = TOWER_CONFIG[tower.type];
      if (!config.isAmplifier) continue;

      const amplifyRange = config.amplifyRange || 2;
      const amplifyAmount = config.amplifyAmount || 0.15;

      for (const otherTower of game.towers) {
        if (otherTower.id === tower.id) continue;
        if (TOWER_CONFIG[otherTower.type].isAmplifier) continue;

        const dx = otherTower.x - tower.x;
        const dy = otherTower.y - tower.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= amplifyRange) {
          const currentBuff = game.towerDamageBuffs.get(otherTower.id) || 0;
          game.towerDamageBuffs.set(otherTower.id, currentBuff + amplifyAmount);
        }
      }
    }
  }

  private updatePlayerSkills(game: Game, deltaTime: number): void {
    for (const player of game.players) {
      if (player.skillCooldown > 0) {
        player.skillCooldown = Math.max(0, player.skillCooldown - deltaTime);
      }
    }
  }

  private updatePings(game: Game, deltaTime: number): void {
    for (let i = game.pings.length - 1; i >= 0; i--) {
      game.pings[i].timer -= deltaTime;
      if (game.pings[i].timer <= 0) {
        game.pings.splice(i, 1);
      }
    }
  }

  private checkGameEnd(game: Game): void {
    if (game.lives <= 0) {
      game.state = 'ended';
    } else if (!game.isEndless && game.currentWave >= game.totalWaves && !game.isWaveActive && game.monsters.length === 0) {
      game.state = 'ended';
    }
  }

  buildTower(game: Game, playerId: string, type: TowerType, x: number, y: number): Tower | null {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return null;

    const config = TOWER_CONFIG[type];
    if (game.gold < config.baseCost) return null;

    if (!this.canBuildAt(game, player, type, x, y)) return null;

    const tower: Tower = {
      id: uuidv4(),
      type,
      level: 1,
      x,
      y,
      playerId,
      targetStrategy: 'nearest',
      lastAttackTime: 0,
      cooldown: 0,
      totalCost: config.baseCost,
      isTrap: config.isTrap,
      trapCooldown: 0,
      damage: config.damage,
      range: config.range,
      attackSpeed: config.attackSpeed
    };

    game.gold -= config.baseCost;
    game.towers.push(tower);
    
    return tower;
  }

  private canBuildAt(game: Game, player: Player, type: TowerType, x: number, y: number): boolean {
    if (x < 0 || x >= game.map.width || y < 0 || y >= game.map.height) return false;

    const bounds = player.areaBounds;
    if (x < bounds.x || x >= bounds.x + bounds.width || 
        y < bounds.y || y >= bounds.y + bounds.height) {
      return false;
    }

    const terrain = game.map.terrain[y][x];
    const config = TOWER_CONFIG[type];

    if (config.isTrap) {
      let onPath = false;
      for (const path of game.map.paths) {
        for (const point of path) {
          if (Math.abs(point.x - x) < 0.5 && Math.abs(point.y - y) < 0.5) {
            onPath = true;
            break;
          }
        }
        if (onPath) break;
      }
      if (!onPath) return false;
    } else {
      if (terrain === 'water') return false;
      
      let onPath = false;
      for (const path of game.map.paths) {
        for (const point of path) {
          if (Math.abs(point.x - x) < 0.5 && Math.abs(point.y - y) < 0.5) {
            onPath = true;
            break;
          }
        }
        if (onPath) break;
      }
      if (onPath) return false;
    }

    for (const tower of game.towers) {
      if (Math.abs(tower.x - x) < 0.5 && Math.abs(tower.y - y) < 0.5) {
        return false;
      }
    }

    return true;
  }

  upgradeTower(game: Game, towerId: string): Tower | null {
    const tower = game.towers.find(t => t.id === towerId);
    if (!tower || tower.level >= 3) return null;

    const config = TOWER_CONFIG[tower.type];
    const upgradeCost = tower.level === 1 
      ? Math.floor(config.baseCost * 0.6) 
      : config.baseCost;

    if (game.gold < upgradeCost) return null;

    game.gold -= upgradeCost;
    tower.totalCost += upgradeCost;
    tower.level++;

    const upgradeMultiplier = 1 + (tower.level - 1) * 0.4;
    tower.damage = config.damage * upgradeMultiplier;
    tower.range = config.range * (1 + (tower.level - 1) * 0.1);
    tower.attackSpeed = config.attackSpeed * (1 + (tower.level - 1) * 0.15);

    return tower;
  }

  evolveTower(game: Game, towerId: string, branch: 'a' | 'b'): Tower | null {
    const tower = game.towers.find(t => t.id === towerId);
    if (!tower || tower.level < 3 || tower.branch) return null;

    const config = TOWER_CONFIG[tower.type];
    const branchConfig = config.branches[branch];
    const evolveCost = Math.floor(config.baseCost * 1.5);

    if (game.gold < evolveCost) return null;

    game.gold -= evolveCost;
    tower.totalCost += evolveCost;
    tower.branch = branch;

    const modifiers = branchConfig.modifiers;
    if (modifiers.damage) tower.damage *= (1 + modifiers.damage);
    if (modifiers.range) tower.range *= (1 + modifiers.range);
    if (modifiers.attackSpeed) tower.attackSpeed *= (1 + modifiers.attackSpeed);

    return tower;
  }

  sellTower(game: Game, towerId: string): boolean {
    const index = game.towers.findIndex(t => t.id === towerId);
    if (index === -1) return false;

    const tower = game.towers[index];
    const refund = Math.floor(tower.totalCost * 0.8);
    game.gold += refund;
    game.towers.splice(index, 1);

    return true;
  }

  setTowerStrategy(game: Game, towerId: string, strategy: TargetStrategy): boolean {
    const tower = game.towers.find(t => t.id === towerId);
    if (!tower) return false;
    tower.targetStrategy = strategy;
    return true;
  }

  useSkill(game: Game, playerId: string, skillType: SkillType, targetX?: number, targetY?: number): boolean {
    const player = game.players.find(p => p.id === playerId);
    if (!player || player.skill !== skillType || player.skillCooldown > 0) return false;

    player.skillCooldown = SKILL_COOLDOWN;

    switch (skillType) {
      case 'freeze':
        for (const monster of game.monsters) {
          this.applySlow(monster, 1, 5);
        }
        break;
      case 'meteor':
        if (targetX === undefined || targetY === undefined) return false;
        for (const monster of game.monsters) {
          const dx = monster.x - targetX;
          const dy = monster.y - targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= 3) {
            this.applyDamage(monster, 300, 'magic');
          }
        }
        break;
      case 'repair':
        break;
      case 'gold':
        game.gold += 100;
        break;
    }

    return true;
  }

  setPlayerSkill(game: Game, playerId: string, skillType: SkillType): boolean {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;

    const skillTaken = game.players.some(p => p.id !== playerId && p.skill === skillType);
    if (skillTaken) return false;

    player.skill = skillType;
    return true;
  }

  addPing(game: Game, playerId: string, x: number, y: number): void {
    game.pings.push({
      id: uuidv4(),
      x,
      y,
      playerId,
      timer: 5
    });
  }

  voteSkipWave(game: Game, playerId: string): boolean {
    if (game.isWaveActive) return false;
    if (game.skipWaveVote.includes(playerId)) return false;
    game.skipWaveVote.push(playerId);
    return true;
  }

  voteGameSpeed(game: Game, playerId: string, speed: number): boolean {
    const existingVote = game.speedVote.find(v => v.playerId === playerId);
    if (existingVote) {
      existingVote.speed = speed;
    } else {
      game.speedVote.push({ playerId, speed });
    }

    const connectedPlayers = game.players.filter(p => p.isConnected).length;
    if (game.speedVote.length >= connectedPlayers) {
      const speeds = game.speedVote.map(v => v.speed);
      const allSame = speeds.every(s => s === speeds[0]);
      if (allSame) {
        game.gameSpeed = speeds[0];
        return true;
      }
    }
    return false;
  }

  getGame(gameId: string): Game | null {
    return this.games.get(gameId) || null;
  }

  removeGame(gameId: string): void {
    this.stopGameLoop(gameId);
    this.games.delete(gameId);
  }

  handleDisconnect(game: Game, playerId: string): void {
    const player = game.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = false;
      player.disconnectTimer = 30;
    }
  }

  handleReconnect(game: Game, playerId: string): void {
    const player = game.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = true;
      player.disconnectTimer = undefined;
    }
  }
}
