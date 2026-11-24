import { EventBus } from '../../app/events';
import { getXpRequiredForLevel } from '../config/balance';
import {
  CONSUMABLES,
  QUESTS,
  SKINS,
  UPGRADES,
  WEAPONS,
  getUpgradePrice,
} from '../config/items';
import { SKILLS } from '../config/skills';
import { SaveManager } from '../persistence/SaveManager';

export interface PurchaseResult {
  ok: boolean;
  reason?: string;
}

export class ProgressionSystem {
  constructor(
    private saveManager: SaveManager,
    private events: EventBus
  ) {}

  getCurrency(): number {
    return this.saveManager.getData().currency;
  }

  grantCurrency(amount: number, countInTotalStats = true): void {
    const clean = Math.max(0, Math.floor(amount));
    if (clean <= 0) return;
    this.saveManager.update((draft) => {
      draft.currency = Math.min(9_999_999, draft.currency + clean);
      if (countInTotalStats) {
        draft.stats.totalCurrencyEarned = Math.min(
          99_999_999,
          draft.stats.totalCurrencyEarned + clean
        );
      }
    });
  }

  grantAccountXp(xpAmount: number): { leveledUp: boolean; newLevel: number } {
    const clean = Math.max(0, Math.floor(xpAmount));
    let leveledUp = false;
    let newLevel = this.saveManager.getData().stats.accountLevel;

    if (clean > 0) {
      this.saveManager.update((draft) => {
        draft.stats.accountXp += clean;
        let req = getXpRequiredForLevel(draft.stats.accountLevel);
        while (draft.stats.accountXp >= req && draft.stats.accountLevel < 999) {
          draft.stats.accountXp -= req;
          draft.stats.accountLevel += 1;
          leveledUp = true;
          req = getXpRequiredForLevel(draft.stats.accountLevel);
        }
        newLevel = draft.stats.accountLevel;
      });
    }

    return { leveledUp, newLevel };
  }

  buyUpgrade(upgradeId: string): PurchaseResult {
    const def = UPGRADES[upgradeId];
    if (!def) return { ok: false, reason: 'Unknown upgrade.' };

    const save = this.saveManager.getData();
    const currentLv = save.upgrades[upgradeId] ?? 0;
    if (currentLv >= def.maxLevel) {
      return { ok: false, reason: 'Maximum rank reached.' };
    }

    const price = getUpgradePrice(def, currentLv);
    if (save.currency < price) {
      return { ok: false, reason: `Need ${price - save.currency} more Sky Coins.` };
    }

    this.saveManager.update((draft) => {
      draft.currency -= price;
      draft.upgrades[upgradeId] = currentLv + 1;
    });

    this.events.emit('toast', {
      text: `Upgraded ${def.name} to Rank ${currentLv + 1}!`,
      tone: 'success',
    });
    return { ok: true };
  }

  buySkill(skillId: string): PurchaseResult {
    const def = SKILLS[skillId];
    if (!def) return { ok: false, reason: 'Unknown skill.' };

    const save = this.saveManager.getData();
    if (save.ownedSkills.includes(skillId)) {
      return { ok: false, reason: 'Already owned.' };
    }
    if (save.currency < def.price) {
      return { ok: false, reason: `Need ${def.price - save.currency} more Sky Coins.` };
    }

    this.saveManager.update((draft) => {
      draft.currency -= def.price;
      draft.ownedSkills.push(skillId);
      // Auto-equip into open active slot if available
      if (def.kind === 'active' && draft.equippedSkills.length < 2) {
        draft.equippedSkills.push(skillId);
      }
    });

    this.events.emit('toast', {
      text:
        def.kind === 'mobility'
          ? `Unlocked ${def.name} — active on every run!`
          : `Unlocked ${def.name}! Equip it in Loadout or Shop.`,
      tone: 'success',
    });
    return { ok: true };
  }

  equipActiveSkill(skillId: string, slotIndex?: 0 | 1): PurchaseResult {
    const def = SKILLS[skillId];
    if (!def || def.kind !== 'active') {
      return { ok: false, reason: 'Passive mobility tools are always active once owned.' };
    }

    const save = this.saveManager.getData();
    if (!save.ownedSkills.includes(skillId)) {
      return { ok: false, reason: 'Purchase this skill first.' };
    }

    this.saveManager.update((draft) => {
      const existingIdx = draft.equippedSkills.indexOf(skillId);
      if (slotIndex !== undefined) {
        if (existingIdx !== -1 && existingIdx !== slotIndex) {
          // Swap slots cleanly
          const other = draft.equippedSkills[slotIndex];
          draft.equippedSkills[slotIndex] = skillId;
          draft.equippedSkills[existingIdx] = other;
        } else {
          draft.equippedSkills[slotIndex] = skillId;
        }
      } else if (existingIdx === -1) {
        // Put in Slot 2 (E) by default when equipping from Shop so Dash stays on Q unless swapped
        if (draft.equippedSkills.length < 2) {
          draft.equippedSkills.push(skillId);
        } else {
          draft.equippedSkills[1] = skillId;
        }
      }
    });

    this.events.emit('toast', {
      text: `Equipped ${def.name}!`,
      tone: 'info',
    });
    return { ok: true };
  }

