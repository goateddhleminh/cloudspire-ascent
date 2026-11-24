import * as THREE from 'three';
import { assetRegistry } from '../game/assets/AssetRegistry';
import { AudioManager } from '../game/audio/AudioManager';
import { CloudSyncService } from '../game/cloud/CloudSyncService';
import {
  CONTROLLER_CONFIG,
  ECONOMY_CONFIG,
  getXpRequiredForLevel,
} from '../game/config/balance';
import { SKINS, WEAPONS } from '../game/config/items';
import { SKILLS } from '../game/config/skills';
import { InputManager } from '../game/input/InputManager';
import { SaveSettings } from '../game/persistence/SaveData';
import { SaveManager } from '../game/persistence/SaveManager';
import { PlayerController } from '../game/player/PlayerController';
import { ComputedPlayerStats, computePlayerStats } from '../game/player/PlayerStats';
import { CameraRig } from '../game/rendering/CameraRig';
import { EffectsManager } from '../game/rendering/Effects';
import { Renderer } from '../game/rendering/Renderer';
import { CombatSystem } from '../game/systems/CombatSystem';
import { InteractionSystem } from '../game/systems/InteractionSystem';
import { ProgressionSystem } from '../game/systems/ProgressionSystem';
import { RunManager } from '../game/systems/RunManager';
import { createHubLayout, generateFloorLayout } from '../game/world/FloorGenerator';
import { LiveInteractable, World } from '../game/world/World';
import { UIController } from '../ui/UIController';
import {
  ActiveModal,
  GameMode,
  HudAbilitySlot,
  HudSnapshot,
  NpcDialogueState,
} from './GameState';
import { EventBus } from './events';

export class GameApp {
  public readonly events = new EventBus();
  public readonly saveManager: SaveManager;
  public readonly cloudSync: CloudSyncService;
  public readonly progression: ProgressionSystem;
  public readonly audio = new AudioManager();
  public readonly renderer: Renderer;
  public readonly effects: EffectsManager;
  public readonly world: World;
  public readonly cameraRig = new CameraRig();
  public readonly input: InputManager;
  public readonly player: PlayerController;
  public readonly combat: CombatSystem;
  public readonly interaction = new InteractionSystem();
  public readonly runManager = new RunManager();
  public readonly ui: UIController;

  private mode: GameMode = 'hub';
  private modalStack: ActiveModal[] = [];
  private activeDialogue: NpcDialogueState | null = null;
  private floorKills = 0;
  private nearestInteractable: LiveInteractable | null = null;

  private rafId = 0;
  private lastTimeMs = 0;
  private fpsSmoothed = 60;
  private hitStopTimer = 0;
  private tabHidden = false;

  constructor(canvas: HTMLCanvasElement, uiLayer: HTMLElement) {
    this.saveManager = new SaveManager(this.events);
    this.cloudSync = new CloudSyncService(this.saveManager, this.events);
    this.progression = new ProgressionSystem(this.saveManager, this.events);
    this.renderer = new Renderer(canvas);
    this.effects = new EffectsManager(this.renderer.scene, uiLayer);
    this.world = new World(this.renderer.scene);
    this.input = new InputManager(canvas);
    this.player = new PlayerController(this.renderer.scene);
    this.combat = new CombatSystem(
      this.renderer.scene,
      this.events,
      this.audio,
      this.effects,
      this.cameraRig
    );

    this.ui = new UIController(
      uiLayer,
      this.saveManager,
      this.progression,
      this.audio,
      this.events,
      {
        startRun: (seed, floor) => {
          if ((seed !== undefined || (floor !== undefined && floor > 1)) && !this.cloudSync.isDeveloperAccount()) {
            this.events.emit('toast', { text: 'Developer account required for custom seed/floor.', tone: 'danger' });
            return;
          }
          this.startRun(seed, floor);
        },
        continueEndless: () => this.continueEndlessAscent(),
        advanceFromCheckpoint: () => this.advanceToNextFloor(),
        returnToHub: () => this.enterHub(),
        openModal: (m) => this.pushModal(m),
        popModal: () => this.popModal(),
        closeAllModals: () => this.clearModals(),
        chooseBoon: (boonId) => this.handleChooseBoon(boonId),
        triggerAbilitySlot: (idx) => this.triggerEquippedSkill(idx),
        useConsumable: () => this.tryUseTonic(),
        applySettings: (next) => this.applySettings(next),
        resetSaveConfirmed: () => this.handleResetSave(),
        grantDebugCoins: (amt) => {
          if (!this.cloudSync.isDeveloperAccount()) {
            this.events.emit('toast', { text: 'Developer account required.', tone: 'danger' });
            return;
          }
          this.progression.grantCurrency(amt, false);
          this.events.emit('toast', { text: `Debug: +${amt} Sky Coins granted.`, tone: 'info' });
        },
      },
      this.cloudSync
    );

    this.input.setEscapeHandler(() => this.handleEscapeKey());
    this.input.setFreeMouseToggleHandler(() => {
      this.audio.playClick();
    });
    this.wireGameEvents();
    this.syncCosmeticsAndSettings();
    this.enterHub();
    this.preloadAssetsAndAudio();
    void this.cloudSync.initSession();

    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private get topModal(): ActiveModal {
    return this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1] : 'none';
  }

