import { TowerType, MonsterType } from '../types/game.types';

export const CELL_SIZE = 32;
export const MAP_WIDTH = 40;
export const MAP_HEIGHT = 30;
export const INITIAL_LIVES = 20;
export const BOSS_LIFE_COST = 3;
export const NORMAL_LIFE_COST = 1;

export const TOWER_CONFIG: Record<TowerType, {
  name: string;
  description: string;
  baseCost: number;
  damage: number;
  range: number;
  attackSpeed: number;
  isAOE?: boolean;
  aoeRadius?: number;
  isAntiAir?: boolean;
  isSlow?: boolean;
  slowAmount?: number;
  slowDuration?: number;
  isDOT?: boolean;
  dotDamage?: number;
  dotDuration?: number;
  maxStacks?: number;
  isTrap?: boolean;
  isAmplifier?: boolean;
  amplifyRange?: number;
  amplifyAmount?: number;
  chainCount?: number;
  chainDamageMultiplier?: number;
  ignoresArmor?: boolean;
  branches: {
    a: { name: string; description: string; modifiers: Record<string, number> };
    b: { name: string; description: string; modifiers: Record<string, number> };
  };
}> = {
  arrow: {
    name: '箭塔',
    description: '单体物理伤害，攻速快',
    baseCost: 50,
    damage: 15,
    range: 4,
    attackSpeed: 1.2,
    isAntiAir: true,
    branches: {
      a: {
        name: '连射弓手',
        description: '攻速大幅提升',
        modifiers: { attackSpeed: 0.5, damage: -0.1, range: 0.1 }
      },
      b: {
        name: '穿甲狙击',
        description: '高伤害，无视部分护甲',
        modifiers: { damage: 0.8, attackSpeed: -0.3, range: 0.3 }
      }
    }
  },
  magic: {
    name: '魔法塔',
    description: '单体魔法伤害，无视护甲',
    baseCost: 75,
    damage: 25,
    range: 3.5,
    attackSpeed: 0.8,
    ignoresArmor: true,
    branches: {
      a: {
        name: '奥术法师',
        description: '高伤害高攻速',
        modifiers: { damage: 0.4, attackSpeed: 0.3 }
      },
      b: {
        name: '元素术士',
        description: '范围魔法伤害',
        modifiers: { damage: 0.2, aoeRadius: 1.5 }
      }
    }
  },
  frost: {
    name: '冰霜塔',
    description: '范围减速，不造成伤害',
    baseCost: 60,
    damage: 0,
    range: 3,
    attackSpeed: 0.5,
    isAOE: true,
    aoeRadius: 2,
    isSlow: true,
    slowAmount: 0.4,
    slowDuration: 2,
    branches: {
      a: {
        name: '极寒领域',
        description: '减速效果更强，范围更大',
        modifiers: { slowAmount: 0.3, range: 0.3, aoeRadius: 0.5 }
      },
      b: {
        name: '冰霜新星',
        description: '减速同时造成少量伤害',
        modifiers: { damage: 0.5, slowAmount: 0.1, attackSpeed: 0.2 }
      }
    }
  },
  cannon: {
    name: '火炮塔',
    description: '范围AOE物理伤害，攻速慢',
    baseCost: 100,
    damage: 50,
    range: 4.5,
    attackSpeed: 0.4,
    isAOE: true,
    aoeRadius: 1.5,
    branches: {
      a: {
        name: '重型炮台',
        description: '超高伤害，攻速更慢',
        modifiers: { damage: 1.0, attackSpeed: -0.3, aoeRadius: 0.3 }
      },
      b: {
        name: '速射炮',
        description: '攻速提升，伤害略降',
        modifiers: { attackSpeed: 0.8, damage: -0.2, range: 0.2 }
      }
    }
  },
  poison: {
    name: '毒液塔',
    description: 'DOT持续伤害，可叠加',
    baseCost: 70,
    damage: 5,
    range: 3.5,
    attackSpeed: 0.7,
    isDOT: true,
    dotDamage: 8,
    dotDuration: 5,
    maxStacks: 3,
    branches: {
      a: {
        name: '剧毒术士',
        description: '更高的毒素伤害',
        modifiers: { dotDamage: 0.8, maxStacks: 2 }
      },
      b: {
        name: '瘟疫使者',
        description: '范围毒素，可传染',
        modifiers: { aoeRadius: 1.5, dotDamage: 0.2 }
      }
    }
  },
  amplifier: {
    name: '强化塔',
    description: '增强周围塔的攻击力',
    baseCost: 80,
    damage: 0,
    range: 0,
    attackSpeed: 0,
    isAmplifier: true,
    amplifyRange: 2,
    amplifyAmount: 0.15,
    branches: {
      a: {
        name: '战争号角',
        description: '增强范围和效果提升',
        modifiers: { amplifyRange: 0.5, amplifyAmount: 0.1 }
      },
      b: {
        name: '能量图腾',
        description: '同时增加攻速',
        modifiers: { amplifyAmount: 0.05, attackSpeedBuff: 0.1 }
      }
    }
  },
  trap: {
    name: '陷阱',
    description: '路径上的一次性高伤害',
    baseCost: 40,
    damage: 200,
    range: 1,
    attackSpeed: 0,
    isTrap: true,
    branches: {
      a: {
        name: '爆裂陷阱',
        description: '更高伤害，范围更大',
        modifiers: { damage: 0.5, aoeRadius: 1 }
      },
      b: {
        name: '连环陷阱',
        description: '触发后冷却时间缩短',
        modifiers: { damage: -0.2, cooldownReduction: 0.5 }
      }
    }
  },
  arc: {
    name: '电弧塔',
    description: '链式闪电，跳跃攻击',
    baseCost: 90,
    damage: 20,
    range: 3.5,
    attackSpeed: 0.6,
    chainCount: 3,
    chainDamageMultiplier: 0.5,
    isAntiAir: true,
    branches: {
      a: {
        name: '雷神之锤',
        description: '更多跳跃目标',
        modifiers: { chainCount: 3, damage: 0.2 }
      },
      b: {
        name: '静电释放',
        description: '高伤害，更少跳跃',
        modifiers: { damage: 0.6, chainCount: -1, chainDamageMultiplier: 0.2 }
      }
    }
  }
};

