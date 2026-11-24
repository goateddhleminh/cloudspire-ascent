import { SaveSettings } from '../persistence/SaveData';

type AudioBusName = 'sfx' | 'ui' | 'music' | 'ambience';

const SFX_FILES: Record<string, string> = {
  slash_01: '/assets/audio/sfx/sfx_slash_01.wav',
  slash_02: '/assets/audio/sfx/sfx_slash_02.wav',
  slash_03: '/assets/audio/sfx/sfx_slash_03_finisher.wav',
  hit_01: '/assets/audio/sfx/sfx_hit_light_01.wav',
  hit_02: '/assets/audio/sfx/sfx_hit_light_02.wav',
  hit_03: '/assets/audio/sfx/sfx_hit_light_03.wav',
  hit_crit: '/assets/audio/sfx/sfx_hit_crit.wav',
  dummy_bonk: '/assets/audio/sfx/sfx_dummy_bonk.wav',
  enemy_windup: '/assets/audio/sfx/sfx_enemy_windup.wav',
  enemy_shoot: '/assets/audio/sfx/sfx_enemy_shoot.wav',
  enemy_shockwave: '/assets/audio/sfx/sfx_enemy_shockwave.wav',
  enemy_defeat: '/assets/audio/sfx/sfx_enemy_defeat.wav',
  skill_dash: '/assets/audio/sfx/sfx_skill_dash.wav',
  skill_lance: '/assets/audio/sfx/sfx_skill_lance.wav',
  skill_nova: '/assets/audio/sfx/sfx_skill_nova.wav',
  skill_shield: '/assets/audio/sfx/sfx_skill_shield.wav',
  step_01: '/assets/audio/sfx/sfx_step_01.wav',
  step_02: '/assets/audio/sfx/sfx_step_02.wav',
  jump: '/assets/audio/sfx/sfx_jump.wav',
  double_jump: '/assets/audio/sfx/sfx_double_jump.wav',
  land: '/assets/audio/sfx/sfx_land.wav',
  jumppad: '/assets/audio/sfx/sfx_jumppad.wav',
  coin_01: '/assets/audio/sfx/sfx_coin_01.wav',
  coin_02: '/assets/audio/sfx/sfx_coin_02.wav',
  chest_open: '/assets/audio/sfx/sfx_chest_open.wav',
  shrine_bless: '/assets/audio/sfx/sfx_shrine_bless.wav',
  tonic_drink: '/assets/audio/sfx/sfx_tonic_drink.wav',
  portal_enter: '/assets/audio/sfx/sfx_portal_enter.wav',
  player_hurt: '/assets/audio/sfx/sfx_player_hurt.wav',
  shield_block: '/assets/audio/sfx/sfx_shield_block.wav',
  ui_hover: '/assets/audio/sfx/sfx_ui_hover.wav',
  ui_click: '/assets/audio/sfx/sfx_ui_click.wav',
  ui_buy: '/assets/audio/sfx/sfx_ui_buy.wav',
  ui_error: '/assets/audio/sfx/sfx_ui_error.wav',
  level_up: '/assets/audio/sfx/sfx_level_up.wav',
  floor_clear: '/assets/audio/sfx/sfx_floor_clear.wav',
  victory: '/assets/audio/sfx/sfx_victory.wav',
  defeat: '/assets/audio/sfx/sfx_defeat.wav',
  music_hub: '/assets/audio/music/music_sanctuary_loop.wav',
  music_combat: '/assets/audio/music/music_combat_loop.wav',
  ambience_wind: '/assets/audio/music/ambience_sky_wind_loop.wav',
};