  private preloadAssetsAndAudio(): void {
    void this.audio.preloadAudioFiles();
    void assetRegistry
      .preloadAll((loaded, total, label) => {
        this.ui.setLoadingProgress(loaded / Math.max(1, total), label);
      })
      .then(() => {
        const save = this.saveManager.getData();
        this.player.avatar.refreshFromRegistry();
        this.player.avatar.applyWeapon(save.equippedWeapon);
        this.player.avatar.applySkin(SKINS[save.equippedSkin] ?? SKINS.shadow_runner);

        // Upgrade active scene props, NPCs, and enemies from procedural placeholders to Blender GLBs
        if (this.world.currentLayout) {
          const layout = this.world.currentLayout;
          const savedPlayerPos = this.player.position.clone();
          const savedYaw = this.player.facingYaw;
          this.world.loadLayout(layout, this.renderer.sunLight);
          if (this.mode === 'hub') {
            this.combat.spawnEnemies(layout.enemies, 1);
          }
          this.player.position.copy(savedPlayerPos);
          this.player.facingYaw = savedYaw;
        }

        this.ui.notifyAssetsReady();
      });
  }

  private wireGameEvents(): void {
    this.events.on('save_updated', () => {
      const save = this.saveManager.getData();
      const skin = SKINS[save.equippedSkin] ?? SKINS.shadow_runner;
      this.player.avatar.applyWeapon(save.equippedWeapon);
      this.player.avatar.applySkin(skin);
      this.cloudSync.scheduleSaveSync();
    });

    this.events.on('run_ended', ({ victory, floorReached, coinsEarned }) => {
      const run = this.runManager.activeRun;
      void this.cloudSync.recordRunHistory({
        seed: run?.seed ?? 'UNKNOWN',
        floorReached,
        victory,
        coinsEarned,
        enemiesDefeated: run?.runEnemiesDefeated ?? 0,
        durationSeconds: run?.elapsedSeconds ?? 0,
      });
    });

    this.events.on('enemy_hit', ({ crit }) => {
      this.hitStopTimer = Math.max(this.hitStopTimer, crit ? 0.045 : 0.02);
    });

    this.events.on('enemy_defeated', ({ reward, xp }) => {
      if (this.mode !== 'run' || !this.runManager.activeRun) return;
      const run = this.runManager.activeRun;
      const stats = this.getCurrentPlayerStats();
      const coinGain = Math.max(1, Math.round(reward * stats.coinMultiplier));

      run.runCoinsEarned += coinGain;
      run.runEnemiesDefeated += 1;
      this.floorKills += 1;

      this.progression.grantCurrency(coinGain);
      this.progression.grantAccountXp(xp);
      this.saveManager.update((d) => {
        d.stats.enemiesDefeated += 1;
      });

      this.updateFloorObjectiveState();

      const leveledInRun = this.runManager.awardRunXp(xp);
      if (leveledInRun && this.topModal === 'none') {
        this.audio.playLevelUp();
        this.pushModal('levelup');
      }
    });
  }

  private syncCosmeticsAndSettings(): void {
    const save = this.saveManager.getData();
    this.renderer.applyQuality(save.settings.graphicsQuality);
    this.audio.applySettings(save.settings);
    this.cameraRig.shakeEnabled = save.settings.screenShake;
    this.cameraRig.shakeStrength = save.settings.shakeStrength;
    this.effects.reduceFlashing = save.settings.reduceFlashing;
    this.ui.applyUiScale(save.settings.uiScale);
    this.player.avatar.applyWeapon(save.equippedWeapon);
    this.player.avatar.applySkin(SKINS[save.equippedSkin] ?? SKINS.shadow_runner);
  }

  private applySettings(next: SaveSettings): void {
    this.saveManager.update((draft) => {
      draft.settings = next;
    });
    this.renderer.applyQuality(next.graphicsQuality);
    this.audio.applySettings(next);
    this.cameraRig.shakeEnabled = next.screenShake;
    this.cameraRig.shakeStrength = next.shakeStrength;
    this.effects.reduceFlashing = next.reduceFlashing;
    this.ui.applyUiScale(next.uiScale);
  }

