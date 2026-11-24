import { RunBoonDefinition } from '../game/config/items';

export type GameMode = 'hub' | 'run' | 'victory' | 'defeat';

export type ActiveModal =
  | 'none'
  | 'pause'
  | 'shop'
  | 'inventory'
  | 'settings'
  | 'leaderboard'
  | 'quests'
  | 'levelup'
  | 'checkpoint'
  | 'reset_confirm'
  | 'dialogue';

export interface NpcDialogueState {
  npcId: 'zephyr' | 'lyra' | 'orin';
  npcName: string;
  npcRole: string;
  lines: string[];
  action?: 'shop' | 'inventory' | 'start_run';
}

export interface ActiveRunState {
  seed: string;
  floor: number;
  endlessMode: boolean;
  runCoinsEarned: number;
  runEnemiesDefeated: number;
  runFloorsCleared: number;
  runLevel: number;
  runXp: number;
  runXpToNext: number;
  hp: number;
  maxHp: number;
  shield: number;
  extraLives: number;
  tonicsLeft: number;
  boonCounts: Record<string, number>;
  pendingBoonChoices: RunBoonDefinition[];
  elapsedSeconds: number;
  objectiveText: string;
  objectiveProgress: string;
  portalUnlocked: boolean;
}

export interface HudAbilitySlot {
  slotLabel: string;
  keyHint: string;
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  cooldownRemaining: number;
  cooldownTotal: number;
  ready: boolean;
}

export interface BossHudInfo {
  name: string;
  hp: number;
  maxHp: number;
}

export interface HudSnapshot {
  mode: GameMode;
  modal: ActiveModal;
  modalStackDepth: number;
  pointerLocked: boolean;
  gamepadConnected: boolean;
  floor: number;
  floorTitle: string;
  floorSubtitle: string;
  objectiveText: string;
  objectiveProgress: string;
  portalUnlocked: boolean;
  floorProgressRatio: number;
  elapsedSeconds: number;
  runSeed: string;
  boonCounts: Record<string, number>;
  comboStreak: number;
  comboTimerRatio: number;
  hp: number;
  maxHp: number;
  shield: number;
  extraLives: number;
  level: number;
  xp: number;
  xpToNext: number;
  bankedCoins: number;
  runCoins: number;
  tonicsLeft: number;
  hasDoubleJump: boolean;
  abilities: HudAbilitySlot[];
  interactPrompt: string | null;
  boss: BossHudInfo | null;
  dialogue: NpcDialogueState | null;
  fps: number;
  showFps: boolean;
  storageHealthy: boolean;
}
