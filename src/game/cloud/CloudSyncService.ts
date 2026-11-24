import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { EventBus } from '../../app/events';
import { SaveData } from '../persistence/SaveData';
import { SaveManager } from '../persistence/SaveManager';
import { migrateAndValidateSave } from '../persistence/migrations';

export interface CloudProfile {
  user_id: string;
  display_name: string;
  equipped_skin: string;
  equipped_weapon: string;
}

export interface GlobalLeaderboardRow {
  user_id: string;
  display_name: string;
  highest_floor: number;
  account_level: number;
  equipped_skin: string;
  equipped_weapon: string;
  updated_at: string;
}

export interface CloudRunHistoryRow {
  id: string;
  seed: string;
  floor_reached: number;
  victory: boolean;
  coins_earned: number;
  enemies_defeated: number;
  duration_seconds: number;
  equipped_weapon: string;
  equipped_skin: string;
  created_at: string;
}

export interface CloudStatusSnapshot {
  configured: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  syncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

// Public browser-safe Supabase project config (security is enforced via Postgres RLS).
const DEFAULT_SUPABASE_URL = 'https://lgzjqwvmglidrafvkaig.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NHwacSa1XkTYRRhI2DNGig_gHpX8DHM';
export const DEV_ADMIN_EMAIL = 'leminh210709@gmail.com';

export class CloudSyncService {
  private client: SupabaseClient | null = null;
  private user: User | null = null;
  private profile: CloudProfile | null = null;
  private syncing = false;
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private syncTimer: number | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private saveManager: SaveManager,
    private events: EventBus
  ) {
    const url = (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
    const key =
      (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
      DEFAULT_SUPABASE_PUBLISHABLE_KEY;

    if (url && key && url.startsWith('http')) {
      this.client = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  isDeveloperAccount(): boolean {
    return (
      Boolean(this.user?.id) &&
      this.user?.email?.trim().toLowerCase() === DEV_ADMIN_EMAIL
    );
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  getStatus(): CloudStatusSnapshot {
    return {
      configured: this.client !== null,
      userId: this.user?.id ?? null,
      email: this.user?.email ?? null,
      displayName: this.profile?.display_name ?? null,
      syncing: this.syncing,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  async initSession(): Promise<void> {
    if (!this.client) return;
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      this.user = data.session?.user ?? null;
      if (this.user) {
        await this.ensureProfileAndPull();
      }
      this.client.auth.onAuthStateChange((_event, session) => {
        this.user = session?.user ?? null;
        if (!this.user) {
          this.profile = null;
          this.lastSyncedAt = null;
        }
        this.notify();
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Failed to initialize session.';
    }
    this.notify();
  }

  async signUp(
    email: string,
    password: string,
    displayName: string
  ): Promise<{ ok: boolean; message: string }> {
    if (!this.client) return { ok: false, message: 'Supabase is not configured.' };
    const cleanName = displayName.trim();
    if (cleanName.length < 2 || cleanName.length > 24) {
      return { ok: false, message: 'Display name must be 2–24 characters.' };
    }

    this.syncing = true;
    this.lastError = null;
    this.notify();

    try {
      const { data, error } = await this.client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: cleanName },
        },
      });
      if (error) throw error;

      this.user = data.user ?? null;
      if (data.session && this.user) {
        await this.upsertProfile(cleanName);
        await this.syncSaveNow();
        this.events.emit('toast', {
          text: `Cloud account created for ${cleanName}!`,
          tone: 'success',
        });
        return { ok: true, message: `Signed up & synced as ${cleanName}.` };
      }

      return {
        ok: true,
        message: 'Account created! Check your email to confirm, then sign in.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-up failed.';
      this.lastError = msg;
      return { ok: false, message: msg };
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  async signIn(email: string, password: string): Promise<{ ok: boolean; message: string }> {
    if (!this.client) return { ok: false, message: 'Supabase is not configured.' };

    this.syncing = true;
    this.lastError = null;
    this.notify();

    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      this.user = data.user ?? null;
      if (this.user) {
        await this.ensureProfileAndPull();
      }
      const name = this.profile?.display_name ?? this.user?.email ?? 'Climber';
      this.events.emit('toast', {
        text: `Signed in as ${name} — Cloud Sync active!`,
        tone: 'success',
      });
      return { ok: true, message: `Signed in as ${name}.` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      this.lastError = msg;
      return { ok: false, message: msg };
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  async signOut(): Promise<void> {
    if (!this.client) return;
    if (this.syncTimer !== null) {
      window.clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    await this.client.auth.signOut();
    this.user = null;
    this.profile = null;
    this.lastSyncedAt = null;
    this.lastError = null;
    this.events.emit('toast', { text: 'Signed out — local save retained.', tone: 'info' });
    this.notify();
  }

  scheduleSaveSync(): void {
    if (!this.client || !this.user) return;
    if (this.syncTimer !== null) {
      window.clearTimeout(this.syncTimer);
    }
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      void this.syncSaveNow();
    }, 1400);
  }

  private async ensureProfileAndPull(): Promise<void> {
    if (!this.client || !this.user) return;
    const { data: prof } = await this.client
      .from('player_profiles')
      .select('user_id, display_name, equipped_skin, equipped_weapon')
      .eq('user_id', this.user.id)
      .maybeSingle();

    if (prof) {
      this.profile = prof as CloudProfile;
    } else {
      const fallbackName =
        (this.user.user_metadata?.display_name as string | undefined) ||
        this.user.email?.split('@')[0]?.slice(0, 20) ||
        'Climber';
      await this.upsertProfile(fallbackName);
    }

    // Check if cloud save exists; if not, push local save
    const { data: cloudSave } = await this.client
      .from('player_saves')
      .select('save_data, highest_floor, currency, updated_at')
      .eq('user_id', this.user.id)
      .maybeSingle();

    if (cloudSave?.save_data) {
      const local = this.saveManager.getData();
      const cloud = migrateAndValidateSave(cloudSave.save_data);
      // Keep whichever save has higher progression (highestFloor / totalCurrencyEarned)
      const cloudScore = cloud.stats.highestFloor * 10000 + cloud.stats.totalCurrencyEarned;
      const localScore = local.stats.highestFloor * 10000 + local.stats.totalCurrencyEarned;
      if (cloudScore > localScore) {
        this.saveManager.replaceAll(cloud);
      } else {
        await this.syncSaveNow();
      }
      this.lastSyncedAt = new Date().toLocaleTimeString();
    } else {
      await this.syncSaveNow();
    }
  }

  private async upsertProfile(displayName: string): Promise<void> {
    if (!this.client || !this.user) return;
    const save = this.saveManager.getData();
    const row = {
      user_id: this.user.id,
      display_name: displayName.slice(0, 24),
      equipped_skin: save.equippedSkin,
      equipped_weapon: save.equippedWeapon,
    };
    const { error } = await this.client.from('player_profiles').upsert(row, {
      onConflict: 'user_id',
    });
    if (error) throw error;
    this.profile = row;
  }

  async syncSaveNow(): Promise<{ ok: boolean; message: string }> {
    if (!this.client || !this.user) {
      return { ok: false, message: 'Sign in to sync saves to Supabase.' };
    }

    this.syncing = true;
    this.lastError = null;
    this.notify();

    try {
      const save: SaveData = this.saveManager.getData();
      const displayName =
        this.profile?.display_name ||
        (this.user.user_metadata?.display_name as string | undefined) ||
        this.user.email?.split('@')[0]?.slice(0, 20) ||
        'Climber';

      const [saveRes, profRes, lbRes] = await Promise.all([
        this.client.from('player_saves').upsert(
          {
            user_id: this.user.id,
            save_version: save.version,
            save_data: save,
            currency: save.currency,
            highest_floor: save.stats.highestFloor,
            account_level: save.stats.accountLevel,
          },
          { onConflict: 'user_id' }
        ),
        this.client.from('player_profiles').upsert(
          {
            user_id: this.user.id,
            display_name: displayName,
            equipped_skin: save.equippedSkin,
            equipped_weapon: save.equippedWeapon,
          },
          { onConflict: 'user_id' }
        ),
        this.client.from('leaderboard_entries').upsert(
          {
            user_id: this.user.id,
            display_name: displayName,
            highest_floor: save.stats.highestFloor,
            account_level: save.stats.accountLevel,
            equipped_skin: save.equippedSkin,
            equipped_weapon: save.equippedWeapon,
          },
          { onConflict: 'user_id' }
        ),
      ]);

      if (saveRes.error) throw saveRes.error;
      if (profRes.error) throw profRes.error;
      if (lbRes.error) throw lbRes.error;

      this.profile = {
        user_id: this.user.id,
        display_name: displayName,
        equipped_skin: save.equippedSkin,
        equipped_weapon: save.equippedWeapon,
      };
      this.lastSyncedAt = new Date().toLocaleTimeString();
      return { ok: true, message: 'Cloud save synced!' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cloud sync failed.';
      this.lastError = msg;
      return { ok: false, message: msg };
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  async pullSaveFromCloud(): Promise<{ ok: boolean; message: string }> {
    if (!this.client || !this.user) {
      return { ok: false, message: 'Sign in first.' };
    }

    this.syncing = true;
    this.lastError = null;
    this.notify();

    try {
      const { data, error } = await this.client
        .from('player_saves')
        .select('save_data')
        .eq('user_id', this.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data?.save_data) {
        return { ok: false, message: 'No cloud save found yet.' };
      }

      const validated = migrateAndValidateSave(data.save_data);
      this.saveManager.replaceAll(validated);
      this.lastSyncedAt = new Date().toLocaleTimeString();
      this.events.emit('toast', { text: 'Loaded save from Supabase Cloud!', tone: 'success' });
      return { ok: true, message: 'Loaded cloud save.' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load cloud save.';
      this.lastError = msg;
      return { ok: false, message: msg };
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  async recordRunHistory(entry: {
    seed: string;
    floorReached: number;
    victory: boolean;
    coinsEarned: number;
    enemiesDefeated: number;
    durationSeconds: number;
  }): Promise<void> {
    if (!this.client || !this.user) return;
    const save = this.saveManager.getData();
    try {
      await this.client.from('run_history').insert({
        user_id: this.user.id,
        seed: entry.seed,
        floor_reached: entry.floorReached,
        victory: entry.victory,
        coins_earned: entry.coinsEarned,
        enemies_defeated: entry.enemiesDefeated,
        duration_seconds: Math.max(0, Math.round(entry.durationSeconds)),
        equipped_weapon: save.equippedWeapon,
        equipped_skin: save.equippedSkin,
      });
      await this.syncSaveNow();
    } catch {
      // Non-fatal if offline
    }
  }

  async fetchGlobalLeaderboard(limit = 20): Promise<GlobalLeaderboardRow[]> {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('leaderboard_entries')
      .select('user_id, display_name, highest_floor, account_level, equipped_skin, equipped_weapon, updated_at')
      .order('highest_floor', { ascending: false })
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (error || !data) return [];
    return data as GlobalLeaderboardRow[];
  }

  async fetchRunHistory(limit = 8): Promise<CloudRunHistoryRow[]> {
    if (!this.client || !this.user) return [];
    const { data, error } = await this.client
      .from('run_history')
      .select(
        'id, seed, floor_reached, victory, coins_earned, enemies_defeated, duration_seconds, equipped_weapon, equipped_skin, created_at'
      )
      .eq('user_id', this.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as CloudRunHistoryRow[];
  }
}