  private handleResetSave(): void {
    this.saveManager.reset();
    this.syncCosmeticsAndSettings();
    this.enterHub();
    this.events.emit('toast', {
      text: 'Save data reset to starter defaults.',
      tone: 'warning',
    });
  }

  private onVisibilityChange = (): void => {
    this.tabHidden = document.hidden;
    this.audio.setPausedForVisibility(this.tabHidden);
    if (this.tabHidden && this.mode === 'run' && this.topModal === 'none') {
      this.pushModal('pause');
    }
  };

  private handleEscapeKey(): void {
    if (this.mode === 'victory' || this.mode === 'defeat') return;
    if (this.topModal === 'levelup') return;
    if (this.modalStack.length > 0) {
      this.audio.playClick();
      this.popModal();
    } else {
      this.audio.playClick();
      this.pushModal('pause');
    }
  }

  public pushModal(modal: ActiveModal): void {
    if (modal === 'none') {
      this.clearModals();
      return;
    }
    if (this.topModal !== modal) {
      this.modalStack.push(modal);
    }
    this.input.setSuspended(true);
  }

  public popModal(): void {
    if (this.modalStack.length > 0) {
      const popped = this.modalStack.pop();
      if (popped === 'dialogue') {
        this.activeDialogue = null;
      }
    }
    if (this.modalStack.length === 0 && (this.mode === 'hub' || this.mode === 'run')) {
      this.input.setSuspended(false);
    }
  }

  public clearModals(): void {
    this.modalStack = [];
    this.activeDialogue = null;
    if (this.mode === 'hub' || this.mode === 'run') {
      this.input.setSuspended(false);
    }
  }

  public enterHub(): void {
    this.runManager.clearRun();
    this.mode = 'hub';
    this.modalStack = [];
    this.activeDialogue = null;
    this.floorKills = 0;
    this.effects.clear();
    this.combat.resetCooldowns();
    this.audio.setMusicState('hub');

    const hubLayout = createHubLayout();
    this.world.loadLayout(hubLayout, this.renderer.sunLight);
    this.combat.spawnEnemies(hubLayout.enemies, 1);
    this.player.spawnAt(hubLayout.spawnPoint);
    this.cameraRig.resetBehindTarget(hubLayout.spawnPoint, 0);
    this.interaction.resetFloorGrace();
    this.input.setSuspended(false);
  }

  public startRun(customSeed?: string, startFloor = 1): void {
    this.audio.unlock();
    this.audio.playPortalEnter();
    this.audio.setMusicState('combat');

    const save = this.saveManager.update((draft) => {
      draft.stats.runsStarted += 1;
      draft.stats.highestFloor = Math.max(draft.stats.highestFloor, startFloor);
    });

    const run = this.runManager.startNewRun(save, customSeed, startFloor);
    this.mode = 'run';
    this.modalStack = [];
    this.activeDialogue = null;
    this.combat.resetCooldowns();
    this.loadRunFloor(run.floor);
    this.input.setSuspended(false);

    this.events.emit('toast', {
      text: `Entered Floor ${run.floor} · ${this.world.currentLayout?.theme.name ?? 'Cloudspire'}`,
      tone: 'info',
    });
  }

  private loadRunFloor(floorNumber: number): void {
    const run = this.runManager.activeRun;
    if (!run) return;

    run.floor = floorNumber;
    this.floorKills = 0;
    this.effects.clear();

    const layout = generateFloorLayout(floorNumber, run.seed);
    this.world.loadLayout(layout, this.renderer.sunLight);
    this.combat.spawnEnemies(layout.enemies, floorNumber);
    this.player.spawnAt(layout.spawnPoint);
    this.cameraRig.resetBehindTarget(layout.spawnPoint, 0);
    this.interaction.resetFloorGrace();
    this.effects.spawnRuneSwirl(layout.spawnPoint, layout.theme.neonAccent, 12);

    this.saveManager.update((draft) => {
      draft.stats.highestFloor = Math.max(draft.stats.highestFloor, floorNumber);
    });

    this.updateFloorObjectiveState();
  }

