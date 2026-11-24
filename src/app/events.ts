export type GameEventMap = {
  ui_click: void;
  coin_pickup: { amount: number; worldPos?: { x: number; y: number; z: number } };
  player_attack: { comboIndex: number };
  skill_used: { skillId: string };
  enemy_hit: { damage: number; crit: boolean; worldPos: { x: number; y: number; z: number } };
  enemy_defeated: { enemyType: string; reward: number; xp: number; worldPos: { x: number; y: number; z: number } };
  player_hurt: { damage: number; blocked: boolean };
  player_healed: { amount: number };
  level_up: { level: number };
  floor_cleared: { floor: number; rewardCoins: number };
  run_ended: { victory: boolean; floorReached: number; coinsEarned: number };
  save_updated: void;
  storage_warning: { message: string };
  toast: { text: string; tone?: 'info' | 'success' | 'warning' | 'danger' };
};

type Listener<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<keyof GameEventMap, Set<Listener<any>>>();

  on<K extends keyof GameEventMap>(event: K, fn: Listener<GameEventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => {
      set?.delete(fn);
    };
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      fn(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
