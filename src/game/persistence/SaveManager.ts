import { EventBus } from '../../app/events';
import {
  LEGACY_SAVE_STORAGE_KEYS,
  SAVE_STORAGE_KEY,
  SaveData,
  createDefaultSaveData,
} from './SaveData';
import { migrateAndValidateSave } from './migrations';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SaveManager {
  private data: SaveData;
  private storage: StorageLike | null = null;
  private storageAvailable = true;
  private warningEmitted = false;

  constructor(
    private events?: EventBus,
    customStorage?: StorageLike | null
  ) {
    if (customStorage !== undefined) {
      this.storage = customStorage;
      this.storageAvailable = customStorage !== null;
    } else {
      this.storage = this.resolveBrowserStorage();
    }
    this.data = this.load();
  }

  private resolveBrowserStorage(): StorageLike | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this.storageAvailable = false;
        return null;
      }
      const probeKey = '__cloudspire_storage_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      this.storageAvailable = true;
      return window.localStorage;
    } catch {
      this.storageAvailable = false;
      this.notifyStorageWarning(
        'Browser localStorage is unavailable. Progress will be kept in memory for this session only.'
      );
      return null;
    }
  }

  private notifyStorageWarning(message: string): void {
    if (this.warningEmitted) return;
    this.warningEmitted = true;
    this.events?.emit('storage_warning', { message });
  }

  isStorageHealthy(): boolean {
    return this.storageAvailable;
  }

  getData(): SaveData {
    return this.data;
  }

  load(): SaveData {
    if (!this.storage) {
      this.notifyStorageWarning(
        'Local storage is disabled; continuing in session memory.'
      );
      this.data = createDefaultSaveData();
      return this.data;
    }

    try {
      let rawText = this.storage.getItem(SAVE_STORAGE_KEY);
      let migratedFromLegacy = false;

      if (!rawText) {
        for (const legacyKey of LEGACY_SAVE_STORAGE_KEYS) {
          const candidate = this.storage.getItem(legacyKey);
          if (candidate) {
            rawText = candidate;
            migratedFromLegacy = true;
            break;
          }
        }
      }

      if (!rawText) {
        this.data = createDefaultSaveData();
        this.persist();
        return this.data;
      }

      const parsed = JSON.parse(rawText);
      this.data = migrateAndValidateSave(parsed);

      if (migratedFromLegacy || parsed?.version !== this.data.version) {
        this.persist();
      }

      return this.data;
    } catch {
      // Malformed JSON or read error: recover cleanly without crashing
      this.data = createDefaultSaveData();
      this.events?.emit('toast', {
        text: 'Corrupted save data detected — restored safe defaults.',
        tone: 'warning',
      });
      this.persist();
      return this.data;
    }
  }

  persist(): boolean {
    this.data = migrateAndValidateSave(this.data);
    this.events?.emit('save_updated', undefined);

    if (!this.storage) {
      this.storageAvailable = false;
      this.notifyStorageWarning(
        'Local storage is unavailable. Progress is stored in memory for this tab.'
      );
      return false;
    }

    try {
      this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(this.data));
      this.storageAvailable = true;
      return true;
    } catch {
      this.storageAvailable = false;
      this.notifyStorageWarning(
        'Saving to localStorage failed (storage full or blocked). Continuing in memory.'
      );
      return false;
    }
  }

  update(mutator: (draft: SaveData) => void): SaveData {
    mutator(this.data);
    this.persist();
    return this.data;
  }

  replaceAll(next: SaveData): SaveData {
    this.data = migrateAndValidateSave(next);
    this.persist();
    return this.data;
  }

  reset(): SaveData {
    this.data = createDefaultSaveData();
    if (this.storage) {
      try {
        this.storage.removeItem(SAVE_STORAGE_KEY);
        for (const legacyKey of LEGACY_SAVE_STORAGE_KEYS) {
          this.storage.removeItem(legacyKey);
        }
      } catch {
        // Ignore removal failure and overwrite below
      }
    }
    this.persist();
    return this.data;
  }
}