  private updateFloorObjectiveState(): void {
    const run = this.runManager.activeRun;
    const layout = this.world.currentLayout;
    if (!run || !layout || layout.isHub) return;

    const req = layout.requiredKills;
    const boss = this.combat.getActiveBoss();

    if (boss) {
      run.portalUnlocked = false;
      run.objectiveText = 'Defeat the Spire Warden';
      run.objectiveProgress = `${Math.min(this.floorKills, req)} / ${req}`;
      return;
    }

    const wasUnlocked = run.portalUnlocked;
    run.portalUnlocked = this.floorKills >= req;
    if (run.portalUnlocked) {
      run.objectiveText = 'Ascent Gate Unsealed';
      run.objectiveProgress = 'READY';
      if (!wasUnlocked) {
        this.audio.playFloorClear();
        this.events.emit('toast', {
          text: 'Ascent Gate Unsealed — Step into the Summit Portal!',
          tone: 'success',
        });
      }
    } else {
      run.objectiveText = 'Defeat Constructs';
      run.objectiveProgress = `${this.floorKills} / ${req}`;
    }
  }

  private handleChooseBoon(boonId: string): void {
    this.runManager.applyBoonChoice(boonId, this.saveManager.getData());
    this.effects.spawnRing(this.player.position, '#fbbf24', 3.4, 0.4);
    this.effects.spawnRuneSwirl(this.player.position, '#a855f7', 16);
    this.clearModals();
  }

  private completeCurrentFloor(): void {
    const run = this.runManager.activeRun;
    if (!run) return;

    const stats = this.getCurrentPlayerStats();
    const clearBonus = Math.round(
      (ECONOMY_CONFIG.floorClearBaseCoins +
        run.floor * ECONOMY_CONFIG.floorClearPerFloorCoins) *
        stats.coinMultiplier
    );

    run.runCoinsEarned += clearBonus;
    run.runFloorsCleared += 1;
    run.hp = Math.min(run.maxHp, run.hp + 18);

    this.progression.grantCurrency(clearBonus);
    this.progression.grantAccountXp(40 + run.floor * 10);
    this.saveManager.update((draft) => {
      draft.stats.floorsCleared += 1;
      draft.stats.highestFloor = Math.max(draft.stats.highestFloor, run.floor);
    });

    this.events.emit('floor_cleared', { floor: run.floor, rewardCoins: clearBonus });

    if (run.floor === ECONOMY_CONFIG.standardTowerFloors && !run.endlessMode) {
      const victoryBonus = ECONOMY_CONFIG.towerCompletionBonusCoins;
      run.runCoinsEarned += victoryBonus;
      this.progression.grantCurrency(victoryBonus);
      this.saveManager.update((draft) => {
        draft.stats.runsCompleted += 1;
      });

      this.audio.playVictory();
      this.ui.summaryData = {
        victory: true,
        floorReached: run.floor,
        coinsEarned: run.runCoinsEarned,
        enemiesDefeated: run.runEnemiesDefeated,
      };
      this.mode = 'victory';
      this.modalStack = [];
      this.input.setSuspended(true);
      this.events.emit('run_ended', {
        victory: true,
        floorReached: run.floor,
        coinsEarned: run.runCoinsEarned,
      });
      return;
    }

    this.audio.playFloorClear();
    if (run.floor % 2 === 0) {
      this.pushModal('checkpoint');
      return;
    }

    this.advanceToNextFloor();
  }

  private advanceToNextFloor(): void {
    const run = this.runManager.activeRun;
    if (!run) return;
    this.audio.playPortalEnter();
    this.clearModals();
    this.loadRunFloor(run.floor + 1);
    this.events.emit('toast', {
      text: `Floor ${run.floor} · ${this.world.currentLayout?.theme.name ?? 'Sky Spire'}`,
      tone: 'success',
    });
  }

  private continueEndlessAscent(): void {
    const run = this.runManager.activeRun;
    if (!run) {
      this.startRun(undefined, ECONOMY_CONFIG.standardTowerFloors + 1);
      return;
    }
    this.audio.playPortalEnter();
    this.audio.setMusicState('combat');
    run.endlessMode = true;
    this.mode = 'run';
    this.modalStack = [];
    this.loadRunFloor(run.floor + 1);
    this.input.setSuspended(false);
  }

  private getCurrentPlayerStats(): ComputedPlayerStats {
    return computePlayerStats(
      this.saveManager.getData(),
      this.runManager.activeRun?.boonCounts ?? {}
    );
  }

  private triggerEquippedSkill(slotIndex: number): void {
    if (this.topModal !== 'none' || (this.mode !== 'hub' && this.mode !== 'run')) return;
    const save = this.saveManager.getData();
    const skillId = save.equippedSkills[slotIndex];
    if (!skillId) return;

    const stats = this.getCurrentPlayerStats();
    const axes = this.input.getMoveAxes();
    const cy = this.cameraRig.yaw;
    const moveWorld = new THREE.Vector3(
      Math.cos(cy) * axes.x + Math.sin(cy) * axes.z,
      0,
      -Math.sin(cy) * axes.x + Math.cos(cy) * axes.z
    );

    this.combat.tryUseSkill(skillId, this.player, stats, moveWorld, {
      grantShieldAndHeal: (shieldAmt, healAmt) => {
        if (this.runManager.activeRun) {
          this.runManager.activeRun.shield = Math.min(90, this.runManager.activeRun.shield + shieldAmt);
          this.healPlayer(healAmt);
        }
      },
    });
  }