  buySkin(skinId: string): PurchaseResult {
    const def = SKINS[skinId];
    if (!def) return { ok: false, reason: 'Unknown skin.' };

    const save = this.saveManager.getData();
    if (save.ownedSkins.includes(skinId)) {
      return { ok: false, reason: 'Already owned.' };
    }
    if (save.currency < def.price) {
      return { ok: false, reason: `Need ${def.price - save.currency} more Sky Coins.` };
    }

    this.saveManager.update((draft) => {
      draft.currency -= def.price;
      draft.ownedSkins.push(skinId);
      draft.equippedSkin = skinId;
    });

    this.events.emit('toast', {
      text: `Unlocked & equipped ${def.name}!`,
      tone: 'success',
    });
    return { ok: true };
  }

  equipSkin(skinId: string): PurchaseResult {
    const def = SKINS[skinId];
    if (!def) return { ok: false, reason: 'Unknown skin.' };

    const save = this.saveManager.getData();
    if (!save.ownedSkins.includes(skinId)) {
      return { ok: false, reason: 'Unlock this skin in the Shop first.' };
    }

    this.saveManager.update((draft) => {
      draft.equippedSkin = skinId;
    });

    this.events.emit('toast', {
      text: `Equipped ${def.name}!`,
      tone: 'info',
    });
    return { ok: true };
  }

  buyWeapon(weaponId: string): PurchaseResult {
    const def = WEAPONS[weaponId];
    if (!def) return { ok: false, reason: 'Unknown weapon.' };

    const save = this.saveManager.getData();
    if (save.ownedWeapons.includes(weaponId)) {
      return { ok: false, reason: 'Already owned.' };
    }
    if (save.currency < def.price) {
      return { ok: false, reason: `Need ${def.price - save.currency} more Sky Coins.` };
    }

    this.saveManager.update((draft) => {
      draft.currency -= def.price;
      draft.ownedWeapons.push(weaponId);
      draft.equippedWeapon = weaponId;
    });

    this.events.emit('toast', {
      text: `Forged & equipped ${def.name}!`,
      tone: 'success',
    });
    return { ok: true };
  }

  equipWeapon(weaponId: string): PurchaseResult {
    const def = WEAPONS[weaponId];
    if (!def) return { ok: false, reason: 'Unknown weapon.' };

    const save = this.saveManager.getData();
    if (!save.ownedWeapons.includes(weaponId)) {
      return { ok: false, reason: 'Unlock this weapon in the Shop first.' };
    }

    this.saveManager.update((draft) => {
      draft.equippedWeapon = weaponId;
    });

    this.events.emit('toast', {
      text: `Equipped ${def.name}!`,
      tone: 'info',
    });
    return { ok: true };
  }

  buyConsumable(consumableId: string): PurchaseResult {
    const def = CONSUMABLES[consumableId];
    if (!def) return { ok: false, reason: 'Unknown consumable.' };

    const save = this.saveManager.getData();
    const count = save.consumables[consumableId] ?? 0;
    if (count >= def.maxCarry) {
      return { ok: false, reason: `Pouch full (${def.maxCarry}/${def.maxCarry}).` };
    }
    if (save.currency < def.price) {
      return { ok: false, reason: `Need ${def.price - save.currency} more Sky Coins.` };
    }

    this.saveManager.update((draft) => {
      draft.currency -= def.price;
      draft.consumables[consumableId] = count + 1;
    });

    this.events.emit('toast', {
      text: `Purchased ${def.name} (${count + 1}/${def.maxCarry} ready)!`,
      tone: 'success',
    });
    return { ok: true };
  }

  claimQuest(questId: string): PurchaseResult {
    const quest = QUESTS.find((q) => q.id === questId);
    if (!quest) return { ok: false, reason: 'Unknown quest.' };

    const save = this.saveManager.getData();
    if (save.claimedQuests.includes(questId)) {
      return { ok: false, reason: 'Already claimed.' };
    }

    const progress = save.stats[quest.statKey] ?? 0;
    if (progress < quest.target) {
      return { ok: false, reason: `Progress ${progress}/${quest.target}.` };
    }

    this.saveManager.update((draft) => {
      draft.claimedQuests.push(questId);
      draft.currency += quest.rewardCoins;
      draft.stats.totalCurrencyEarned += quest.rewardCoins;
    });

    this.events.emit('toast', {
      text: `Quest Complete: +${quest.rewardCoins} Sky Coins!`,
      tone: 'success',
    });
    return { ok: true };
  }
}