/**
 * Multi-Bus Web Audio Mixer + Sample-Pool Randomizer + Adaptive Music Engine.
 * Bus Graph:
 *   Music -> MusicDuck -> Master
 *   Ambience -----------> Master
 *   SFX ----------------> Master
 *   UI -----------------> Master
 * Uses perceptual squared gain curves (`slider * slider`) with true mute at 0.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicDuckGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private uiGain: GainNode | null = null;

  private rawArrays = new Map<string, ArrayBuffer>();
  private decodedBuffers = new Map<string, AudioBuffer>();
  private lastPoolPick = new Map<string, number>();

  private activeMusicSource: AudioBufferSourceNode | null = null;
  private activeMusicTrackGain: GainNode | null = null;
  private activeMusicMode: 'hub' | 'combat' | null = null;
  private desiredMusicMode: 'hub' | 'combat' = 'hub';

  private ambienceSource: AudioBufferSourceNode | null = null;
  private duckRestoreTimer: number | null = null;
  private mutedByVisibility = false;
  private preloadStarted = false;

  private masterVol = 0.8;
  private musicVol = 0.55;
  private sfxVol = 0.8;
  private ambienceVol = 0.65;
  private uiVol = 0.8;

  async preloadAudioFiles(): Promise<void> {
    if (this.preloadStarted || typeof window === 'undefined' || typeof fetch === 'undefined') return;
    this.preloadStarted = true;

    const entries = Object.entries(SFX_FILES);
    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const resp = await fetch(url);
          if (!resp.ok) return;
          const buf = await resp.arrayBuffer();
          this.rawArrays.set(key, buf);
          if (this.ctx) {
            await this.decodeKey(key);
          }
        } catch {
          // Graceful synth fallback if fetch unavailable
        }
      })
    );

    if (this.ctx && this.ctx.state === 'running') {
      this.ensureLoopsPlaying();
    }
  }

  private async decodeKey(key: string): Promise<void> {
    if (!this.ctx || this.decodedBuffers.has(key)) return;
    const raw = this.rawArrays.get(key);
    if (!raw) return;
    try {
      const copy = raw.slice(0);
      const audioBuf = await this.ctx.decodeAudioData(copy);
      this.decodedBuffers.set(key, audioBuf);
    } catch {
      // Ignore malformed/unsupported decode
    }
  }

  private async decodeAllPending(): Promise<void> {
    if (!this.ctx) return;
    const keys = Array.from(this.rawArrays.keys());
    await Promise.all(keys.map((k) => this.decodeKey(k)));
    this.ensureLoopsPlaying();
  }

  applySettings(
    settings: Pick<SaveSettings, 'masterVolume' | 'musicVolume' | 'sfxVolume'> &
      Partial<Pick<SaveSettings, 'ambienceVolume' | 'uiVolume'>>
  ): void {
    this.masterVol = settings.masterVolume;
    this.musicVol = settings.musicVolume;
    this.sfxVol = settings.sfxVolume;
    if (typeof settings.ambienceVolume === 'number') this.ambienceVol = settings.ambienceVolume;
    if (typeof settings.uiVolume === 'number') this.uiVol = settings.uiVolume;
    this.syncGains();
  }

  setPausedForVisibility(hidden: boolean): void {
    this.mutedByVisibility = hidden;
    this.syncGains();
  }

  setMusicState(mode: 'hub' | 'combat'): void {
    this.desiredMusicMode = mode;
    if (this.ctx && this.ctx.state === 'running') {
      this.ensureLoopsPlaying();
    }
  }

  unlock(): void {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.preloadStarted) {
      void this.preloadAudioFiles();
    }

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.musicDuckGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.ambienceGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.uiGain = this.ctx.createGain();

        this.musicGain.connect(this.musicDuckGain);
        this.musicDuckGain.connect(this.masterGain);
        this.ambienceGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.uiGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.syncGains();
        void this.decodeAllPending();
      } catch {
        return;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx
        .resume()
        .then(() => {
          void this.decodeAllPending();
        })
        .catch(() => {});
    } else {
      this.ensureLoopsPlaying();
    }
  }

  private squaredGain(slider01: number, busCeiling = 1.0): number {
    const clamped = Math.max(0, Math.min(1, slider01));
    if (clamped <= 0.001) return 0;
    return clamped * clamped * busCeiling;
  }

  private syncGains(): void {
    if (
      !this.ctx ||
      !this.masterGain ||
      !this.musicGain ||
      !this.ambienceGain ||
      !this.sfxGain ||
      !this.uiGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    const master = this.mutedByVisibility ? 0 : this.squaredGain(this.masterVol, 0.95);
    this.masterGain.gain.setTargetAtTime(master, now, 0.025);
    this.musicGain.gain.setTargetAtTime(this.squaredGain(this.musicVol, 0.42), now, 0.05);
    this.ambienceGain.gain.setTargetAtTime(this.squaredGain(this.ambienceVol, 0.34), now, 0.06);
    this.sfxGain.gain.setTargetAtTime(this.squaredGain(this.sfxVol, 0.72), now, 0.025);
    this.uiGain.gain.setTargetAtTime(this.squaredGain(this.uiVol, 0.62), now, 0.025);
  }

  /**
   * Sidechain-style ducking on `MusicDuck` bus so big stingers (level-up, victory, boss)
   * read clearly without overwriting the player's Music slider.
   */
  public duckMusic(holdMs = 550, dipLinear = 0.32): void {
    if (!this.ctx || !this.musicDuckGain) return;
    const now = this.ctx.currentTime;
    this.musicDuckGain.gain.cancelScheduledValues(now);
    this.musicDuckGain.gain.setTargetAtTime(dipLinear, now, 0.018);

    if (this.duckRestoreTimer !== null) {
      window.clearTimeout(this.duckRestoreTimer);
    }
    this.duckRestoreTimer = window.setTimeout(() => {
      if (!this.ctx || !this.musicDuckGain) return;
      this.musicDuckGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.16);
      this.duckRestoreTimer = null;
    }, holdMs);
  }

  private ensureLoopsPlaying(): void {
    if (!this.ctx || this.ctx.state !== 'running') return;

    // 1. Ambience loop
    if (!this.ambienceSource && this.ambienceGain) {
      const ambBuf = this.decodedBuffers.get('ambience_wind');
      if (ambBuf) {
        const src = this.ctx.createBufferSource();
        src.buffer = ambBuf;
        src.loop = true;
        src.connect(this.ambienceGain);
        src.start();
        this.ambienceSource = src;
      }
    }

    // 2. Adaptive Music Crossfade (Hub <-> Combat)
    if (this.activeMusicMode !== this.desiredMusicMode && this.musicGain) {
      const key = this.desiredMusicMode === 'combat' ? 'music_combat' : 'music_hub';
      const buf = this.decodedBuffers.get(key);
      if (!buf) return;

      const now = this.ctx.currentTime;
      if (this.activeMusicSource && this.activeMusicTrackGain) {
        const oldSrc = this.activeMusicSource;
        const oldGain = this.activeMusicTrackGain;
        oldGain.gain.setTargetAtTime(0.0001, now, 0.18);
        window.setTimeout(() => {
          try {
            oldSrc.stop();
            oldSrc.disconnect();
            oldGain.disconnect();
          } catch {
            // Ignore
          }
        }, 700);
      }

      const nextGain = this.ctx.createGain();
      nextGain.gain.setValueAtTime(0.001, now);
      nextGain.gain.setTargetAtTime(1.0, now, 0.22);
      nextGain.connect(this.musicGain);

      const nextSrc = this.ctx.createBufferSource();
      nextSrc.buffer = buf;
      nextSrc.loop = true;
      nextSrc.connect(nextGain);
      nextSrc.start();

      this.activeMusicSource = nextSrc;
      this.activeMusicTrackGain = nextGain;
      this.activeMusicMode = this.desiredMusicMode;
    }
  }

  private getBusNode(bus: AudioBusName): GainNode | null {
    if (bus === 'ui') return this.uiGain;
    if (bus === 'music') return this.musicGain;
    if (bus === 'ambience') return this.ambienceGain;
    return this.sfxGain;
  }

  private playSample(
    key: string,
    bus: AudioBusName = 'sfx',
    pitchSemitones = 0,
    volumeLinear = 1.0
  ): boolean {
    if (!this.ctx || this.mutedByVisibility || this.ctx.state !== 'running') return false;
    const buf = this.decodedBuffers.get(key);
    const busNode = this.getBusNode(bus);
    if (!buf || !busNode) return false;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (pitchSemitones !== 0) {
      src.playbackRate.value = Math.pow(2, pitchSemitones / 12);
    }

    const gain = this.ctx.createGain();
    gain.gain.value = volumeLinear;
    src.connect(gain);
    gain.connect(busNode);
    src.start();
    return true;
  }

  private playPool(
    poolId: string,
    keys: string[],
    bus: AudioBusName = 'sfx',
    pitchSpreadSemitones = 1.1,
    volSpread = 0.12,
    baseVol = 1.0
  ): boolean {
    if (keys.length === 0) return false;
    let idx = Math.floor(Math.random() * keys.length);
    const prev = this.lastPoolPick.get(poolId);
    if (keys.length > 1 && idx === prev) {
      idx = (idx + 1) % keys.length;
    }
    this.lastPoolPick.set(poolId, idx);

    const semi = (Math.random() * 2 - 1) * pitchSpreadSemitones;
    const vol = baseVol * (1 + (Math.random() * 2 - 1) * volSpread);
    return this.playSample(keys[idx], bus, semi, Math.max(0.1, vol));
  }

  private fallbackTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.3,
    bus: AudioBusName = 'sfx'
  ): void {
    const dest = this.getBusNode(bus);
    if (!this.ctx || !dest || this.mutedByVisibility || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.014, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playHover(): void {
    this.unlock();
    if (!this.playSample('ui_hover', 'ui', (Math.random() - 0.5) * 0.6, 0.55)) {
      this.fallbackTone(760, 820, 0.035, 'sine', 0.12, 'ui');
    }
  }

  playClick(): void {
    this.unlock();
    if (!this.playSample('ui_click', 'ui', (Math.random() - 0.5) * 0.5, 0.85)) {
      this.fallbackTone(620, 860, 0.055, 'sine', 0.22, 'ui');
    }
  }

  playBuy(): void {
    this.unlock();
    if (!this.playSample('ui_buy', 'ui', 0, 0.95)) {
      this.fallbackTone(523.25, 1046.5, 0.16, 'triangle', 0.32, 'ui');
    }
  }

  playError(): void {
    this.unlock();
    if (!this.playSample('ui_error', 'ui', 0, 0.85)) {
      this.fallbackTone(240, 165, 0.16, 'sawtooth', 0.22, 'ui');
    }
  }

  playFootstep(): void {
    this.unlock();
    this.playPool('step', ['step_01', 'step_02'], 'sfx', 1.4, 0.16, 0.42);
  }

  playJump(isDouble = false): void {
    this.unlock();
    const key = isDouble ? 'double_jump' : 'jump';
    if (!this.playSample(key, 'sfx', (Math.random() - 0.5) * 0.8, 0.85)) {
      this.fallbackTone(isDouble ? 420 : 260, isDouble ? 880 : 520, 0.14, 'sine', 0.28);
    }
  }

  playLand(): void {
    this.unlock();
    this.playSample('land', 'sfx', (Math.random() - 0.5) * 1.2, 0.62);
  }

  playJumpPad(): void {
    this.unlock();
    if (!this.playSample('jumppad', 'sfx', 0, 0.92)) {
      this.playJump(true);
    }
  }

  playSlash(comboStep = 0): void {
    this.unlock();
    const key = comboStep === 2 ? 'slash_03' : comboStep === 1 ? 'slash_02' : 'slash_01';
    if (!this.playSample(key, 'sfx', (Math.random() - 0.5) * 0.9, comboStep === 2 ? 0.96 : 0.82)) {
      const base = 300 + comboStep * 65;
      this.fallbackTone(base * 1.4, base * 0.55, 0.11, 'sawtooth', 0.25);
    }
  }

  playHit(crit = false, isDummy = false): void {
    this.unlock();
    if (isDummy) {
      if (this.playSample('dummy_bonk', 'sfx', (Math.random() - 0.5) * 1.4, crit ? 0.95 : 0.78)) {
        return;
      }
    }
    if (crit) {
      this.duckMusic(220, 0.62);
      if (!this.playSample('hit_crit', 'sfx', (Math.random() - 0.5) * 0.7, 0.98)) {
        this.fallbackTone(520, 120, 0.14, 'square', 0.3);
      }
      return;
    }
    if (!this.playPool('mob_hit', ['hit_01', 'hit_02', 'hit_03'], 'sfx', 1.2, 0.12, 0.88)) {
      this.fallbackTone(340, 130, 0.09, 'square', 0.22);
    }
  }

  playEnemyWindup(): void {
    this.unlock();
    this.playSample('enemy_windup', 'sfx', (Math.random() - 0.5) * 1.0, 0.52);
  }

  playEnemyShoot(): void {
    this.unlock();
    this.playSample('enemy_shoot', 'sfx', (Math.random() - 0.5) * 1.2, 0.68);
  }

  playEnemyShockwave(): void {
    this.unlock();
    this.duckMusic(280, 0.58);
    this.playSample('enemy_shockwave', 'sfx', (Math.random() - 0.5) * 0.8, 0.92);
  }

  playEnemyDefeat(): void {
    this.unlock();
    if (!this.playSample('enemy_defeat', 'sfx', (Math.random() - 0.5) * 1.0, 0.92)) {
      this.fallbackTone(360, 880, 0.16, 'triangle', 0.28);
    }
  }

  playSkill(skillId: string): void {
    this.unlock();
    const map: Record<string, string> = {
      phase_dash: 'skill_dash',
      starlight_bolt: 'skill_lance',
      solar_nova: 'skill_nova',
      aegis_shield: 'skill_shield',
    };
    const key = map[skillId] ?? 'skill_shield';
    if (skillId === 'solar_nova') this.duckMusic(360, 0.5);
    if (!this.playSample(key, 'sfx', (Math.random() - 0.5) * 0.6, 0.92)) {
      this.fallbackTone(720, 260, 0.18, 'sawtooth', 0.28);
    }
  }

  playPlayerHurt(blocked = false): void {
    this.unlock();
    if (blocked) {
      if (!this.playSample('shield_block', 'sfx', 0, 0.88)) {
        this.fallbackTone(680, 480, 0.1, 'triangle', 0.25);
      }
      return;
    }
    this.duckMusic(320, 0.52);
    if (!this.playSample('player_hurt', 'sfx', (Math.random() - 0.5) * 0.6, 0.95)) {
      this.fallbackTone(190, 95, 0.2, 'sawtooth', 0.36);
    }
  }

  playCoin(): void {
    this.unlock();
    if (!this.playPool('coin', ['coin_01', 'coin_02'], 'sfx', 1.1, 0.08, 0.78)) {
      this.fallbackTone(880, 1318, 0.09, 'sine', 0.22);
    }
  }

  playChestOpen(): void {
    this.unlock();
    this.duckMusic(450, 0.52);
    if (!this.playSample('chest_open', 'sfx', 0, 0.92)) {
      this.playBuy();
    }
  }

  playShrineBless(): void {
    this.unlock();
    this.duckMusic(450, 0.55);
    if (!this.playSample('shrine_bless', 'sfx', 0, 0.9)) {
      this.playHeal();
    }
  }

  playPortalEnter(): void {
    this.unlock();
    this.playSample('portal_enter', 'sfx', 0, 0.88);
  }

  playHeal(): void {
    this.unlock();
    if (!this.playSample('tonic_drink', 'sfx', 0, 0.88)) {
      this.fallbackTone(440, 880, 0.18, 'sine', 0.28);
    }
  }

  playFloorClear(): void {
    this.unlock();
    this.duckMusic(750, 0.36);
    if (!this.playSample('floor_clear', 'sfx', 0, 0.95)) {
      this.fallbackTone(523.25, 1046.5, 0.28, 'triangle', 0.3);
    }
  }

  playLevelUp(): void {
    this.unlock();
    this.duckMusic(800, 0.35);
    if (!this.playSample('level_up', 'sfx', 0, 0.95)) {
      this.fallbackTone(440, 880, 0.28, 'sine', 0.3);
    }
  }

  playVictory(): void {
    this.unlock();
    this.duckMusic(1200, 0.28);
    if (!this.playSample('victory', 'sfx', 0, 0.98)) {
      this.playFloorClear();
    }
  }

  playDefeat(): void {
    this.unlock();
    this.duckMusic(1100, 0.28);
    if (!this.playSample('defeat', 'sfx', 0, 0.92)) {
      this.fallbackTone(392, 261.63, 0.35, 'sawtooth', 0.26);
    }
  }

  dispose(): void {
    if (this.duckRestoreTimer !== null) {
      window.clearTimeout(this.duckRestoreTimer);
      this.duckRestoreTimer = null;
    }
    try {
      this.activeMusicSource?.stop();
      this.ambienceSource?.stop();
    } catch {
      // Ignore
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