  private tryUseTonic(): void {
    if (this.mode !== 'run' || !this.runManager.activeRun) {
      this.events.emit('toast', {
        text: 'Sky Tonics restore +45 HP during Tower Runs.',
        tone: 'info',
      });
      return;
    }
    const run = this.runManager.activeRun;
    if (run.tonicsLeft <= 0) {
      this.audio.playError();
      this.events.emit('toast', { text: 'No Sky Tonics remaining!', tone: 'warning' });
      return;
    }
    if (run.hp >= run.maxHp) {
      this.events.emit('toast', { text: 'Health is already full!', tone: 'info' });
      return;
    }

    run.tonicsLeft -= 1;
    this.saveManager.update((draft) => {
      draft.consumables.sky_tonic = Math.max(0, (draft.consumables.sky_tonic ?? 1) - 1);
    });
    this.healPlayer(ECONOMY_CONFIG.tonicHealAmount);
    this.audio.playHeal();
    this.effects.spawnRing(this.player.position, '#34d399', 2.6, 0.34);
    this.effects.spawnRuneSwirl(this.player.position, '#34d399', 10);
  }

  private healPlayer(amount: number): void {
    const run = this.runManager.activeRun;
    if (!run || amount <= 0) return;
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + amount);
    const actual = Math.round(run.hp - before);
    if (actual > 0) {
      this.effects.spawnFloatingText(this.player.position, `+${actual} HP`, '#4ade80');
      this.events.emit('player_healed', { amount: actual });
    }
  }

  private damagePlayer(rawAmount: number): void {
    if (this.mode !== 'run' || !this.runManager.activeRun) return;
    if (this.player.invulnTimer > 0 || rawAmount <= 0) return;

    const run = this.runManager.activeRun;
    this.player.invulnTimer = CONTROLLER_CONFIG.invulnerabilityDuration;

    let remaining = rawAmount;
    if (run.shield > 0) {
      const absorbed = Math.min(run.shield, remaining);
      run.shield -= absorbed;
      remaining -= absorbed;
      if (remaining <= 0) {
        this.audio.playPlayerHurt(true);
        this.effects.spawnRing(this.player.position, '#38bdf8', 2.2, 0.24);
        this.effects.spawnFloatingText(this.player.position, 'BLOCKED', '#38bdf8');
        this.events.emit('player_hurt', { damage: 0, blocked: true });
        return;
      }
    }

    run.hp = Math.max(0, run.hp - remaining);
    this.combat.hitStreak = 0;
    this.player.avatar.triggerHurtFlash();
    this.audio.playPlayerHurt(false);
    this.cameraRig.addTrauma(0.45);
    this.effects.spawnBurst(this.player.position, '#f43f5e', 10, 5.5, 0.9);
    this.effects.spawnFloatingText(this.player.position, `-${remaining}`, '#fb7185', true);
    this.events.emit('player_hurt', { damage: remaining, blocked: false });

    if (run.hp <= 0) {
      if (run.extraLives > 0) {
        run.extraLives -= 1;
        run.hp = Math.round(run.maxHp * 0.6);
        this.player.invulnTimer = 1.6;
        this.audio.playLevelUp();
        this.effects.spawnRing(this.player.position, '#fbbf24', 4.5, 0.48);
        this.effects.spawnRuneSwirl(this.player.position, '#fbbf24', 16);
        this.events.emit('toast', {
          text: 'Extra Life Triggered — Second Wind!',
          tone: 'warning',
        });
        return;
      }

      this.audio.playDefeat();
      this.ui.summaryData = {
        victory: false,
        floorReached: run.floor,
        coinsEarned: run.runCoinsEarned,
        enemiesDefeated: run.runEnemiesDefeated,
      };
      this.mode = 'defeat';
      this.modalStack = [];
      this.input.setSuspended(true);
      this.events.emit('run_ended', {
        victory: false,
        floorReached: run.floor,
        coinsEarned: run.runCoinsEarned,
      });
    }
  }

  private activateInteractable(inter: LiveInteractable): void {
    const kind = inter.spec.kind;

    if (kind === 'npc' && inter.spec.npcId) {
      this.audio.playClick();
      this.activeDialogue = {
        npcId: inter.spec.npcId,
        npcName: inter.spec.npcName ?? 'Sanctuary Keeper',
        npcRole: inter.spec.npcRole ?? 'Cloudspire Sanctuary',
        lines: inter.spec.npcLines ?? ['Welcome to Cloudspire Sanctuary, Vanguard!'],
        action: inter.spec.npcAction,
      };
      this.pushModal('dialogue');
      return;
    }

    if (kind === 'shop_kiosk') {
      this.audio.playClick();
      this.pushModal('shop');
      return;
    }

    if (kind === 'armory_kiosk') {
      this.audio.playClick();
      this.pushModal('inventory');
      return;
    }

    if (kind === 'portal') {
      if (this.mode === 'hub') {
        this.startRun();
        return;
      }
      if (this.runManager.activeRun?.portalUnlocked) {
        inter.used = true;
        this.completeCurrentFloor();
      } else {
        this.audio.playError();
        this.events.emit('toast', {
          text: `Gate Sealed — ${this.runManager.activeRun?.objectiveText ?? 'Defeat constructs'} (${this.runManager.activeRun?.objectiveProgress ?? ''})`,
          tone: 'warning',
        });
      }
      return;
    }

    if (kind === 'chest' && !inter.used) {
      inter.used = true;
      const stats = this.getCurrentPlayerStats();
      const coins = Math.round((inter.spec.coinValue ?? 35) * stats.coinMultiplier);
      this.progression.grantCurrency(coins);
      if (this.runManager.activeRun) {
        this.runManager.activeRun.runCoinsEarned += coins;
        const lvUp = this.runManager.awardRunXp(30);
        if (lvUp && this.topModal === 'none') {
          this.audio.playLevelUp();
          this.pushModal('levelup');
        }
      }
      this.audio.playChestOpen();
      this.effects.spawnRuneSwirl(inter.spec, '#fbbf24', 14);
      this.effects.spawnBurst(inter.spec, '#fbbf24', 18, 6.8, 1.0);
      this.effects.spawnFloatingText(inter.spec, `+${coins} Coins`, '#fde68a', true);
      return;
    }

    if (kind === 'shrine' && !inter.used) {
      inter.used = true;
      const coins = inter.spec.coinValue ?? 20;
      this.progression.grantCurrency(coins);
      if (this.runManager.activeRun) {
        this.runManager.activeRun.runCoinsEarned += coins;
      }
      this.healPlayer(35);
      this.audio.playShrineBless();
      this.effects.spawnRing(inter.spec, '#4ade80', 3.4, 0.42);
      this.effects.spawnRuneSwirl(inter.spec, '#4ade80', 14);
      this.effects.spawnBurst(inter.spec, '#4ade80', 14, 6.0, 1.0);
    }
  }

  public start(): void {
    this.lastTimeMs = performance.now();
    const tick = (nowMs: number) => {
      this.rafId = requestAnimationFrame(tick);
      if (this.tabHidden) {
        this.lastTimeMs = nowMs;
        return;
      }

      const rawDt = (nowMs - this.lastTimeMs) / 1000;
      this.lastTimeMs = nowMs;
      const realDt = Math.min(CONTROLLER_CONFIG.maxFrameDelta, Math.max(0.001, rawDt));
      if (rawDt > 0.0005) {
        this.fpsSmoothed = THREE.MathUtils.lerp(this.fpsSmoothed, 1 / rawDt, 0.08);
      }

      this.stepFrame(realDt);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stepFrame(realDt: number): void {
    const save = this.saveManager.getData();
    const gpCmd = this.input.pollGamepad(realDt);
    const gameplayActive =
      (this.mode === 'hub' || this.mode === 'run') && this.topModal === 'none';

    let simDt = realDt;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - realDt);
      simDt = realDt * 0.08;
    }

    if (gameplayActive) {
      const look = this.input.consumeLookDelta();
      this.cameraRig.applyLookInput(
        look.dx,
        look.dy,
        this.input.getKeyboardCameraSpin(),
        save.settings.mouseSensitivity,
        realDt
      );

      const stats = this.getCurrentPlayerStats();
      const layout = this.world.currentLayout;

      if (layout) {
        const hasShield = (this.runManager.activeRun?.shield ?? 0) > 0;
        const stepOut = this.player.step(
          simDt,
          this.input.getMoveAxes(),
          this.input.wasJumpPressed(),
          this.cameraRig.yaw,
          stats,
          layout.colliders,
          layout.jumpPads,
          hasShield
        );

        if (stepOut.stepped) {
          this.audio.playFootstep();
          this.effects.spawnDustPuff(this.player.position, 2, 0.32);
        }
        if (stepOut.jumped) {
          this.audio.playJump(false);
          this.effects.spawnDustPuff(this.player.position, 5, 0.5);
        } else if (stepOut.doubleJumped) {
          this.audio.playJump(true);
          this.effects.spawnRing(this.player.position, '#60a5fa', 2.2, 0.26);
          this.effects.spawnRuneSwirl(this.player.position, '#60a5fa', 8);
        }
        if (stepOut.landed) {
          this.audio.playLand();
          this.effects.spawnDustPuff(this.player.position, 6, 0.58);
        }
        if (stepOut.hitJumpPad) {
          this.audio.playJumpPad();
          this.effects.spawnRing(stepOut.hitJumpPad, stepOut.hitJumpPad.color, 2.5, 0.3);
          this.effects.spawnRuneSwirl(stepOut.hitJumpPad, stepOut.hitJumpPad.color, 8);
        }
        if (stepOut.fellInAbyss && this.mode === 'run' && this.runManager.activeRun) {
          const fallDmg = Math.max(
            8,
            Math.round(this.runManager.activeRun.maxHp * CONTROLLER_CONFIG.abyssRespawnDamageRatio)
          );
          this.events.emit('toast', {
            text: 'Recovered from the Cloud Abyss!',
            tone: 'warning',
          });
          this.player.invulnTimer = 0;
          this.damagePlayer(fallDmg);
        }

        const skin = SKINS[save.equippedSkin] ?? SKINS.shadow_runner;
        const wep = WEAPONS[save.equippedWeapon] ?? WEAPONS.skyblade;
        const slashHue = save.equippedWeapon === 'skyblade' ? skin.accentColor : wep.accentColor;

        if (this.input.wasAttackPressed() || this.input.isAttackHeld()) {
          this.combat.tryPrimaryAttack(this.player, stats, slashHue);
        }
        if (this.input.wasSkill1Pressed()) {
          this.triggerEquippedSkill(0);
        }
        if (this.input.wasSkill2Pressed()) {
          this.triggerEquippedSkill(1);
        }
        if (this.input.wasConsumablePressed()) {
          this.tryUseTonic();
        }

        const portalReady =
          this.mode === 'hub' ? true : Boolean(this.runManager.activeRun?.portalUnlocked);

        this.world.update(simDt, this.player.position, portalReady);
        this.combat.update(
          simDt,
          this.player,
          this.renderer.camera.quaternion,
          layout.colliders,
          (dmg) => this.damagePlayer(dmg),
          save.settings.reduceFlashing
        );

        const interRes = this.interaction.update(
          simDt,
          this.player.position,
          stats.pickupRadius,
          stats.coinMultiplier,
          this.world,
          portalReady
        );

        if (interRes.coinsCollected > 0) {
          this.audio.playCoin();
          this.progression.grantCurrency(interRes.coinsCollected);
          if (this.runManager.activeRun) {
            this.runManager.activeRun.runCoinsEarned += interRes.coinsCollected;
          }
          this.effects.spawnRuneSwirl(this.player.position, '#fbbf24', 5);
          this.effects.spawnFloatingText(
            this.player.position,
            `+${interRes.coinsCollected}`,
            '#fbbf24'
          );
          this.events.emit('coin_pickup', { amount: interRes.coinsCollected });
        }

        if (interRes.healCollected > 0) {
          this.audio.playHeal();
          this.effects.spawnRuneSwirl(this.player.position, '#4ade80', 8);
          this.healPlayer(interRes.healCollected);
        }

        if (interRes.hazardDamageTaken > 0) {
          this.damagePlayer(interRes.hazardDamageTaken);
        }

        this.nearestInteractable = interRes.nearestInteractable;
        if (interRes.autoPortalTriggered) {
          this.activateInteractable(interRes.autoPortalTriggered);
        } else if (this.nearestInteractable && this.input.wasInteractPressed()) {
          this.activateInteractable(this.nearestInteractable);
        }

        if (this.runManager.activeRun) {
          this.runManager.activeRun.elapsedSeconds += simDt;
        }
      }
    } else {
      this.input.consumeLookDelta();
      this.nearestInteractable = null;
      if (this.topModal !== 'none' || this.mode === 'victory' || this.mode === 'defeat') {
        this.ui.handleGamepadUiInput(gpCmd);
      }
    }

    this.cameraRig.update(
      this.renderer.camera,
      this.player.position,
      realDt,
      this.world.currentLayout?.colliders ?? []
    );
    this.renderer.updateShadowFocus(this.player.position);
    this.effects.update(realDt, this.renderer.camera);
    this.renderer.render();

    this.ui.updateHud(
      this.buildHudSnapshot(),
      this.runManager.activeRun?.pendingBoonChoices ?? []
    );
    this.input.endFrame();
  }

  private buildHudSnapshot(): HudSnapshot {
    const save = this.saveManager.getData();
    const stats = this.getCurrentPlayerStats();
    const run = this.runManager.activeRun;
    const layout = this.world.currentLayout;

    const abilities: HudAbilitySlot[] = save.equippedSkills.slice(0, 2).map((id, idx) => {
      const def = SKILLS[id] ?? SKILLS.phase_dash;
      const total = this.combat.getEffectiveSkillCooldown(def, stats);
      const rem = this.combat.getSkillCooldownRemaining(def.id);
      return {
        slotLabel: `Slot ${idx + 1}`,
        keyHint: idx === 0 ? 'Q' : 'E',
        id: def.id,
        name: def.name,
        icon: def.icon,
        accentColor: def.accentColor,
        cooldownRemaining: rem,
        cooldownTotal: total,
        ready: rem <= 0.01,
      };
    });

    const boss = this.combat.getActiveBoss();

    if (this.mode === 'run' && run) {
      const reqKills = Math.max(1, layout?.requiredKills ?? 1);
      const ratio = run.portalUnlocked ? 1 : Math.min(1, this.floorKills / reqKills);

      return {
        mode: this.mode,
        modal: this.topModal,
        modalStackDepth: this.modalStack.length,
        pointerLocked: this.input.pointerLocked,
        gamepadConnected: this.input.gamepadConnected,
        floor: run.floor,
        floorTitle: `FLOOR ${run.floor}`,
        floorSubtitle: layout?.theme.subtitle ?? 'Reach the top!',
        objectiveText: run.objectiveText,
        objectiveProgress: run.objectiveProgress,
        portalUnlocked: run.portalUnlocked,
        floorProgressRatio: ratio,
        elapsedSeconds: run.elapsedSeconds,
        runSeed: run.seed,
        boonCounts: run.boonCounts,
        comboStreak: this.combat.hitStreak,
        comboTimerRatio: this.combat.getStreakRatio(),
        hp: run.hp,
        maxHp: run.maxHp,
        shield: run.shield,
        extraLives: run.extraLives,
        level: run.runLevel,
        xp: run.runXp,
        xpToNext: run.runXpToNext,
        bankedCoins: save.currency,
        runCoins: run.runCoinsEarned,
        tonicsLeft: run.tonicsLeft,
        hasDoubleJump: stats.hasDoubleJump,
        abilities,
        interactPrompt: this.nearestInteractable?.spec.label ?? null,
        boss: boss ? { name: boss.stats.name, hp: boss.hp, maxHp: boss.maxHp } : null,
        dialogue: this.activeDialogue,
        fps: this.fpsSmoothed,
        showFps: save.settings.showFps,
        storageHealthy: this.saveManager.isStorageHealthy(),
      };
    }

    const acctLv = save.stats.accountLevel;
    return {
      mode: this.mode,
      modal: this.topModal,
      modalStackDepth: this.modalStack.length,
      pointerLocked: this.input.pointerLocked,
      gamepadConnected: this.input.gamepadConnected,
      floor: 0,
      floorTitle: 'CLOUDSPIRE',
      floorSubtitle: 'Sky Sanctuary',
      objectiveText: 'Enter North Portal',
      objectiveProgress: `Best Floor ${save.stats.highestFloor}`,
      portalUnlocked: true,
      floorProgressRatio: 1,
      elapsedSeconds: 0,
      runSeed: 'SANCTUARY',
      boonCounts: {},
      comboStreak: this.combat.hitStreak,
      comboTimerRatio: this.combat.getStreakRatio(),
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      shield: 0,
      extraLives: 0,
      level: acctLv,
      xp: save.stats.accountXp,
      xpToNext: getXpRequiredForLevel(acctLv),
      bankedCoins: save.currency,
      runCoins: 0,
      tonicsLeft: save.consumables.sky_tonic ?? 0,
      hasDoubleJump: stats.hasDoubleJump,
      abilities,
      interactPrompt: this.nearestInteractable?.spec.label ?? null,
      boss: null,
      dialogue: this.activeDialogue,
      fps: this.fpsSmoothed,
      showFps: save.settings.showFps,
      storageHealthy: this.saveManager.isStorageHealthy(),
    };
  }

  public dispose(): void {
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.input.dispose();
    this.combat.dispose();
    this.world.dispose();
    this.effects.dispose();
    this.renderer.dispose();
    this.audio.dispose();
    this.ui.dispose();
  }
}
