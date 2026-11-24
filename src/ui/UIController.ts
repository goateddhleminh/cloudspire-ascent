import { ActiveModal, HudSnapshot, NpcDialogueState } from '../app/GameState';
import { EventBus } from '../app/events';
import { AudioManager } from '../game/audio/AudioManager';
import {
  CloudRunHistoryRow,
  CloudSyncService,
  GlobalLeaderboardRow,
} from '../game/cloud/CloudSyncService';
import {
  CONSUMABLES,
  QUESTS,
  RIVAL_CLIMBERS,
  RUN_BOONS,
  RunBoonDefinition,
  SKINS,
  SKIN_LIST,
  SkinDefinition,
  UPGRADE_LIST,
  WEAPONS,
  WEAPON_LIST,
  getUpgradePrice,
} from '../game/config/items';
import { SKILLS, SKILL_LIST } from '../game/config/skills';
import { UiGamepadCommand } from '../game/input/InputManager';
import { GraphicsQuality, SaveSettings } from '../game/persistence/SaveData';
import { SaveManager } from '../game/persistence/SaveManager';
import { ProgressionSystem } from '../game/systems/ProgressionSystem';
import { CharacterPreview3D } from './CharacterPreview3D';
import { ICONS, getIconSvg } from './icons';

export interface UIActions {
  startRun: (customSeed?: string, startFloor?: number) => void;
  continueEndless: () => void;
  advanceFromCheckpoint: () => void;
  returnToHub: () => void;
  openModal: (modal: ActiveModal) => void;
  popModal: () => void;
  closeAllModals: () => void;
  chooseBoon: (boonId: string) => void;
  triggerAbilitySlot: (slotIndex: number) => void;
  useConsumable: () => void;
  applySettings: (next: SaveSettings) => void;
  resetSaveConfirmed: () => void;
  grantDebugCoins: (amount: number) => void;
}

