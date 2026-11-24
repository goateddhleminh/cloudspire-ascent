export type SkillKind = 'active' | 'mobility';

export interface SkillDefinition {
  id: string;
  name: string;
  kind: SkillKind;
  description: string;
  icon: 'bolt' | 'star' | 'wings' | 'nova' | 'shield';
  accentColor: string;
  cooldown: number;
  price: number;
  starterOwned?: boolean;
  // Effect tuning
  damageMultiplier?: number;
  dashSpeed?: number;
  dashDuration?: number;
  projectileSpeed?: number;
  radius?: number;
  shieldAmount?: number;
  healAmount?: number;
}

export const SKILLS: Record<string, SkillDefinition> = {
  phase_dash: {
    id: 'phase_dash',
    name: 'Phase Dash',
    kind: 'active',
    description: 'Dash forward in a burst of lightning, phasing through hits and striking foes.',
    icon: 'bolt',
    accentColor: '#fbbf24',
    cooldown: 3.2,
    price: 0,
    starterOwned: true,
    damageMultiplier: 0.9,
    dashSpeed: 24,
    dashDuration: 0.22,
  },
  starlight_bolt: {
    id: 'starlight_bolt',
    name: 'Starlight Lance',
    kind: 'active',
    description: 'Fire a fast piercing prism bolt that damages distant turret and melee foes.',
    icon: 'star',
    accentColor: '#38bdf8',
    cooldown: 2.6,
    price: 0,
    starterOwned: true,
    damageMultiplier: 1.25,
    projectileSpeed: 28,
  },
  solar_nova: {
    id: 'solar_nova',
    name: 'Solar Nova',
    kind: 'active',
    description: 'Unleash a 360-degree shockwave ring that blasts nearby enemies back.',
    icon: 'nova',
    accentColor: '#c084fc',
    cooldown: 6.0,
    price: 6500,
    damageMultiplier: 1.85,
    radius: 5.4,
  },
  aegis_shield: {
    id: 'aegis_shield',
    name: 'Aegis Barrier',
    kind: 'active',
    description: 'Conjure a sky-crystal barrier (+45 Shield) and immediately mend 20 HP.',
    icon: 'shield',
    accentColor: '#4ade80',
    cooldown: 8.5,
    price: 14000,
    shieldAmount: 45,
    healAmount: 20,
  },
  double_jump: {
    id: 'double_jump',
    name: 'Sky Wings',
    kind: 'mobility',
    description: 'Passive mobility tool: leap a second time in mid-air on golden Aether wings.',
    icon: 'wings',
    accentColor: '#60a5fa',
    cooldown: 0,
    price: 2500,
  },
};

export const SKILL_LIST: SkillDefinition[] = Object.values(SKILLS);