export const MONSTER_CONFIG: Record<MonsterType, {
  name: string;
  baseHp: number;
  baseArmor: number;
  baseMagicResist: number;
  baseSpeed: number;
  gold: number;
  size: number;
  color: string;
}> = {
  normal: {
    name: '普通怪',
    baseHp: 50,
    baseArmor: 0,
    baseMagicResist: 0,
    baseSpeed: 1.5,
    gold: 5,
    size: 0.6,
    color: '#4ade80'
  },
  elite: {
    name: '精英怪',
    baseHp: 200,
    baseArmor: 0.2,
    baseMagicResist: 0.1,
    baseSpeed: 1.2,
    gold: 20,
    size: 0.8,
    color: '#f97316'
  },
  boss: {
    name: 'BOSS',
    baseHp: 2000,
    baseArmor: 0.3,
    baseMagicResist: 0.25,
    baseSpeed: 0.8,
    gold: 100,
    size: 1.2,
    color: '#ef4444'
  },
  flying: {
    name: '飞行怪',
    baseHp: 40,
    baseArmor: 0,
    baseMagicResist: 0.1,
    baseSpeed: 2.0,
    gold: 8,
    size: 0.5,
    color: '#a855f7'
  }
};

export const PLAYER_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

export const SKILL_COOLDOWN = 60;
export const SKILLS = {
  freeze: { name: '全屏冰冻', description: '冻结所有怪物5秒', cooldown: 60, duration: 5 },
  meteor: { name: '陨石轰炸', description: '对区域内敌人造成大量伤害', cooldown: 60, damage: 300, radius: 3 },
  repair: { name: '修复所有塔', description: '修复所有被损坏的防御塔', cooldown: 60 },
  gold: { name: '金币雨', description: '获得100额外金币', cooldown: 60, amount: 100 }
};

export const INTEREST_RATE = 0.05;
export const INTEREST_MAX = 50;
export const INTEREST_PER_UNIT = 100;

export const WAVE_PREP_TIME = 15;
export const WAVE_SPEED_BONUS_BASE = 20;

export const GAME_TICK_RATE = 30;

export const HIGHLAND_DAMAGE_BONUS = 0.2;
export const WATER_SLOW_AMOUNT = 0.3;