type ShopTab = 'all' | 'weapons' | 'skills' | 'upgrades' | 'skins';
type InvTab = 'all' | 'weapons' | 'skills' | 'skins' | 'upgrades';
type SettingsTab = 'gameplay' | 'audio' | 'graphics' | 'controls' | 'data';

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(56, 189, 248, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class UIController {
  private hudRoot: HTMLDivElement;
  private modalRoot: HTMLDivElement;
  private toastStack: HTMLDivElement;
  private bootLoaderEl: HTMLDivElement;
  private bootLoaderFill!: HTMLElement;
  private bootLoaderLabel!: HTMLElement;
  private preview3D = new CharacterPreview3D();

  // Cached HUD DOM references
  private elFloorHeading!: HTMLElement;
  private elFloorSub!: HTMLElement;
  private elFloorProgWrap!: HTMLElement;
  private elFloorProgFill!: HTMLElement;
  private elBoonsStrip!: HTMLElement;
  private elHubPlayBtn!: HTMLButtonElement;
  private elBankCoins!: HTMLElement;
  private elRunLoot!: HTMLElement;
  private elFpsPill!: HTMLElement;
  private elLeftRail!: HTMLElement;
  private elQuestPip!: HTMLElement;
  private elClimberBody!: HTMLElement;
  private elComboCard!: HTMLElement;
  private elComboNum!: HTMLElement;
  private elComboSub!: HTMLElement;
  private elComboFill!: HTMLElement;
  private elPortraitImg!: HTMLImageElement;
  private elVitalsLv!: HTMLElement;
  private elVitalsHpNums!: HTMLElement;
  private elHpGhost!: HTMLElement;
  private elHpLive!: HTMLElement;
  private elXpLive!: HTMLElement;
  private elInteractChip!: HTMLElement;
  private elInteractText!: HTMLElement;
  private elSkillDock!: HTMLElement;
  private elBossBanner!: HTMLElement;
  private elBossName!: HTMLElement;
  private elBossHpNums!: HTMLElement;
  private elBossFill!: HTMLElement;

  private shopTab: ShopTab = 'all';
  private invTab: InvTab = 'all';
  private settingsTab: SettingsTab = 'gameplay';
  private lbTab: 'rivals' | 'global' = 'rivals';
  private globalLbRows: GlobalLeaderboardRow[] | null = null;
  private cloudRunHistory: CloudRunHistoryRow[] | null = null;
  private cloudAuthMsg = '';
  private previewSkinId: string | null = null;
  private previewWeaponId: string | null = null;
  private selectedInvKey = 'weapon:skyblade';
  private debugExpanded = false;
  private debugSeedInput = '';
  private debugFloorInput = 1;

  private lastModalKey = '';
  private lastStackDepth = 0;
  private focusReturnStack: string[] = [];
  private lastAbilitySig = '';
  private lastClimberSig = '';
  private lastBoonsSig = '';
  private lastPortraitSig = '';
  private activeBoonChoices: RunBoonDefinition[] = [];

  public summaryData: {
    victory: boolean;
    floorReached: number;
    coinsEarned: number;
    enemiesDefeated: number;
  } | null = null;

  constructor(
    private root: HTMLElement,
    private saveManager: SaveManager,
    private progression: ProgressionSystem,
    private audio: AudioManager,
    private events: EventBus,
    private actions: UIActions,
    private cloudSync?: CloudSyncService
  ) {
    this.hudRoot = document.createElement('div');
    this.modalRoot = document.createElement('div');
    this.toastStack = document.createElement('div');
    this.toastStack.className = 'toast-stack';

    this.bootLoaderEl = document.createElement('div');
    this.bootLoaderEl.className = 'hud-surface boot-loader-pill';
    this.bootLoaderEl.innerHTML = `
      <span id="boot-loader-lbl">Loading 3D Assets...</span>
      <div class="boot-loader-track">
        <div class="boot-loader-fill" id="boot-loader-fill" style="width:8%;"></div>
      </div>
    `;
    this.bootLoaderFill = this.bootLoaderEl.querySelector('#boot-loader-fill')!;
    this.bootLoaderLabel = this.bootLoaderEl.querySelector('#boot-loader-lbl')!;

    this.root.appendChild(this.hudRoot);
    this.root.appendChild(this.bootLoaderEl);
    this.root.appendChild(this.toastStack);
    this.root.appendChild(this.modalRoot);

    this.buildHudShell();
    this.applyUiScale(this.saveManager.getData().settings.uiScale);

    this.events.on('toast', ({ text, tone }) => this.pushToast(text, tone ?? 'info'));
    this.events.on('storage_warning', ({ message }) => this.pushToast(message, 'warning', 6000));
    this.events.on('save_updated', () => this.refreshOpenModalContent());
    window.addEventListener('keydown', this.onModalKeyDown);
  }

  public applyUiScale(scale: number): void {
    if (typeof document === 'undefined') return;
    const clamped = Math.max(0.85, Math.min(1.3, scale || 1));
    document.documentElement.style.setProperty('--ui-scale', clamped.toFixed(2));
  }

  public setLoadingProgress(ratio: number, _label: string): void {
    const pct = Math.round(Math.max(0.08, Math.min(1, ratio)) * 100);
    this.bootLoaderFill.style.width = `${pct}%`;
    this.bootLoaderLabel.textContent = `Loading 3D Assets ${pct}%`;
  }

  public notifyAssetsReady(): void {
    this.preview3D.invalidateCachesForGlbUpgrade();
    this.lastPortraitSig = '';
    this.lastClimberSig = '';
    this.bootLoaderFill.style.width = '100%';
    this.bootLoaderLabel.textContent = '3D Assets Ready';
    window.setTimeout(() => {
      this.bootLoaderEl.style.opacity = '0';
      window.setTimeout(() => {
        this.bootLoaderEl.style.display = 'none';
      }, 280);
    }, 320);
    this.refreshOpenModalContent();
  }

  private getModalFocusableControls(): HTMLElement[] {
    if (!this.modalRoot.firstElementChild) return [];
    return Array.from(
      this.modalRoot.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled)'
      )
    ).filter((el) => el.offsetParent !== null);
  }

  private onModalKeyDown = (e: KeyboardEvent): void => {
    // 1/2/3 quick-select on Level-Up Blessing modal
    if (this.lastModalKey === 'levelup' && this.activeBoonChoices.length > 0) {
      const idx =
        e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : e.code === 'Digit3' ? 2 : -1;
      if (idx >= 0 && this.activeBoonChoices[idx]) {
        e.preventDefault();
        this.audio.playBuy();
        this.actions.chooseBoon(this.activeBoonChoices[idx].id);
        return;
      }
    }

    if (!this.lastModalKey || this.lastModalKey === 'none') return;

    const focusables = this.getModalFocusableControls();
    if (focusables.length === 0) return;

    // Strict Focus Trap on Tab / Shift+Tab inside modal
    if (e.key === 'Tab') {
      const active = document.activeElement as HTMLElement | null;
      const idx = active ? focusables.indexOf(active) : -1;
      e.preventDefault();
      const nextIdx = e.shiftKey
        ? idx <= 0
          ? focusables.length - 1
          : idx - 1
        : idx < 0 || idx >= focusables.length - 1
          ? 0
          : idx + 1;
      focusables[nextIdx]?.focus();
      return;
    }

    // Arrow key spatial/sequential navigation when not adjusting a range/text input
    const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
    if (activeTag !== 'INPUT') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.moveModalFocus(1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.moveModalFocus(-1);
      }
    }
  };

  public handleGamepadUiInput(cmd: UiGamepadCommand): void {
    if (cmd.back && this.lastModalKey !== 'levelup') {
      this.audio.playClick();
      this.actions.popModal();
      return;
    }
    if (cmd.navDelta !== 0) {
      this.audio.playHover();
      this.moveModalFocus(cmd.navDelta);
    }
    if (cmd.confirm) {
      const active = document.activeElement as HTMLElement | null;
      if (active && this.modalRoot.contains(active)) {
        active.click();
      } else {
        const first = this.getModalFocusableControls()[0];
        first?.focus();
        first?.click();
      }
    }
  }

  private moveModalFocus(delta: number): void {
    const list = this.getModalFocusableControls();
    if (list.length === 0) return;
    const cur = document.activeElement as HTMLElement | null;
    const idx = cur ? list.indexOf(cur) : -1;
    const nextIdx =
      idx === -1 ? 0 : (idx + delta + list.length) % list.length;
    list.forEach((el) => el.classList.remove('gp-focused'));
    const target = list[nextIdx];
    if (target) {
      target.classList.add('gp-focused');
      target.focus();
    }
  }

  private buildHudShell(): void {
    this.hudRoot.innerHTML = `
      <header class="hud-top-bar">
        <div class="top-left-cluster">
          <button class="spire-orb-btn" id="btn-hud-pause" aria-label="Pause Menu" title="Menu (Esc)">
            ${ICONS.spireLogo}
          </button>
          <div class="hud-surface top-utility-pill">
            <button class="utility-icon-btn" id="btn-hud-settings" aria-label="Settings" title="Settings">
              ${ICONS.menu}
            </button>
            <button class="utility-icon-btn" id="btn-hud-controls" aria-label="Controls" title="Controls">
              ${ICONS.help}
            </button>
          </div>
          <div class="hud-surface fps-pill" id="hud-fps-pill" style="display:none;">60 FPS</div>
        </div>

        <div class="top-center-stack">
          <div class="hud-surface floor-plaque">
            <div class="floor-plaque-icon">${ICONS.upArrow}</div>
            <div class="floor-plaque-copy" style="min-width:162px;">
              <div class="floor-plaque-heading" id="hud-floor-heading">CLOUDSPIRE</div>
              <div class="floor-plaque-sub" id="hud-floor-sub">Sky Sanctuary</div>
              <div class="floor-progress-track" id="hud-floor-prog-wrap" style="display:none;">
                <div class="floor-progress-fill" id="hud-floor-prog-fill" style="width:0%;"></div>
              </div>
            </div>
          </div>
          <div class="boons-strip" id="hud-boons-strip"></div>
          <button class="hub-enter-cta" id="btn-hub-enter">
            ${ICONS.play}
            <span>Enter Tower</span>
          </button>
        </div>

        <div class="top-right-column">
          <div class="currency-strip">
            <div class="hud-surface run-loot-capsule" id="hud-run-loot" style="display:none;">+0</div>
            <div class="hud-surface coin-capsule" title="Sky Coins">
              <span class="coin-capsule-icon">${ICONS.coin}</span>
              <span id="hud-bank-coins">100</span>
              <button class="coin-add-btn" id="btn-coin-shop" aria-label="Open Shop" title="Open Shop">
                ${ICONS.plus}
              </button>
            </div>
          </div>

          <aside class="hud-surface climber-board" aria-label="Highest Floor Leaderboard">
            <div class="climber-board-head">
              <span>People</span>
              <span>Highest Floor</span>
            </div>
            <div id="hud-climber-body"></div>
          </aside>
        </div>
      </header>

      <nav class="left-rail" id="hud-left-rail" aria-label="Game Menus">
        <button class="rail-btn" id="btn-rail-shop">
          ${ICONS.shop}
          <span>Shop</span>
        </button>
        <button class="rail-btn" id="btn-rail-inv">
          ${ICONS.inventory}
          <span>Inventory</span>
        </button>
        <button class="rail-btn" id="btn-rail-lb">
          ${ICONS.leaderboard}
          <span>Leaderboard</span>
        </button>
        <button class="rail-btn" id="btn-rail-quests">
          ${ICONS.quests}
          <span>Quests</span>
          <span class="quest-pip" id="hud-quest-pip" style="display:none;"></span>
        </button>
      </nav>

      <div class="hud-surface combo-streak-card" id="hud-combo-card" style="display:none;">
        <div class="combo-streak-num" id="hud-combo-num">2x HIT</div>
        <div class="combo-streak-sub" id="hud-combo-sub">Combo Active</div>
        <div class="bar-shell xp-bar-shell">
          <div class="xp-live-fill" id="hud-combo-fill" style="width:100%;background:linear-gradient(90deg,#f59e0b,#fde047);"></div>
        </div>
      </div>

      <div class="hud-surface boss-banner" id="hud-boss-banner" style="display:none;">
        <div class="boss-banner-row">
          <span id="hud-boss-name">Spire Warden</span>
          <span id="hud-boss-hp-nums">340 / 340</span>
        </div>
        <div class="bar-shell hp-bar-shell">
          <div class="hp-live-fill" id="hud-boss-fill" style="width:100%;"></div>
        </div>
      </div>

      <div class="hud-surface player-capsule">
        <div class="portrait-ring">
          <img id="hud-portrait-img" alt="Player Portrait" />
        </div>
        <div class="player-vitals">
          <div class="vitals-top-row">
            <span class="vitals-lv" id="hud-vitals-lv">Lv. 1</span>
            <span class="vitals-hp-nums" id="hud-vitals-hp-nums">100 / 100</span>
          </div>
          <div class="bar-shell hp-bar-shell">
            <div class="hp-ghost-fill" id="hud-hp-ghost" style="width:100%;"></div>
            <div class="hp-live-fill" id="hud-hp-live" style="width:100%;"></div>
          </div>
          <div class="bar-shell xp-bar-shell">
            <div class="xp-live-fill" id="hud-xp-live" style="width:0%;"></div>
          </div>
        </div>
        <button class="capsule-plus-btn" id="btn-vitals-upgrades" aria-label="Open Upgrades" title="Upgrades">
          ${ICONS.plus}
        </button>
      </div>

      <div class="bottom-dock-wrap">
        <div class="interact-chip" id="hud-interact-chip" style="display:none;">
          <span class="keycap">F</span>
          <span id="hud-interact-text">Interact</span>
        </div>
        <div class="hud-surface skill-dock" id="hud-skill-dock"></div>
      </div>
    `;

    this.elFloorHeading = this.hudRoot.querySelector('#hud-floor-heading')!;
    this.elFloorSub = this.hudRoot.querySelector('#hud-floor-sub')!;
    this.elFloorProgWrap = this.hudRoot.querySelector('#hud-floor-prog-wrap')!;
    this.elFloorProgFill = this.hudRoot.querySelector('#hud-floor-prog-fill')!;
    this.elBoonsStrip = this.hudRoot.querySelector('#hud-boons-strip')!;
    this.elHubPlayBtn = this.hudRoot.querySelector('#btn-hub-enter')!;
    this.elBankCoins = this.hudRoot.querySelector('#hud-bank-coins')!;
    this.elRunLoot = this.hudRoot.querySelector('#hud-run-loot')!;
    this.elFpsPill = this.hudRoot.querySelector('#hud-fps-pill')!;
    this.elLeftRail = this.hudRoot.querySelector('#hud-left-rail')!;
    this.elQuestPip = this.hudRoot.querySelector('#hud-quest-pip')!;
    this.elClimberBody = this.hudRoot.querySelector('#hud-climber-body')!;
    this.elComboCard = this.hudRoot.querySelector('#hud-combo-card')!;
    this.elComboNum = this.hudRoot.querySelector('#hud-combo-num')!;
    this.elComboSub = this.hudRoot.querySelector('#hud-combo-sub')!;
    this.elComboFill = this.hudRoot.querySelector('#hud-combo-fill')!;
    this.elPortraitImg = this.hudRoot.querySelector('#hud-portrait-img')!;
    this.elVitalsLv = this.hudRoot.querySelector('#hud-vitals-lv')!;
    this.elVitalsHpNums = this.hudRoot.querySelector('#hud-vitals-hp-nums')!;
    this.elHpGhost = this.hudRoot.querySelector('#hud-hp-ghost')!;
    this.elHpLive = this.hudRoot.querySelector('#hud-hp-live')!;
    this.elXpLive = this.hudRoot.querySelector('#hud-xp-live')!;
    this.elInteractChip = this.hudRoot.querySelector('#hud-interact-chip')!;
    this.elInteractText = this.hudRoot.querySelector('#hud-interact-text')!;
    this.elSkillDock = this.hudRoot.querySelector('#hud-skill-dock')!;
    this.elBossBanner = this.hudRoot.querySelector('#hud-boss-banner')!;
    this.elBossName = this.hudRoot.querySelector('#hud-boss-name')!;
    this.elBossHpNums = this.hudRoot.querySelector('#hud-boss-hp-nums')!;
    this.elBossFill = this.hudRoot.querySelector('#hud-boss-fill')!;

    this.hudRoot.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('mouseenter', () => this.audio.playHover());
    });

    this.hudRoot.querySelector('#btn-hud-pause')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.openModal('pause');
    });
    this.hudRoot.querySelector('#btn-hud-settings')!.addEventListener('click', () => {
      this.audio.playClick();
      this.settingsTab = 'gameplay';
      this.actions.openModal('settings');
    });
    this.hudRoot.querySelector('#btn-hud-controls')!.addEventListener('click', () => {
      this.audio.playClick();
      this.settingsTab = 'controls';
      this.actions.openModal('settings');
    });
    this.elHubPlayBtn.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.startRun();
    });
    this.hudRoot.querySelector('#btn-coin-shop')!.addEventListener('click', () => {
      this.audio.playClick();
      this.shopTab = 'all';
      this.actions.openModal('shop');
    });
    this.hudRoot.querySelector('#btn-vitals-upgrades')!.addEventListener('click', () => {
      this.audio.playClick();
      this.shopTab = 'upgrades';
      this.actions.openModal('shop');
    });
    this.hudRoot.querySelector('#btn-rail-shop')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.openModal('shop');
    });
    this.hudRoot.querySelector('#btn-rail-inv')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.openModal('inventory');
    });
    this.hudRoot.querySelector('#btn-rail-lb')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.openModal('leaderboard');
    });
    this.hudRoot.querySelector('#btn-rail-quests')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.openModal('quests');
    });
  }

  pushToast(
    text: string,
    tone: 'info' | 'success' | 'warning' | 'danger' = 'info',
    durationMs = 2600
  ): void {
    const el = document.createElement('div');
    el.className = `toast-pill ${tone}`;
    el.textContent = text;
    this.toastStack.appendChild(el);
    window.setTimeout(() => el.remove(), durationMs);
  }

  updateHud(snap: HudSnapshot, pendingBoons: RunBoonDefinition[] = []): void {
    this.activeBoonChoices = pendingBoons;
    const save = this.saveManager.getData();
    const skin = SKINS[save.equippedSkin] ?? SKINS.shadow_runner;

    // 1. Top-Center Floor Plaque & Progress Bar
    if (snap.mode === 'run') {
      this.elFloorHeading.textContent = `FLOOR ${snap.floor}`;
      if (snap.portalUnlocked) {
        this.elFloorSub.textContent = 'Ascent Gate Open — Reach the top!';
        this.elFloorSub.className = 'floor-plaque-sub gate-ready';
      } else {
        this.elFloorSub.textContent = `${snap.objectiveText} (${snap.objectiveProgress})`;
        this.elFloorSub.className = 'floor-plaque-sub';
      }
      this.elFloorProgWrap.style.display = 'block';
      this.elFloorProgFill.style.width = `${Math.round(snap.floorProgressRatio * 100)}%`;
      this.elFloorProgFill.className = `floor-progress-fill${snap.portalUnlocked ? ' ready' : ''}`;

      this.elHubPlayBtn.style.display = 'none';
      this.elRunLoot.style.display = 'block';
      this.elRunLoot.textContent = `+${snap.runCoins.toLocaleString()} Run`;

      // Active run blessings strip
      const boonSig = JSON.stringify(snap.boonCounts);
      if (boonSig !== this.lastBoonsSig) {
        this.lastBoonsSig = boonSig;
        const pills: string[] = [];
        for (const [bId, cnt] of Object.entries(snap.boonCounts)) {
          if (cnt <= 0) continue;
          const bDef = RUN_BOONS.find((b) => b.id === bId);
          if (!bDef) continue;
          pills.push(`
            <span class="boon-mini-pill" style="border-color:${bDef.borderColor};" title="${bDef.name}">
              ${getIconSvg(bDef.icon)}
              <span>${cnt > 1 ? `x${cnt}` : bDef.name}</span>
            </span>
          `);
        }
        this.elBoonsStrip.innerHTML = pills.join('');
      }
    } else {
      this.elFloorHeading.textContent = 'CLOUDSPIRE';
      this.elFloorSub.textContent =
        save.stats.highestFloor > 0
          ? `Sky Sanctuary · Best Floor ${save.stats.highestFloor}`
          : 'Sky Sanctuary';
      this.elFloorSub.className = 'floor-plaque-sub';
      this.elFloorProgWrap.style.display = 'none';
      if (this.lastBoonsSig !== '') {
        this.lastBoonsSig = '';
        this.elBoonsStrip.innerHTML = '';
      }
      this.elHubPlayBtn.style.display = snap.modal === 'none' ? 'inline-flex' : 'none';
      this.elRunLoot.style.display = 'none';
    }

    this.elLeftRail.className =
      snap.mode === 'run' && snap.pointerLocked ? 'left-rail combat-dim' : 'left-rail';

    this.elBankCoins.textContent = save.currency.toLocaleString();

    if (snap.showFps) {
      this.elFpsPill.style.display = 'block';
      this.elFpsPill.textContent = `${Math.round(snap.fps)} FPS`;
    } else {
      this.elFpsPill.style.display = 'none';
    }

    // 2. Combo Streak HUD
    if (snap.comboStreak >= 2 && snap.modal === 'none') {
      this.elComboCard.style.display = 'block';
      this.elComboNum.textContent = `${snap.comboStreak}x HIT`;
      const dmgBonusPct = Math.min(25, Math.floor(snap.comboStreak / 4) * 5);
      this.elComboSub.textContent =
        dmgBonusPct > 0 ? `+${dmgBonusPct}% Slash DMG` : 'Combo Streak';
      this.elComboFill.style.width = `${Math.round(snap.comboTimerRatio * 100)}%`;
    } else {
      this.elComboCard.style.display = 'none';
    }

    // 3. Quest Pip
    const claimable = QUESTS.some(
      (q) => !save.claimedQuests.includes(q.id) && (save.stats[q.statKey] ?? 0) >= q.target
    );
    this.elQuestPip.style.display = claimable ? 'block' : 'none';

    // 4. 3D Portrait Snapshot
    const portraitUrl = this.preview3D.getPortraitDataUrl(skin);
    const portSig = `${skin.id}|${portraitUrl.length}`;
    if (portSig !== this.lastPortraitSig && portraitUrl) {
      this.lastPortraitSig = portSig;
      this.elPortraitImg.src = portraitUrl;
    }

    // 5. Climber Leaderboard
    const bestOrLive = Math.max(save.stats.highestFloor, snap.floor);
    const climberSig = `${bestOrLive}|${skin.id}|${portraitUrl.length}`;
    if (climberSig !== this.lastClimberSig) {
      this.lastClimberSig = climberSig;
      const all = [
        ...RIVAL_CLIMBERS.map((r) => ({ name: r.name, floor: r.floor, isYou: false })),
        { name: 'You', floor: bestOrLive, isYou: true },
      ].sort((a, b) => b.floor - a.floor);

      let visible = all.slice(0, 6);
      if (!visible.some((r) => r.isYou)) {
        visible = [...all.slice(0, 5), { name: 'You', floor: bestOrLive, isYou: true }];
      }

      this.elClimberBody.innerHTML = visible
        .map(
          (r) => `
          <div class="climber-row${r.isYou ? ' is-you' : ''}">
            <span class="climber-row-name">
              ${
                r.isYou && portraitUrl
                  ? `<img class="climber-mini-avatar" src="${portraitUrl}" alt="" />`
                  : ''
              }
              <span>${r.name}</span>
            </span>
            <span>${r.floor}</span>
          </div>
        `
        )
        .join('');
    }

    // 6. Player Vitals Capsule
    this.elVitalsLv.innerHTML =
      snap.extraLives > 0 ? `Lv. ${snap.level} ${ICONS.crown}` : `Lv. ${snap.level}`;

    const shieldSuffix = snap.shield > 0 ? ` +${Math.ceil(snap.shield)}` : '';
    this.elVitalsHpNums.textContent = `${Math.ceil(snap.hp)} / ${snap.maxHp}${shieldSuffix}`;

    const hpPct = `${Math.max(0, Math.min(100, (snap.hp / Math.max(1, snap.maxHp)) * 100)).toFixed(1)}%`;
    this.elHpLive.style.width = hpPct;
    this.elHpGhost.style.width = hpPct;

    const xpPct = `${Math.max(0, Math.min(100, (snap.xp / Math.max(1, snap.xpToNext)) * 100)).toFixed(1)}%`;
    this.elXpLive.style.width = xpPct;

    // 7. Boss Bar
    if (snap.boss) {
      this.elBossBanner.style.display = 'block';
      this.elBossName.textContent = snap.boss.name;
      this.elBossHpNums.textContent = `${Math.ceil(snap.boss.hp)} / ${snap.boss.maxHp}`;
      this.elBossFill.style.width = `${Math.max(
        0,
        Math.min(100, (snap.boss.hp / Math.max(1, snap.boss.maxHp)) * 100)
      ).toFixed(1)}%`;
    } else {
      this.elBossBanner.style.display = 'none';
    }

    // 8. Interact Prompt Chip
    if (snap.interactPrompt && snap.modal === 'none') {
      this.elInteractChip.style.display = 'inline-flex';
      this.elInteractText.textContent = snap.interactPrompt;
    } else {
      this.elInteractChip.style.display = 'none';
    }

    // 9. Tactical Skill Dock
    this.updateSkillDock(snap, save.equippedWeapon);

    // 10. Screen-Stack Modal Sync & Focus Restoration
    const modalKey =
      snap.mode === 'victory' || snap.mode === 'defeat' ? `summary:${snap.mode}` : snap.modal;

    if (modalKey !== this.lastModalKey || snap.modalStackDepth !== this.lastStackDepth) {
      const pushedDeeper = snap.modalStackDepth > this.lastStackDepth;
      const poppedUp = snap.modalStackDepth < this.lastStackDepth;

      if (pushedDeeper && document.activeElement instanceof HTMLElement && document.activeElement.id) {
        this.focusReturnStack.push(`#${document.activeElement.id}`);
      }

      this.preview3D.unmountShowcase();
      this.lastModalKey = modalKey;
      this.lastStackDepth = snap.modalStackDepth;

      // Inhibit background HUD focus while modal is open (game-ui-ux focus trap)
      this.hudRoot.inert = modalKey !== 'none';

      let restoreSelector: string | undefined;
      if (poppedUp) {
        restoreSelector = this.focusReturnStack.pop();
      } else if (modalKey === 'none') {
        this.focusReturnStack = [];
      }

      this.mountModal(snap, pendingBoons, restoreSelector);
    }
  }

  private updateSkillDock(snap: HudSnapshot, equippedWeaponId: string): void {
    const wep = WEAPONS[equippedWeaponId] ?? WEAPONS.skyblade;
    const sig = `${wep.id}|${snap.abilities.map((a) => a.id).join(',')}|dj:${snap.hasDoubleJump}|t:${snap.tonicsLeft}`;
    if (sig !== this.lastAbilitySig) {
      this.lastAbilitySig = sig;
      const shortWepName = wep.name.split(' ').pop() ?? 'Slash';

      this.elSkillDock.innerHTML = `
        <button class="dock-slot" data-dock="primary" style="--slot-glow:${hexWithAlpha(wep.accentColor, 0.28)};" title="${wep.name} Combo (Left Click or J)">
          <span class="dock-slot-key">LMB</span>
          <span class="dock-slot-glow"></span>
          <span class="dock-slot-icon">${ICONS.sword}</span>
          <span class="dock-slot-name">${shortWepName}</span>
        </button>
        ${snap.abilities
          .map(
            (ab, i) => `
          <button class="dock-slot" data-dock="skill-${i}" style="--slot-glow:${hexWithAlpha(ab.accentColor, 0.28)};" title="${ab.name} (${ab.keyHint})">
            <span class="dock-slot-key">${ab.keyHint}</span>
            <span class="dock-slot-glow"></span>
            <span class="dock-slot-icon">${getIconSvg(ab.icon)}</span>
            <span class="dock-slot-name" id="dock-lbl-${i}">${ab.name.split(' ')[0]}</span>
            <div class="dock-cd-veil" id="dock-cd-${i}" style="display:none;">
              <div class="dock-cd-fill" id="dock-cd-fill-${i}" style="height:0%;"></div>
              <span class="dock-cd-num" id="dock-cd-num-${i}">0.0</span>
            </div>
          </button>
        `
          )
          .join('')}
        <div class="dock-slot${snap.hasDoubleJump ? '' : ' passive-locked'}" style="--slot-glow:rgba(96,165,250,0.24);" title="${snap.hasDoubleJump ? 'Sky Wings Double Jump Active' : 'Jump (Unlock Sky Wings in Shop for Double Jump)'}">
          <span class="dock-slot-key">SPC</span>
          <span class="dock-slot-glow"></span>
          <span class="dock-slot-icon">${ICONS.wings}</span>
          <span class="dock-slot-name">${snap.hasDoubleJump ? 'Wings' : 'Jump'}</span>
        </div>
        <button class="dock-slot" data-dock="tonic" style="--slot-glow:rgba(52,211,153,0.25);" title="Sky Tonic (+45 HP, Key C)">
          <span class="dock-slot-key">C</span>
          <span class="dock-slot-glow"></span>
          <span class="dock-slot-icon">${ICONS.tonic}</span>
          <span class="dock-slot-name">x${snap.tonicsLeft}</span>
        </button>
      `;

      this.elSkillDock.querySelectorAll<HTMLButtonElement>('button[data-dock]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.dock;
          if (action === 'skill-0') this.actions.triggerAbilitySlot(0);
          else if (action === 'skill-1') this.actions.triggerAbilitySlot(1);
          else if (action === 'tonic') this.actions.useConsumable();
        });
      });
    }

    snap.abilities.forEach((ab, i) => {
      const veil = this.elSkillDock.querySelector<HTMLElement>(`#dock-cd-${i}`);
      const fill = this.elSkillDock.querySelector<HTMLElement>(`#dock-cd-fill-${i}`);
      const num = this.elSkillDock.querySelector<HTMLElement>(`#dock-cd-num-${i}`);
      const lbl = this.elSkillDock.querySelector<HTMLElement>(`#dock-lbl-${i}`);
      if (!veil || !fill || !num || !lbl) return;

      if (ab.cooldownRemaining > 0.05 && ab.cooldownTotal > 0) {
        const pct = Math.min(100, (ab.cooldownRemaining / ab.cooldownTotal) * 100);
        veil.style.display = 'flex';
        fill.style.height = `${pct.toFixed(0)}%`;
        num.textContent = ab.cooldownRemaining.toFixed(1);
        lbl.style.visibility = 'hidden';
      } else {
        veil.style.display = 'none';
        lbl.style.visibility = 'visible';
      }
    });
  }

  private refreshOpenModalContent(): void {
    if (this.lastModalKey === 'shop') {
      this.updateShopGridAndShowcase();
    } else if (this.lastModalKey === 'inventory') {
      this.updateInventoryContent();
    } else if (this.lastModalKey === 'quests') {
      this.renderQuestsModal();
    } else if (this.lastModalKey === 'settings') {
      const coinBadge = this.modalRoot.querySelector('#dbg-coin-readout');
      if (coinBadge) {
        coinBadge.textContent = `${this.saveManager.getData().currency.toLocaleString()} Coins`;
      }
    }
  }

  private focusModalInitial(preferredSelector?: string): void {
    requestAnimationFrame(() => {
      if (preferredSelector) {
        const prev = document.querySelector<HTMLElement>(preferredSelector);
        if (prev && prev.offsetParent !== null) {
          prev.focus();
          return;
        }
      }
      const first = this.modalRoot.querySelector<HTMLElement>(
        'button:not(.close-circle-btn):not(:disabled)'
      );
      first?.focus();
    });
  }

  private mountModal(
    snap: HudSnapshot,
    pendingBoons: RunBoonDefinition[],
    restoreSelector?: string
  ): void {
    if (snap.mode === 'victory' || snap.mode === 'defeat') {
      this.renderSummaryModal(snap.mode === 'victory');
      this.focusModalInitial();
      return;
    }
    if (snap.modal === 'none') {
      this.modalRoot.innerHTML = '';
      if (restoreSelector) {
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(restoreSelector)?.focus();
        });
      }
      return;
    }

    if (snap.modal === 'pause') this.renderPauseModal(snap.mode === 'run');
    else if (snap.modal === 'shop') this.renderShopShell();
    else if (snap.modal === 'inventory') this.renderInventoryShell();
    else if (snap.modal === 'settings') this.renderSettingsModal();
    else if (snap.modal === 'leaderboard') this.renderLeaderboardModal();
    else if (snap.modal === 'quests') this.renderQuestsModal();
    else if (snap.modal === 'levelup') this.renderBoonModal(pendingBoons);
    else if (snap.modal === 'checkpoint') this.renderCheckpointModal(snap.floor);
    else if (snap.modal === 'reset_confirm') this.renderResetConfirmModal();
    else if (snap.modal === 'dialogue' && snap.dialogue) this.renderDialogueModal(snap.dialogue);

    this.focusModalInitial(restoreSelector);
  }

  /* =========================================================
     NPC DIALOGUE MODAL (3D Blender NPC Portrait + Action CTA)
     ========================================================= */
  private renderDialogueModal(dlg: NpcDialogueState): void {
    const npcPortrait = this.preview3D.getNpcPortraitUrl(dlg.npcId);
    const ctaLabel =
      dlg.action === 'shop'
        ? 'Browse Sky Bazaar'
        : dlg.action === 'inventory'
          ? 'Open Armory Loadout'
          : dlg.action === 'start_run'
            ? 'Enter Cloudspire Run'
            : null;

    this.modalRoot.innerHTML = `
      <div class="modal-scrim" style="align-items:flex-end;background:rgba(8,12,24,0.34);backdrop-filter:blur(2px);">
        <div class="modal-frame npc-dialogue-card" role="dialog" aria-label="${dlg.npcName}">
          <div class="npc-portrait-frame">
            ${npcPortrait ? `<img src="${npcPortrait}" alt="${dlg.npcName}" />` : ICONS.spireLogo}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div>
                <span style="font-size:1.12rem;font-weight:700;">${dlg.npcName}</span>
                <span style="margin-left:8px;font-size:0.74rem;font-weight:700;color:#fde68a;">${dlg.npcRole}</span>
              </div>
              <button class="close-circle-btn" id="btn-dlg-close" aria-label="Close Dialogue">${ICONS.close}</button>
            </div>
            <div style="font-size:0.86rem;color:var(--ink-secondary);line-height:1.45;">
              ${dlg.lines.map((l) => `<p style="margin:0 0 5px;">${l}</p>`).join('')}
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:2px;">
              ${
                ctaLabel
                  ? `<button class="game-btn periwinkle" style="width:auto;padding:8px 18px;" id="btn-dlg-cta">${ctaLabel}</button>`
                  : ''
              }
              <button class="game-btn slate" style="width:auto;padding:8px 16px;" id="btn-dlg-bye">Farewell</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeFn = () => {
      this.audio.playClick();
      this.actions.popModal();
    };
    this.modalRoot.querySelector('#btn-dlg-close')!.addEventListener('click', closeFn);
    this.modalRoot.querySelector('#btn-dlg-bye')!.addEventListener('click', closeFn);
    this.modalRoot.querySelector('#btn-dlg-cta')?.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.popModal();
      if (dlg.action === 'shop') this.actions.openModal('shop');
      else if (dlg.action === 'inventory') this.actions.openModal('inventory');
      else if (dlg.action === 'start_run') this.actions.startRun();
    });
  }

  /* =========================================================
     PAUSE MODAL
     ========================================================= */
  private renderPauseModal(inRun: boolean): void {
    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame narrow" role="dialog" aria-label="Paused">
          <div class="center-dialog-body">
            <h2 style="margin:0 0 6px;font-size:1.65rem;letter-spacing:0.04em;">PAUSED</h2>
            <p style="margin:0 0 8px;color:var(--ink-secondary);font-size:0.85rem;">
              ${inRun ? 'Tower ascent paused.' : 'Sky Sanctuary Hub'}
            </p>
            <button class="game-btn periwinkle" id="btn-p-resume">
              ${ICONS.play}
              <span>Resume</span>
            </button>
            ${
              !inRun
                ? `<button class="game-btn ivory" id="btn-p-enter">${ICONS.upArrow}<span>Enter Tower</span></button>`
                : ''
            }
            <button class="game-btn slate" id="btn-p-settings">
              ${ICONS.settings}
              <span>Settings</span>
            </button>
            ${
              inRun
                ? `<button class="game-btn slate" id="btn-p-leave">${ICONS.leave}<span>Leave Run</span></button>`
                : `<button class="game-btn slate" id="btn-p-shop">${ICONS.shop}<span>Open Shop</span></button>`
            }
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-p-resume')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.closeAllModals();
    });
    this.modalRoot.querySelector('#btn-p-enter')?.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.startRun();
    });
    this.modalRoot.querySelector('#btn-p-settings')!.addEventListener('click', () => {
      this.audio.playClick();
      this.settingsTab = 'gameplay';
      this.actions.openModal('settings');
    });
    this.modalRoot.querySelector('#btn-p-leave')?.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.returnToHub();
    });
    this.modalRoot.querySelector('#btn-p-shop')?.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.openModal('shop');
    });
  }

  /* =========================================================
     SHOP MODAL (Weapons + Skills + Upgrades + Skins + Live 3D Turntable)
     ========================================================= */
  private renderShopShell(): void {
    const save = this.saveManager.getData();
    this.previewSkinId = save.equippedSkin;
    this.previewWeaponId = save.equippedWeapon;

    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame" role="dialog" aria-label="Shop">
          <div class="modal-head">
            <div class="modal-heading">${ICONS.shop}<span>Shop</span></div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="hud-surface coin-capsule" style="padding:4px 12px 4px 8px;">
                <span class="coin-capsule-icon">${ICONS.coin}</span>
                <span id="shop-coin-balance">${save.currency.toLocaleString()}</span>
              </div>
              <button class="close-circle-btn" id="btn-modal-close" aria-label="Close Shop">${ICONS.close}</button>
            </div>
          </div>

          <div class="filter-pills" id="shop-tabs"></div>

          <div class="shop-layout">
            <div class="shop-grid" id="shop-cards-grid"></div>

            <div class="turntable-stage">
              <div class="turntable-name" id="shop-stage-name">Shadow Vanguard</div>
              <div class="turntable-viewport" id="shop-3d-viewport" title="Drag to rotate 3D model"></div>
              <div style="width:100%;" id="shop-stage-footer"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-modal-close')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.popModal();
    });

    const viewport = this.modalRoot.querySelector<HTMLElement>('#shop-3d-viewport')!;
    const initialSkin = SKINS[save.equippedSkin] ?? SKINS.shadow_runner;
    const hasWings = save.ownedSkills.includes('double_jump');
    this.preview3D.mountShowcase(viewport, initialSkin, save.equippedWeapon, hasWings);

    this.updateShopGridAndShowcase();
  }

  private updateShopStagePreview(mode: 'skin' | 'weapon', id: string): void {
    const save = this.saveManager.getData();
    const hasWings = save.ownedSkills.includes('double_jump');

    if (mode === 'skin') {
      this.previewSkinId = id;
    } else {
      this.previewWeaponId = id;
    }

    const skin = SKINS[this.previewSkinId ?? save.equippedSkin] ?? SKINS.shadow_runner;
    const wepId = this.previewWeaponId ?? save.equippedWeapon;
    const wep = WEAPONS[wepId] ?? WEAPONS.skyblade;

    this.preview3D.setPreviewLoadout(skin, wep.id, hasWings);

    const nameEl = this.modalRoot.querySelector('#shop-stage-name');
    const footerEl = this.modalRoot.querySelector('#shop-stage-footer');
    if (!nameEl || !footerEl) return;

    if (mode === 'weapon') {
      nameEl.textContent = wep.name;
      const owned = save.ownedWeapons.includes(wep.id);
      const equipped = save.equippedWeapon === wep.id;
      if (equipped) {
        footerEl.innerHTML = `<button class="game-btn equipped" disabled>${ICONS.check}<span>Equipped</span></button>`;
      } else if (owned) {
        footerEl.innerHTML = `<button class="game-btn ivory" id="btn-stage-act">Equip Weapon</button>`;
        footerEl.querySelector('#btn-stage-act')?.addEventListener('click', () => {
          this.audio.playClick();
          this.progression.equipWeapon(wep.id);
        });
      } else {
        const afford = save.currency >= wep.price;
        footerEl.innerHTML = `<button class="game-btn ivory" id="btn-stage-act" ${afford ? '' : 'disabled'}>${
          afford ? `Buy · ${wep.price}` : `${wep.price} Coins`
        }</button>`;
        footerEl.querySelector('#btn-stage-act')?.addEventListener('click', () => {
          const res = this.progression.buyWeapon(wep.id);
          res.ok ? this.audio.playBuy() : this.audio.playError();
        });
      }
      return;
    }

    nameEl.textContent = skin.name;
    const owned = save.ownedSkins.includes(skin.id);
    const equipped = save.equippedSkin === skin.id;

    if (equipped) {
      footerEl.innerHTML = `<button class="game-btn equipped" disabled>${ICONS.check}<span>Equipped</span></button>`;
    } else if (owned) {
      footerEl.innerHTML = `<button class="game-btn ivory" id="btn-stage-act">Equip Skin</button>`;
      footerEl.querySelector('#btn-stage-act')?.addEventListener('click', () => {
        this.audio.playClick();
        this.progression.equipSkin(skin.id);
      });
    } else {
      const canAfford = save.currency >= skin.price;
      footerEl.innerHTML = `<button class="game-btn ivory" id="btn-stage-act" ${
        canAfford ? '' : 'disabled'
      }>${canAfford ? `Buy · ${skin.price}` : `${skin.price} Coins`}</button>`;
      footerEl.querySelector('#btn-stage-act')?.addEventListener('click', () => {
        const res = this.progression.buySkin(skin.id);
        res.ok ? this.audio.playBuy() : this.audio.playError();
      });
    }
  }

  private updateShopGridAndShowcase(): void {
    const save = this.saveManager.getData();
    const coinEl = this.modalRoot.querySelector('#shop-coin-balance');
    if (coinEl) coinEl.textContent = save.currency.toLocaleString();

    const tabsEl = this.modalRoot.querySelector('#shop-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = (['all', 'weapons', 'skills', 'upgrades', 'skins'] as ShopTab[])
        .map(
          (t) => `
          <button class="filter-pill${this.shopTab === t ? ' active' : ''}" data-shop-tab="${t}">
            ${t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        `
        )
        .join('');

      tabsEl.querySelectorAll<HTMLButtonElement>('[data-shop-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.audio.playClick();
          this.shopTab = btn.dataset.shopTab as ShopTab;
          this.updateShopGridAndShowcase();
        });
      });
    }

    const cards: string[] = [];

    if (this.shopTab === 'all' || this.shopTab === 'weapons') {
      for (const wep of WEAPON_LIST) {
        const owned = save.ownedWeapons.includes(wep.id);
        const equipped = save.equippedWeapon === wep.id;
        const afford = save.currency >= wep.price;
        const wepThumb = this.preview3D.getWeaponThumbnailUrl(wep.id);

        let actionBtn = '';
        if (equipped) {
          actionBtn = `<button class="game-btn equipped" disabled>${ICONS.check}<span>Equipped</span></button>`;
        } else if (owned) {
          actionBtn = `<button class="game-btn ivory" data-eq-weapon="${wep.id}">Equip</button>`;
        } else {
          actionBtn = `<button class="game-btn ivory" data-buy-weapon="${wep.id}" ${
            afford ? '' : 'disabled'
          }>${afford ? 'Buy' : `Need ${wep.price}`}</button>`;
        }

        cards.push(`
          <div class="item-card" data-hover-weapon="${wep.id}" style="--item-glow:${hexWithAlpha(wep.accentColor, 0.35)};">
            <div class="item-icon-stage">
              <div class="item-icon-halo"></div>
              ${wepThumb ? `<img class="skin-thumb" src="${wepThumb}" alt="${wep.name}" />` : ICONS.sword}
            </div>
            <div class="item-title">${wep.name}</div>
            <div class="item-desc">${wep.description}</div>
            <div class="item-price-row">${ICONS.coin}<span>${owned ? 'Owned' : wep.price}</span></div>
            ${actionBtn}
          </div>
        `);
      }
    }

    if (this.shopTab === 'all' || this.shopTab === 'skills') {
      for (const sk of SKILL_LIST) {
        const owned = save.ownedSkills.includes(sk.id);
        const equipped = sk.kind === 'mobility' ? owned : save.equippedSkills.includes(sk.id);
        const canAfford = save.currency >= sk.price;

        let actionBtn = '';
        if (equipped && sk.kind === 'active') {
          actionBtn = `<button class="game-btn equipped" data-toggle-skill="${sk.id}" title="Click to unequip">${ICONS.check}<span>Unequip</span></button>`;
        } else if (equipped) {
          actionBtn = `<button class="game-btn equipped" disabled>${ICONS.check}<span>Active</span></button>`;
        } else if (owned) {
          actionBtn = `<button class="game-btn ivory" data-toggle-skill="${sk.id}">Equip</button>`;
        } else {
          actionBtn = `<button class="game-btn ivory" data-buy-skill="${sk.id}" ${
            canAfford ? '' : 'disabled'
          }>${canAfford ? 'Buy' : `Need ${sk.price.toLocaleString()}`}</button>`;
        }

        cards.push(`
          <div class="item-card" style="--item-glow:${hexWithAlpha(sk.accentColor, 0.34)};">
            <div class="item-icon-stage">
              <div class="item-icon-halo"></div>
              ${getIconSvg(sk.icon)}
            </div>
            <div class="item-title">${sk.name}</div>
            <div class="item-desc">${sk.description}</div>
            <div class="item-price-row">${ICONS.coin}<span>${owned ? 'Owned' : sk.price}</span></div>
            ${actionBtn}
          </div>
        `);
      }

      const tonic = CONSUMABLES.sky_tonic;
      const carried = save.consumables.sky_tonic ?? 0;
      const full = carried >= tonic.maxCarry;
      const afford = save.currency >= tonic.price;
      cards.push(`
        <div class="item-card" style="--item-glow:rgba(52,211,153,0.32);">
          <div class="item-icon-stage">
            <div class="item-icon-halo"></div>
            ${ICONS.tonic}
          </div>
          <div class="item-title">${tonic.name} (${carried}/${tonic.maxCarry})</div>
          <div class="item-desc">Restores 45 HP instantly on Key C.</div>
          <div class="item-price-row">${ICONS.coin}<span>${tonic.price}</span></div>
          <button class="game-btn ivory" data-buy-tonic="sky_tonic" ${
            full || !afford ? 'disabled' : ''
          }>${full ? 'Full' : afford ? 'Buy' : `Need ${tonic.price}`}</button>
        </div>
      `);
    }

    if (this.shopTab === 'all' || this.shopTab === 'upgrades') {
      for (const up of UPGRADE_LIST) {
        const lv = save.upgrades[up.id] ?? 0;
        const maxed = lv >= up.maxLevel;
        const price = getUpgradePrice(up, lv);
        const afford = save.currency >= price;

        const pips = Array.from({ length: up.maxLevel }, (_, i) =>
          `<span class="rank-pip${i < lv ? ' filled' : ''}"></span>`
        ).join('');

        cards.push(`
          <div class="item-card" style="--item-glow:${hexWithAlpha(up.accentColor, 0.32)};">
            <div class="item-icon-stage">
              <div class="item-icon-halo"></div>
              ${getIconSvg(up.icon)}
            </div>
            <div class="item-title">${up.name}</div>
            <div class="rank-pips" aria-label="Rank ${lv} of ${up.maxLevel}">${pips}</div>
            <div class="item-desc">${up.description}</div>
            <div class="item-price-row">${ICONS.coin}<span>${maxed ? 'Max' : price}</span></div>
            <button class="game-btn ${maxed ? 'equipped' : 'ivory'}" data-buy-upgrade="${up.id}" ${
              maxed || !afford ? 'disabled' : ''
            }>${maxed ? `${ICONS.check}<span>Maxed</span>` : afford ? 'Upgrade' : `Need ${price}`}</button>
          </div>
        `);
      }
    }

    if (this.shopTab === 'all' || this.shopTab === 'skins') {
      for (const skin of SKIN_LIST) {
        const owned = save.ownedSkins.includes(skin.id);
        const equipped = save.equippedSkin === skin.id;
        const afford = save.currency >= skin.price;
        const skinThumb = this.preview3D.getPortraitDataUrl(skin);

        let actionBtn = '';
        if (equipped) {
          actionBtn = `<button class="game-btn equipped" disabled>${ICONS.check}<span>Equipped</span></button>`;
        } else if (owned) {
          actionBtn = `<button class="game-btn ivory" data-eq-skin="${skin.id}">Equip</button>`;
        } else {
          actionBtn = `<button class="game-btn ivory" data-buy-skin="${skin.id}" ${
            afford ? '' : 'disabled'
          }>${afford ? 'Buy' : `Need ${skin.price}`}</button>`;
        }

        cards.push(`
          <div class="item-card" data-hover-skin="${skin.id}" style="--item-glow:${hexWithAlpha(skin.accentColor, 0.34)};">
            <div class="item-icon-stage">
              <div class="item-icon-halo"></div>
              ${skinThumb ? `<img class="skin-thumb" src="${skinThumb}" alt="${skin.name}" />` : ICONS.crown}
            </div>
            <div class="item-title">${skin.name}</div>
            <div class="item-desc">${skin.description}</div>
            <div class="item-price-row">${ICONS.coin}<span>${owned ? 'Owned' : skin.price}</span></div>
            ${actionBtn}
          </div>
        `);
      }
    }

    const gridEl = this.modalRoot.querySelector('#shop-cards-grid');
    if (gridEl) {
      gridEl.innerHTML = cards.join('');

      gridEl.querySelectorAll<HTMLElement>('[data-hover-skin]').forEach((card) => {
        card.addEventListener('mouseenter', () => {
          this.updateShopStagePreview('skin', card.dataset.hoverSkin!);
        });
      });
      gridEl.querySelectorAll<HTMLElement>('[data-hover-weapon]').forEach((card) => {
        card.addEventListener('mouseenter', () => {
          this.updateShopStagePreview('weapon', card.dataset.hoverWeapon!);
        });
      });

      gridEl.querySelectorAll<HTMLButtonElement>('[data-buy-weapon]').forEach((b) => {
        b.addEventListener('click', () => {
          const id = b.dataset.buyWeapon!;
          this.previewWeaponId = id;
          const res = this.progression.buyWeapon(id);
          res.ok ? this.audio.playBuy() : this.audio.playError();
        });
      });
      gridEl.querySelectorAll<HTMLButtonElement>('[data-eq-weapon]').forEach((b) => {
        b.addEventListener('click', () => {
          const id = b.dataset.eqWeapon!;
          this.previewWeaponId = id;
          this.audio.playClick();
          this.progression.equipWeapon(id);
        });
      });
      gridEl.querySelectorAll<HTMLButtonElement>('[data-buy-skill]').forEach((b) => {
        b.addEventListener('click', () => {
          const res = this.progression.buySkill(b.dataset.buySkill!);
          res.ok ? this.audio.playBuy() : this.audio.playError();
        });
      });
      gridEl.querySelectorAll<HTMLButtonElement>('[data-toggle-skill]').forEach((b) => {
        b.addEventListener('click', () => {
          this.audio.playClick();
          this.progression.toggleActiveSkill(b.dataset.toggleSkill!);
        });
      });
      gridEl.querySelectorAll<HTMLButtonElement>('[data-buy-tonic]').forEach((b) => {
        b.addEventListener('click', () => {
          const res = this.progression.buyConsumable('sky_tonic');
          res.ok ? this.audio.playBuy() : this.audio.playError();
        });
      });
      gridEl.querySelectorAll<HTMLButtonElement>('[data-buy-upgrade]').forEach((b) => {
        b.addEventListener('click', () => {
          const res = this.progression.buyUpgrade(b.dataset.buyUpgrade!);
          res.ok ? this.audio.playBuy() : this.audio.playError();
        });
      });
      gridEl.querySelectorAll<HTMLButtonElement>('[data-buy-skin]').forEach((b) => {
        b.addEventListener('click', () => {
          const id = b.dataset.buySkin!;
          this.previewSkinId = id;
          const res = this.progression.buySkin(id);
          res.ok ? this.audio.playBuy() : this.audio.playError();
        });
      });
      gridEl.querySelectorAll<HTMLButtonElement>('[data-eq-skin]').forEach((b) => {
        b.addEventListener('click', () => {
          const id = b.dataset.eqSkin!;
          this.previewSkinId = id;
          this.audio.playClick();
          this.progression.equipSkin(id);
        });
      });
    }

    if (this.shopTab === 'weapons') {
      this.updateShopStagePreview('weapon', this.previewWeaponId ?? save.equippedWeapon);
    } else {
      this.updateShopStagePreview('skin', this.previewSkinId ?? save.equippedSkin);
    }
  }

  /* =========================================================
     INVENTORY / LOADOUT MODAL
     ========================================================= */
  private renderInventoryShell(): void {
    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame" style="width:min(780px,95vw);" role="dialog" aria-label="Inventory">
          <div class="modal-head">
            <div class="modal-heading">${ICONS.inventory}<span>Inventory & Loadout</span></div>
            <button class="close-circle-btn" id="btn-modal-close" aria-label="Close Inventory">${ICONS.close}</button>
          </div>
          <div class="filter-pills" id="inv-tabs"></div>
          <div class="inv-layout">
            <div class="collector-grid" id="inv-tiles"></div>
            <div class="loadout-inspector" id="inv-inspector"></div>
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-modal-close')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.popModal();
    });

    this.updateInventoryContent();
  }

  private updateInventoryContent(): void {
    const save = this.saveManager.getData();
    const tabsEl = this.modalRoot.querySelector('#inv-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = (['all', 'weapons', 'skills', 'skins', 'upgrades'] as InvTab[])
        .map(
          (t) => `
          <button class="filter-pill${this.invTab === t ? ' active' : ''}" data-inv-tab="${t}">
            ${t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        `
        )
        .join('');

      tabsEl.querySelectorAll<HTMLButtonElement>('[data-inv-tab]').forEach((b) => {
        b.addEventListener('click', () => {
          this.audio.playClick();
          this.invTab = b.dataset.invTab as InvTab;
          this.updateInventoryContent();
        });
      });
    }

    interface TileItem {
      key: string;
      kind: 'weapon' | 'skill' | 'skin' | 'upgrade';
      id: string;
      name: string;
      desc: string;
      iconSvg: string;
      chip: string;
    }

    const items: TileItem[] = [];

    if (this.invTab === 'all' || this.invTab === 'weapons') {
      for (const wepId of save.ownedWeapons) {
        const wep = WEAPONS[wepId];
        if (!wep) continue;
        const thumb = this.preview3D.getWeaponThumbnailUrl(wep.id);
        items.push({
          key: `weapon:${wep.id}`,
          kind: 'weapon',
          id: wep.id,
          name: wep.name,
          desc: wep.description,
          iconSvg: thumb ? `<img class="skin-thumb" src="${thumb}" alt="${wep.name}" />` : ICONS.sword,
          chip: save.equippedWeapon === wep.id ? 'LMB' : '',
        });
      }
    }

    if (this.invTab === 'all' || this.invTab === 'skills') {
      for (const skId of save.ownedSkills) {
        const sk = SKILLS[skId];
        if (!sk) continue;
        const slot = save.equippedSkills.indexOf(skId);
        items.push({
          key: `skill:${sk.id}`,
          kind: 'skill',
          id: sk.id,
          name: sk.name,
          desc: sk.description,
          iconSvg: getIconSvg(sk.icon),
          chip: sk.kind === 'mobility' ? 'ON' : slot === 0 ? 'Q' : slot === 1 ? 'E' : '',
        });
      }
    }

    if (this.invTab === 'all' || this.invTab === 'skins') {
      for (const skinId of save.ownedSkins) {
        const sk = SKINS[skinId];
        if (!sk) continue;
        const thumb = this.preview3D.getPortraitDataUrl(sk);
        items.push({
          key: `skin:${sk.id}`,
          kind: 'skin',
          id: sk.id,
          name: sk.name,
          desc: sk.description,
          iconSvg: thumb ? `<img class="skin-thumb" src="${thumb}" alt="${sk.name}" />` : ICONS.crown,
          chip: save.equippedSkin === sk.id ? 'ON' : '',
        });
      }
    }

    if (this.invTab === 'all' || this.invTab === 'upgrades') {
      for (const up of UPGRADE_LIST) {
        const lv = save.upgrades[up.id] ?? 0;
        if (lv <= 0 && this.invTab === 'all') continue;
        items.push({
          key: `upgrade:${up.id}`,
          kind: 'upgrade',
          id: up.id,
          name: up.name,
          desc: `${up.description} (Rank ${lv}/${up.maxLevel})`,
          iconSvg: getIconSvg(up.icon),
          chip: `${lv}/${up.maxLevel}`,
        });
      }
    }

    const sel = items.find((i) => i.key === this.selectedInvKey) ?? items[0];
    if (sel) this.selectedInvKey = sel.key;

    const tilesEl = this.modalRoot.querySelector('#inv-tiles');
    if (tilesEl) {
      tilesEl.innerHTML = items
        .map(
          (it) => `
          <button class="collector-tile${sel?.key === it.key ? ' selected' : ''}" data-tile-key="${it.key}" title="${it.name}">
            ${it.chip ? `<span class="tile-slot-chip">${it.chip}</span>` : ''}
            ${it.iconSvg}
          </button>
        `
        )
        .join('');

      tilesEl.querySelectorAll<HTMLButtonElement>('[data-tile-key]').forEach((b) => {
        b.addEventListener('click', () => {
          this.audio.playClick();
          const key = b.dataset.tileKey!;
          if (key.startsWith('skill:')) {
            const skId = key.slice(6);
            if (SKILLS[skId]?.kind === 'active' && this.selectedInvKey === key) {
              this.progression.toggleActiveSkill(skId);
              return;
            }
          }
          this.selectedInvKey = key;
          this.updateInventoryContent();
        });
      });
    }

    const insp = this.modalRoot.querySelector('#inv-inspector');
    if (!insp) return;

    let actionControls = '';
    if (sel?.kind === 'weapon') {
      const isEq = save.equippedWeapon === sel.id;
      actionControls = isEq
        ? `<button class="game-btn equipped" disabled>${ICONS.check}<span>Equipped</span></button>`
        : `<button class="game-btn periwinkle" id="btn-inv-wep">Equip Weapon</button>`;
    } else if (sel?.kind === 'skill') {
      const sk = SKILLS[sel.id];
      if (sk.kind === 'active') {
        const isEquipped = save.equippedSkills.includes(sel.id);
        actionControls = `
          <button class="game-btn ${isEquipped ? 'equipped' : 'ivory'}" id="btn-inv-toggle-skill">
            ${isEquipped ? `${ICONS.check}<span>Unequip Skill</span>` : 'Equip Skill'}
          </button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="game-btn periwinkle" id="btn-inv-q">Slot Q</button>
            <button class="game-btn slate" id="btn-inv-e">Slot E</button>
          </div>
        `;
      } else {
        actionControls = `<button class="game-btn equipped" disabled>${ICONS.check}<span>Always Active</span></button>`;
      }
    } else if (sel?.kind === 'skin') {
      const isEq = save.equippedSkin === sel.id;
      actionControls = isEq
        ? `<button class="game-btn equipped" disabled>${ICONS.check}<span>Equipped</span></button>`
        : `<button class="game-btn periwinkle" id="btn-inv-skin">Equip Skin</button>`;
    }

    const wepName = WEAPONS[save.equippedWeapon]?.name ?? 'Aether Skyblade';
    const qName = SKILLS[save.equippedSkills[0]]?.name ?? 'None';
    const eName = SKILLS[save.equippedSkills[1]]?.name ?? 'None';

    insp.innerHTML = `
      ${
        sel
          ? `
        <div style="font-size:1.06rem;font-weight:700;">${sel.name}</div>
        <div style="font-size:0.8rem;color:var(--ink-secondary);line-height:1.4;">${sel.desc}</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">${actionControls}</div>
      `
          : `<div style="color:var(--ink-secondary);font-size:0.84rem;">No items unlocked in this tab yet.</div>`
      }
      <div class="mini-slot-box" style="margin-top:4px;">
        <div style="color:var(--ink-dim);font-size:0.66rem;font-weight:700;">Primary Weapon [LMB]</div>
        <div style="font-weight:700;margin-top:2px;">${wepName}</div>
      </div>
      <div class="loadout-slots-summary">
        <div class="mini-slot-box">
          <div style="color:var(--ink-dim);font-size:0.66rem;font-weight:700;">Slot Q</div>
          <div style="font-weight:700;margin-top:2px;">${qName}</div>
        </div>
        <div class="mini-slot-box">
          <div style="color:var(--ink-dim);font-size:0.66rem;font-weight:700;">Slot E</div>
          <div style="font-weight:700;margin-top:2px;">${eName}</div>
        </div>
      </div>
    `;

    insp.querySelector('#btn-inv-wep')?.addEventListener('click', () => {
      if (sel) {
        this.audio.playClick();
        this.progression.equipWeapon(sel.id);
      }
    });
    insp.querySelector('#btn-inv-toggle-skill')?.addEventListener('click', () => {
      if (sel) {
        this.audio.playClick();
        this.progression.toggleActiveSkill(sel.id);
      }
    });
    insp.querySelector('#btn-inv-q')?.addEventListener('click', () => {
      if (sel) {
        this.audio.playClick();
        this.progression.equipActiveSkill(sel.id, 0);
      }
    });
    insp.querySelector('#btn-inv-e')?.addEventListener('click', () => {
      if (sel) {
        this.audio.playClick();
        this.progression.equipActiveSkill(sel.id, 1);
      }
    });
    insp.querySelector('#btn-inv-skin')?.addEventListener('click', () => {
      if (sel) {
        this.audio.playClick();
        this.progression.equipSkin(sel.id);
      }
    });
  }

  /* =========================================================
     QUESTS & LEADERBOARD MODALS
     ========================================================= */
  private renderQuestsModal(): void {
    const save = this.saveManager.getData();

    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame medium" role="dialog" aria-label="Quests">
          <div class="modal-head">
            <div class="modal-heading">${ICONS.quests}<span>Quests</span></div>
            <button class="close-circle-btn" id="btn-modal-close" aria-label="Close Quests">${ICONS.close}</button>
          </div>
          <div style="padding:14px 20px 20px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;">
            ${QUESTS.map((q) => {
              const prog = Math.min(q.target, save.stats[q.statKey] ?? 0);
              const claimed = save.claimedQuests.includes(q.id);
              const ready = !claimed && prog >= q.target;
              const pct = Math.round((prog / q.target) * 100);
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;background:var(--surface-card);padding:13px 16px;border-radius:14px;border:1px solid rgba(214,228,255,0.12);">
                  <div style="flex:1;">
                    <div style="display:flex;justify-content:space-between;align-items:baseline;">
                      <span style="font-weight:700;font-size:0.95rem;">${q.title}</span>
                      <span style="font-size:0.76rem;color:var(--ink-secondary);font-variant-numeric:tabular-nums;">${prog} / ${q.target}</span>
                    </div>
                    <div style="font-size:0.78rem;color:var(--ink-secondary);margin:3px 0 7px;">${q.description}</div>
                    <div class="bar-shell xp-bar-shell"><div class="xp-live-fill" style="width:${pct}%;"></div></div>
                  </div>
                  <button class="game-btn ${claimed ? 'equipped' : ready ? 'ivory' : 'slate'}" style="width:118px;flex-shrink:0;" data-claim="${q.id}" ${
                    ready ? '' : 'disabled'
                  }>
                    ${claimed ? `${ICONS.check}<span>Claimed</span>` : `${ICONS.coin}<span>+${q.rewardCoins}</span>`}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-modal-close')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.popModal();
    });
    this.modalRoot.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((b) => {
      b.addEventListener('click', () => {
        const res = this.progression.claimQuest(b.dataset.claim!);
        res.ok ? this.audio.playBuy() : this.audio.playError();
      });
    });
  }

  private renderLeaderboardModal(): void {
    const save = this.saveManager.getData();
    const skin = SKINS[save.equippedSkin] ?? SKINS.shadow_runner;
    const portrait = this.preview3D.getPortraitDataUrl(skin);
    const cloudStatus = this.cloudSync?.getStatus();

    const rivalRows = [
      ...RIVAL_CLIMBERS.map((r) => ({ name: r.name, floor: r.floor, isYou: false, sub: '' })),
      { name: cloudStatus?.displayName || 'You', floor: save.stats.highestFloor, isYou: true, sub: `Lv. ${save.stats.accountLevel}` },
    ].sort((a, b) => b.floor - a.floor);

    let listHtml = '';
    if (this.lbTab === 'rivals') {
      listHtml = rivalRows
        .map(
          (r, idx) => `
        <div class="climber-row${r.isYou ? ' is-you' : ''}" style="padding:9px 12px;font-size:0.9rem;background:${
            r.isYou ? '' : 'rgba(255,255,255,0.04)'
          };">
          <span class="climber-row-name">
            <span style="width:22px;color:var(--ink-dim);font-weight:700;">${idx + 1}</span>
            ${r.isYou && portrait ? `<img class="climber-mini-avatar" src="${portrait}" alt="" />` : ''}
            <span style="font-weight:700;color:var(--ink-primary);">${r.name}</span>
          </span>
          <span style="font-weight:700;">Floor ${r.floor}</span>
        </div>
      `
        )
        .join('');
    } else if (!this.cloudSync?.isConfigured()) {
      listHtml = `<div style="padding:18px;text-align:center;color:var(--ink-secondary);font-size:0.86rem;">Supabase is offline or unconfigured.</div>`;
    } else if (this.globalLbRows === null) {
      listHtml = `<div style="padding:18px;text-align:center;color:var(--ink-secondary);font-size:0.86rem;">Loading global climbers from Supabase...</div>`;
    } else if (this.globalLbRows.length === 0) {
      listHtml = `<div style="padding:18px;text-align:center;color:var(--ink-secondary);font-size:0.86rem;">No global climbers recorded yet. Sign in under Settings &rarr; Save Data to post your floor!</div>`;
    } else {
      listHtml = this.globalLbRows
        .map((r, idx) => {
          const isYou = Boolean(cloudStatus?.userId && r.user_id === cloudStatus.userId);
          return `
            <div class="climber-row${isYou ? ' is-you' : ''}" style="padding:9px 12px;font-size:0.9rem;background:${
            isYou ? '' : 'rgba(255,255,255,0.04)'
          };">
              <span class="climber-row-name">
                <span style="width:22px;color:var(--ink-dim);font-weight:700;">${idx + 1}</span>
                ${isYou && portrait ? `<img class="climber-mini-avatar" src="${portrait}" alt="" />` : ''}
                <span style="font-weight:700;color:var(--ink-primary);">${r.display_name}</span>
                <span style="font-size:0.72rem;color:var(--ink-dim);">Lv.${r.account_level}</span>
              </span>
              <span style="font-weight:700;">Floor ${r.highest_floor}</span>
            </div>
          `;
        })
        .join('');
    }

    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame medium" style="width:min(540px,94vw);" role="dialog" aria-label="Leaderboard">
          <div class="modal-head">
            <div class="modal-heading">${ICONS.trophy}<span>Leaderboard</span></div>
            <button class="close-circle-btn" id="btn-modal-close" aria-label="Close Leaderboard">${ICONS.close}</button>
          </div>
          <div class="filter-pills">
            <button class="filter-pill${this.lbTab === 'rivals' ? ' active' : ''}" data-lb-tab="rivals">Sanctuary Rivals</button>
            <button class="filter-pill${this.lbTab === 'global' ? ' active' : ''}" data-lb-tab="global">Global Cloud</button>
          </div>
          <div style="padding:10px 20px 20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;">
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${listHtml}
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;">
              <div style="background:var(--surface-card);padding:11px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:1.2rem;font-weight:700;font-variant-numeric:tabular-nums;">${save.stats.runsStarted}</div>
                <div style="font-size:0.74rem;color:var(--ink-secondary);">Runs</div>
              </div>
              <div style="background:var(--surface-card);padding:11px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:1.2rem;font-weight:700;font-variant-numeric:tabular-nums;">${save.stats.floorsCleared}</div>
                <div style="font-size:0.74rem;color:var(--ink-secondary);">Floors Cleared</div>
              </div>
              <div style="background:var(--surface-card);padding:11px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:1.2rem;font-weight:700;font-variant-numeric:tabular-nums;">${save.stats.enemiesDefeated}</div>
                <div style="font-size:0.74rem;color:var(--ink-secondary);">Constructs</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-modal-close')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.popModal();
    });
    this.modalRoot.querySelectorAll<HTMLButtonElement>('[data-lb-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.playClick();
        this.lbTab = btn.dataset.lbTab as 'rivals' | 'global';
        if (this.lbTab === 'global' && this.cloudSync) {
          this.globalLbRows = null;
          this.renderLeaderboardModal();
          void this.cloudSync.fetchGlobalLeaderboard(20).then((rows) => {
            this.globalLbRows = rows;
            if (this.lastModalKey === 'leaderboard') {
              this.renderLeaderboardModal();
            }
          });
          return;
        }
        this.renderLeaderboardModal();
      });
    });
  }

  /* =========================================================
     LEVEL UP! BLESSING MODAL
     ========================================================= */
  private renderBoonModal(boons: RunBoonDefinition[]): void {
    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame medium" role="dialog" aria-label="Level Up">
          <div class="boon-stage">
            <div class="boon-header">
              <div class="boon-header-icon">${ICONS.upArrow}</div>
              <div>
                <div style="font-size:1.38rem;font-weight:700;letter-spacing:0.02em;line-height:1.1;">LEVEL UP!</div>
                <div style="font-size:0.84rem;color:var(--ink-secondary);">Choose a reward</div>
              </div>
            </div>
            <div class="boon-grid">
              ${boons
                .map(
                  (b, idx) => `
                <button class="boon-choice-card" style="--boon-rim:${b.borderColor};--boon-aura:${b.glowColor};" data-boon="${b.id}">
                  <span class="keycap" style="position:absolute;top:9px;right:9px;">${idx + 1}</span>
                  ${getIconSvg(b.icon)}
                  <div style="font-size:1.05rem;font-weight:700;margin-top:4px;">${b.name}</div>
                  <div style="font-size:0.76rem;color:var(--ink-secondary);line-height:1.3;">${b.subtitle}</div>
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelectorAll<HTMLButtonElement>('[data-boon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.playBuy();
        this.actions.chooseBoon(btn.dataset.boon!);
      });
    });
  }

  /* =========================================================
     WAYPOINT CHECKPOINT MODAL
     ========================================================= */
  private renderCheckpointModal(clearedFloor: number): void {
    const save = this.saveManager.getData();
    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame narrow" role="dialog" aria-label="Floor Cleared">
          <div class="center-dialog-body victory-streaks">
            <div style="width:40px;height:40px;">${ICONS.upArrow}</div>
            <h2 style="margin:0;font-size:1.45rem;">Floor ${clearedFloor} Cleared</h2>
            <p style="margin:0;color:var(--ink-secondary);font-size:0.84rem;line-height:1.4;">
              Continue to Floor ${clearedFloor + 1}, or return to the Sanctuary Shop with ${save.currency.toLocaleString()} Sky Coins.
            </p>
            <button class="game-btn periwinkle" id="btn-cp-next">
              ${ICONS.play}
              <span>Ascend to Floor ${clearedFloor + 1}</span>
            </button>
            <button class="game-btn slate" id="btn-cp-hub">
              ${ICONS.shop}
              <span>Return to Sanctuary Shop</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-cp-next')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.advanceFromCheckpoint();
    });
    this.modalRoot.querySelector('#btn-cp-hub')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.returnToHub();
    });
  }

  /* =========================================================
     SETTINGS MODAL (5-Bus Audio Mixer + Accessibility + Screen Stack)
     ========================================================= */
  private renderSettingsModal(): void {
    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame medium" style="width:min(680px,95vw);" role="dialog" aria-label="Settings">
          <div class="modal-head">
            <div class="modal-heading">${ICONS.settings}<span>Settings</span></div>
            <button class="close-circle-btn" id="btn-modal-close" aria-label="Back">${ICONS.close}</button>
          </div>
          <div class="settings-grid">
            <div class="settings-nav" id="settings-nav"></div>
            <div class="settings-pane" id="settings-pane"></div>
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-modal-close')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.popModal();
    });

    this.updateSettingsPane();
  }

  private updateSettingsPane(): void {
    const save = this.saveManager.getData();
    const s = save.settings;

    const navEl = this.modalRoot.querySelector('#settings-nav');
    if (navEl) {
      const tabs: [SettingsTab, string, string][] = [
        ['gameplay', 'Gameplay', ICONS.gamepad],
        ['audio', 'Audio', ICONS.audio],
        ['graphics', 'Graphics', ICONS.display],
        ['controls', 'Controls', ICONS.keyboard],
        ['data', 'Save Data', ICONS.data],
      ];
      navEl.innerHTML = tabs
        .map(
          ([id, label, icon]) => `
          <button class="settings-nav-btn${this.settingsTab === id ? ' active' : ''}" data-stab="${id}">
            ${icon}
            <span>${label}</span>
          </button>
        `
        )
        .join('');

      navEl.querySelectorAll<HTMLButtonElement>('[data-stab]').forEach((b) => {
        b.addEventListener('click', () => {
          this.audio.playClick();
          this.settingsTab = b.dataset.stab as SettingsTab;
          this.updateSettingsPane();
        });
      });
    }

    const pane = this.modalRoot.querySelector('#settings-pane');
    if (!pane) return;

    const sensPct = ((s.mouseSensitivity - 0.2) / 1.8) * 100;
    const scalePct = ((s.uiScale - 0.85) / 0.4) * 100;

    if (this.settingsTab === 'gameplay') {
      pane.innerHTML = `
        <div class="setting-line">
          <span class="setting-name">Camera Sensitivity</span>
          <div class="slider-group">
            <input class="game-slider" type="range" id="rng-sens" min="0.2" max="2.0" step="0.1" value="${s.mouseSensitivity}" style="--pct:${sensPct.toFixed(0)}%;" />
            <span class="slider-val" id="val-sens">${s.mouseSensitivity.toFixed(1)}</span>
          </div>
        </div>
        <div class="setting-line">
          <span class="setting-name">UI Scale</span>
          <div class="slider-group">
            <input class="game-slider" type="range" id="rng-uiscale" min="0.85" max="1.25" step="0.05" value="${s.uiScale}" style="--pct:${Math.max(0, Math.min(100, scalePct)).toFixed(0)}%;" />
            <span class="slider-val" id="val-uiscale">${Math.round(s.uiScale * 100)}%</span>
          </div>
        </div>
        <div class="setting-line">
          <span class="setting-name">Shake Intensity</span>
          <div class="slider-group">
            <input class="game-slider" type="range" id="rng-shake" min="0" max="1" step="0.1" value="${s.shakeStrength}" style="--pct:${Math.round(s.shakeStrength * 100)}%;" />
            <span class="slider-val" id="val-shake">${Math.round(s.shakeStrength * 100)}%</span>
          </div>
        </div>
        <div class="setting-line">
          <span class="setting-name">Reduce Impact Flash</span>
          <button class="pill-switch${s.reduceFlashing ? ' on' : ''}" id="sw-flash" aria-label="Toggle Reduce Impact Flash"></button>
        </div>
        <div class="setting-line">
          <span class="setting-name">Show FPS</span>
          <button class="pill-switch${s.showFps ? ' on' : ''}" id="sw-fps" aria-label="Toggle Show FPS"></button>
        </div>
      `;
    } else if (this.settingsTab === 'audio') {
      pane.innerHTML = `
        <div class="setting-line">
          <span class="setting-name">Master Volume</span>
          <div class="slider-group">
            <input class="game-slider" type="range" id="rng-master" min="0" max="1" step="0.05" value="${s.masterVolume}" style="--pct:${Math.round(s.masterVolume * 100)}%;" />
            <span class="slider-val" id="val-master">${Math.round(s.masterVolume * 100)}%</span>
          </div>
        </div>
        <div class="setting-line">
          <span class="setting-name">Music Bus</span>
          <div class="slider-group">
            <input class="game-slider" type="range" id="rng-music" min="0" max="1" step="0.05" value="${s.musicVolume}" style="--pct:${Math.round(s.musicVolume * 100)}%;" />
            <span class="slider-val" id="val-music">${Math.round(s.musicVolume * 100)}%</span>
          </div>
        </div>
        <div class="setting-line">
          <span class="setting-name">Combat SFX Bus</span>
          <div class="slider-group">
            <input class="game-slider" type="range" id="rng-sfx" min="0" max="1" step="0.05" value="${s.sfxVolume}" style="--pct:${Math.round(s.sfxVolume * 100)}%;" />
            <span class="slider-val" id="val-sfx">${Math.round(s.sfxVolume * 100)}%</span>
          </div>
        </div>
        <div class="setting-line">
          <span class="setting-name">Sky Wind Ambience</span>
          <div class="slider-group">
            <input class="game-slider" type="range" id="rng-amb" min="0" max="1" step="0.05" value="${s.ambienceVolume}" style="--pct:${Math.round(s.ambienceVolume * 100)}%;" />
            <span class="slider-val" id="val-amb">${Math.round(s.ambienceVolume * 100)}%</span>
          </div>
        </div>
        <div class="setting-line">
          <span class="setting-name">Interface UI Bus</span>
          <div class="slider-group">
            <input class="game-slider" type="range" id="rng-uivol" min="0" max="1" step="0.05" value="${s.uiVolume}" style="--pct:${Math.round(s.uiVolume * 100)}%;" />
            <span class="slider-val" id="val-uivol">${Math.round(s.uiVolume * 100)}%</span>
          </div>
        </div>
      `;
    } else if (this.settingsTab === 'graphics') {
      pane.innerHTML = `
        <div class="setting-line">
          <span class="setting-name">Quality Preset</span>
          <div style="display:flex;gap:7px;">
            ${(['low', 'medium', 'high'] as GraphicsQuality[])
              .map(
                (q) => `
              <button class="filter-pill${s.graphicsQuality === q ? ' active' : ''}" data-qual="${q}">
                ${q.charAt(0).toUpperCase() + q.slice(1)}
              </button>
            `
              )
              .join('')}
          </div>
        </div>
        <p style="margin:0;font-size:0.8rem;color:var(--ink-secondary);line-height:1.45;">
          High enables soft directional sunlight shadows and sharp Retina rendering on all Blender 3D models.
        </p>
      `;
    } else if (this.settingsTab === 'controls') {
      const binds = [
        ['W A S D / L-Stick', 'Move character'],
        ['Mouse / R-Stick', 'Orbit third-person camera'],
        ['Left Alt', 'Toggle Free Mouse (Shift Lock)'],
        ['Space / South (A)', 'Jump / Double Jump'],
        ['LMB / J / West (X)', 'Weapon 3-hit melee combo'],
        ['Q / E / LB / RB', 'Equipped active skills'],
        ['F / North (Y)', 'Talk to NPCs, open chests & portals'],
        ['C / D-Pad Up', 'Drink Sky Tonic (+45 HP)'],
        ['Esc / Start', 'Pause or pop menu stack'],
      ];
      pane.innerHTML = `
        <div style="display:grid;grid-template-columns:158px 1fr;gap:8px 14px;align-items:center;font-size:0.83rem;">
          ${binds
            .map(
              ([k, desc]) => `
            <div><span class="keycap">${k}</span></div>
            <div style="color:var(--ink-secondary);">${desc}</div>
          `
            )
            .join('')}
        </div>
      `;
    } else {
      const cs = this.cloudSync?.getStatus();
      const cloudCard = !cs?.configured
        ? `<div style="background:var(--surface-card);padding:12px 15px;border-radius:13px;border:1px solid rgba(255,255,255,0.1);font-size:0.8rem;color:var(--ink-secondary);">Supabase Cloud Sync offline (localStorage active).</div>`
        : cs.userId
          ? `
            <div style="background:var(--surface-card);padding:13px 15px;border-radius:13px;border:1px solid rgba(56,189,248,0.28);display:flex;flex-direction:column;gap:9px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <div>
                  <div style="font-weight:700;font-size:0.9rem;color:#bae6fd;">Cloud Sync: ${cs.displayName ?? 'Climber'}</div>
                  <div style="font-size:0.74rem;color:var(--ink-secondary);">${cs.email ?? ''}${cs.lastSyncedAt ? ` · Synced ${cs.lastSyncedAt}` : ''}</div>
                </div>
                <button class="game-btn slate" style="width:auto;padding:6px 12px;font-size:0.78rem;" id="btn-cloud-signout">Sign Out</button>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="game-btn periwinkle" style="width:auto;padding:7px 14px;font-size:0.8rem;" id="btn-cloud-push" ${cs.syncing ? 'disabled' : ''}>Sync Now</button>
                <button class="game-btn slate" style="width:auto;padding:7px 14px;font-size:0.8rem;" id="btn-cloud-pull" ${cs.syncing ? 'disabled' : ''}>Load Cloud Save</button>
              </div>
              ${this.cloudAuthMsg ? `<div style="font-size:0.75rem;color:#fde68a;">${this.cloudAuthMsg}</div>` : ''}
            </div>
          `
          : `
            <div style="background:var(--surface-card);padding:13px 15px;border-radius:13px;border:1px solid rgba(255,255,255,0.1);display:flex;flex-direction:column;gap:9px;">
              <div>
                <div style="font-weight:700;font-size:0.9rem;">Supabase Cloud Save & Leaderboard</div>
                <div style="font-size:0.75rem;color:var(--ink-secondary);">Sign in or create an account to back up saves and post to the global leaderboard.</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;">
                <input type="email" id="inp-cloud-email" placeholder="Email" style="background:#0b1120;color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:7px 10px;font-size:0.8rem;" />
                <input type="password" id="inp-cloud-pass" placeholder="Password (6+ chars)" style="background:#0b1120;color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:7px 10px;font-size:0.8rem;" />
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <input type="text" id="inp-cloud-name" placeholder="Climber Name (for Sign Up)" maxlength="24" style="flex:1;min-width:140px;background:#0b1120;color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:7px 10px;font-size:0.8rem;" />
                <button class="game-btn periwinkle" style="width:auto;padding:7px 14px;font-size:0.8rem;" id="btn-cloud-signin" ${cs.syncing ? 'disabled' : ''}>Sign In</button>
                <button class="game-btn ivory" style="width:auto;padding:7px 14px;font-size:0.8rem;" id="btn-cloud-signup" ${cs.syncing ? 'disabled' : ''}>Create Account</button>
              </div>
              ${this.cloudAuthMsg || cs.lastError ? `<div style="font-size:0.75rem;color:#fde68a;">${this.cloudAuthMsg || cs.lastError}</div>` : ''}
            </div>
          `;

      const isDev = Boolean(this.cloudSync?.isDeveloperAccount());
      if (!isDev) {
        this.debugExpanded = false;
      }

      pane.innerHTML = `
        ${cloudCard}

        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;background:var(--surface-card);padding:13px 15px;border-radius:13px;border:1px solid rgba(255,255,255,0.1);">
          <div>
            <div style="font-weight:700;font-size:0.9rem;">Reset Local Progress</div>
            <div style="font-size:0.76rem;color:var(--ink-secondary);">Restores coins, weapons, upgrades, skills, and skins.</div>
          </div>
          <button class="game-btn danger" style="width:auto;flex-shrink:0;" id="btn-reset-prompt">Reset Save</button>
        </div>

        ${
          isDev
            ? `
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;">
          <button class="filter-pill" id="btn-dbg-toggle" style="display:inline-flex;align-items:center;gap:6px;">
            <span>Developer Tools</span>
          </button>
          ${
            this.debugExpanded
              ? `
            <div style="margin-top:10px;background:rgba(12,18,34,0.72);padding:13px;border-radius:13px;border:1px solid rgba(255,255,255,0.1);display:flex;flex-direction:column;gap:10px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:0.82rem;color:var(--ink-secondary);" id="dbg-coin-readout">${save.currency.toLocaleString()} Coins</span>
                <button class="game-btn ivory" style="width:auto;padding:6px 12px;" id="btn-dbg-coins">+500 Test Coins</button>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <input type="text" id="inp-dbg-seed" placeholder="Seed (e.g. SPIRE-7)" value="${this.debugSeedInput}" style="flex:1;min-width:130px;background:#0b1120;color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:7px 10px;font-size:0.8rem;" />
                <input type="number" id="inp-dbg-floor" min="1" max="30" value="${this.debugFloorInput}" aria-label="Starting Floor" style="width:66px;background:#0b1120;color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:7px 8px;font-size:0.8rem;" />
                <button class="game-btn periwinkle" style="width:auto;padding:7px 14px;font-size:0.8rem;" id="btn-dbg-go">Start Seed</button>
              </div>
            </div>
          `
              : ''
          }
        </div>
        `
            : ''
        }
      `;
    }

    const patch = (nextPartial: Partial<SaveSettings>, redraw = false) => {
      const merged = { ...this.saveManager.getData().settings, ...nextPartial };
      this.actions.applySettings(merged);
      if (redraw) this.updateSettingsPane();
    };

    pane.querySelector<HTMLInputElement>('#rng-sens')?.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      const v = Number(el.value);
      el.style.setProperty('--pct', `${(((v - 0.2) / 1.8) * 100).toFixed(0)}%`);
      pane.querySelector('#val-sens')!.textContent = v.toFixed(1);
      patch({ mouseSensitivity: v });
    });
    pane.querySelector<HTMLInputElement>('#rng-uiscale')?.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      const v = Number(el.value);
      el.style.setProperty('--pct', `${(((v - 0.85) / 0.4) * 100).toFixed(0)}%`);
      pane.querySelector('#val-uiscale')!.textContent = `${Math.round(v * 100)}%`;
      patch({ uiScale: v });
    });
    pane.querySelector<HTMLInputElement>('#rng-shake')?.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      const v = Number(el.value);
      el.style.setProperty('--pct', `${Math.round(v * 100)}%`);
      pane.querySelector('#val-shake')!.textContent = `${Math.round(v * 100)}%`;
      patch({ shakeStrength: v, screenShake: v > 0.01 });
    });
    pane.querySelector('#sw-flash')?.addEventListener('click', () => {
      this.audio.playClick();
      patch({ reduceFlashing: !s.reduceFlashing }, true);
    });
    pane.querySelector('#sw-fps')?.addEventListener('click', () => {
      this.audio.playClick();
      patch({ showFps: !s.showFps }, true);
    });

    const wireVol = (
      id: string,
      valId: string,
      key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'ambienceVolume' | 'uiVolume'
    ) => {
      pane.querySelector<HTMLInputElement>(id)?.addEventListener('input', (e) => {
        const el = e.target as HTMLInputElement;
        const v = Number(el.value);
        el.style.setProperty('--pct', `${Math.round(v * 100)}%`);
        pane.querySelector(valId)!.textContent = `${Math.round(v * 100)}%`;
        patch({ [key]: v });
      });
    };
    wireVol('#rng-master', '#val-master', 'masterVolume');
    wireVol('#rng-music', '#val-music', 'musicVolume');
    wireVol('#rng-sfx', '#val-sfx', 'sfxVolume');
    wireVol('#rng-amb', '#val-amb', 'ambienceVolume');
    wireVol('#rng-uivol', '#val-uivol', 'uiVolume');

    pane.querySelectorAll<HTMLButtonElement>('[data-qual]').forEach((b) => {
      b.addEventListener('click', () => {
        this.audio.playClick();
        patch({ graphicsQuality: b.dataset.qual as GraphicsQuality }, true);
      });
    });

    pane.querySelector('#btn-reset-prompt')?.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.openModal('reset_confirm');
    });
    pane.querySelector('#btn-cloud-signin')?.addEventListener('click', async () => {
      if (!this.cloudSync) return;
      const email = (pane.querySelector('#inp-cloud-email') as HTMLInputElement | null)?.value ?? '';
      const pass = (pane.querySelector('#inp-cloud-pass') as HTMLInputElement | null)?.value ?? '';
      this.audio.playClick();
      const res = await this.cloudSync.signIn(email, pass);
      this.cloudAuthMsg = res.message;
      this.updateSettingsPane();
    });
    pane.querySelector('#btn-cloud-signup')?.addEventListener('click', async () => {
      if (!this.cloudSync) return;
      const email = (pane.querySelector('#inp-cloud-email') as HTMLInputElement | null)?.value ?? '';
      const pass = (pane.querySelector('#inp-cloud-pass') as HTMLInputElement | null)?.value ?? '';
      const name = (pane.querySelector('#inp-cloud-name') as HTMLInputElement | null)?.value ?? '';
      this.audio.playClick();
      const res = await this.cloudSync.signUp(email, pass, name);
      this.cloudAuthMsg = res.message;
      this.updateSettingsPane();
    });
    pane.querySelector('#btn-cloud-signout')?.addEventListener('click', async () => {
      if (!this.cloudSync) return;
      this.audio.playClick();
      await this.cloudSync.signOut();
      this.cloudAuthMsg = '';
      this.updateSettingsPane();
    });
    pane.querySelector('#btn-cloud-push')?.addEventListener('click', async () => {
      if (!this.cloudSync) return;
      this.audio.playClick();
      const res = await this.cloudSync.syncSaveNow();
      this.cloudAuthMsg = res.message;
      this.updateSettingsPane();
    });
    pane.querySelector('#btn-cloud-pull')?.addEventListener('click', async () => {
      if (!this.cloudSync) return;
      this.audio.playClick();
      const res = await this.cloudSync.pullSaveFromCloud();
      this.cloudAuthMsg = res.message;
      this.updateSettingsPane();
    });
    pane.querySelector('#btn-dbg-toggle')?.addEventListener('click', () => {
      this.audio.playClick();
      this.debugExpanded = !this.debugExpanded;
      this.updateSettingsPane();
    });
    pane.querySelector('#btn-dbg-coins')?.addEventListener('click', () => {
      this.audio.playBuy();
      this.actions.grantDebugCoins(500);
    });
    pane.querySelector('#btn-dbg-go')?.addEventListener('click', () => {
      const seed = (pane.querySelector('#inp-dbg-seed') as HTMLInputElement).value;
      const fl = Number((pane.querySelector('#inp-dbg-floor') as HTMLInputElement).value) || 1;
      this.debugSeedInput = seed;
      this.debugFloorInput = fl;
      this.audio.playClick();
      this.actions.startRun(seed, fl);
    });
  }

  private renderResetConfirmModal(): void {
    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame narrow" role="alertdialog" aria-label="Confirm Save Reset">
          <div class="center-dialog-body defeat-streaks">
            <h2 style="margin:0;font-size:1.35rem;">Reset All Progress?</h2>
            <p style="margin:0;color:var(--ink-secondary);font-size:0.84rem;line-height:1.4;">
              Your Sky Coins, forged weapons, upgrades, skills, skins, and career records will be reset to starter defaults.
            </p>
            <button class="game-btn danger" id="btn-do-reset">Reset My Save</button>
            <button class="game-btn slate" id="btn-cancel-reset">Cancel</button>
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-do-reset')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.resetSaveConfirmed();
    });
    this.modalRoot.querySelector('#btn-cancel-reset')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.popModal();
    });
  }

  /* =========================================================
     VICTORY & GAME OVER SUMMARY MODALS
     ========================================================= */
  private renderSummaryModal(victory: boolean): void {
    const sum = this.summaryData ?? {
      victory,
      floorReached: 1,
      coinsEarned: 0,
      enemiesDefeated: 0,
    };

    this.modalRoot.innerHTML = `
      <div class="modal-scrim">
        <div class="modal-frame narrow" role="dialog" aria-label="${victory ? 'Tower Conquered' : 'Game Over'}">
          <div class="center-dialog-body ${victory ? 'victory-streaks' : 'defeat-streaks'}">
            <div style="width:46px;height:46px;">${victory ? ICONS.crown : ICONS.skull}</div>
            <h2 style="margin:0;font-size:1.68rem;letter-spacing:0.03em;color:${
              victory ? '#fde68a' : '#fb7185'
            };">
              ${victory ? 'TOWER CONQUERED' : 'GAME OVER'}
            </h2>
            <div style="font-size:0.94rem;font-weight:700;">
              ${victory ? `Cleared Floor ${sum.floorReached} Summit` : `You reached floor ${sum.floorReached}`}
            </div>
            <div class="hud-surface coin-capsule" style="padding:7px 16px;font-size:1.05rem;color:#fde68a;">
              <span class="coin-capsule-icon">${ICONS.coin}</span>
              <span>+${sum.coinsEarned.toLocaleString()}</span>
            </div>
            ${
              victory
                ? `<button class="game-btn periwinkle" id="btn-sum-endless">${ICONS.upArrow}<span>Endless Ascent (Floor ${sum.floorReached + 1}+)</span></button>`
                : ''
            }
            <button class="game-btn ivory" id="btn-sum-retry" style="padding:10px 16px;font-size:0.92rem;">
              ${victory ? 'Play Again' : 'Try Again'}
            </button>
            <button class="game-btn slate" id="btn-sum-hub">Sanctuary Hub</button>
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector('#btn-sum-endless')?.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.continueEndless();
    });
    this.modalRoot.querySelector('#btn-sum-retry')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.startRun();
    });
    this.modalRoot.querySelector('#btn-sum-hub')!.addEventListener('click', () => {
      this.audio.playClick();
      this.actions.returnToHub();
    });
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onModalKeyDown);
    this.preview3D.dispose();
  }
}
