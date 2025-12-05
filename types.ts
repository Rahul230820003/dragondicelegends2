export enum GamePhase {
  START_MENU = 'START_MENU',
  SELECT_CHARACTER = 'SELECT_CHARACTER',
  PLAYER_INPUT = 'PLAYER_INPUT',
  ROLLING_DICE = 'ROLLING_DICE',
  RESOLVING = 'RESOLVING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export interface Character {
  name: string;
  hp: number;
  maxHp: number;
  image: string;
  level: number;
  classType?: string;
}

export interface WarriorOption {
  id: string;
  name: string;
  classType: string;
  description: string;
}

export interface TurnResult {
  narrative: string;
  damageToEnemy: number;
  damageToPlayer: number;
  isCritical: boolean;
  enemyActionName: string;
}

export enum DiceType {
  D6 = 'D6',
  D20 = 'D20'
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'damage' | 'heal' | 'critical';
}