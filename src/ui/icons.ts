export const ICONS: Record<string, string> = {
  spireLogo: `<svg viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="ig-spire" x1="16" y1="3" x2="16" y2="29" gradientUnits="userSpaceOnUse">
        <stop stop-color="#c084fc"/>
        <stop offset="1" stop-color="#6366f1"/>
      </linearGradient>
    </defs>
    <path d="M16 3L27 15H20.5V28H11.5V15H5L16 3Z" fill="url(#ig-spire)"/>
    <path d="M16 5.5L23.5 13.5H19V26H16V5.5Z" fill="#e9d5ff" fill-opacity="0.32"/>
    <circle cx="16" cy="12.5" r="2.6" fill="#fde68a"/>
  </svg>`,

  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
    <path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h10"/>
  </svg>`,

  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 5h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4.5 3.5V18H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"/>
    <path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 1.8-2.2 2.8"/>
    <circle cx="12" cy="15.6" r="0.9" fill="currentColor" stroke="none"/>
  </svg>`,

  upArrow: `<svg viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="ig-up" x1="16" y1="3" x2="16" y2="29" gradientUnits="userSpaceOnUse">
        <stop stop-color="#d8b4fe"/>
        <stop offset="1" stop-color="#8b5cf6"/>
      </linearGradient>
    </defs>
    <path d="M16 3.5L27.5 15.5H20.5V28.5H11.5V15.5H4.5L16 3.5Z" fill="url(#ig-up)"/>
    <path d="M16 6L24.2 14.5H19V27H16V6Z" fill="#ffffff" fill-opacity="0.22"/>
  </svg>`,

  coin: `<svg viewBox="0 0 28 28" fill="none">
    <defs>
      <linearGradient id="ig-coin" x1="6" y1="4" x2="22" y2="25" gradientUnits="userSpaceOnUse">
        <stop stop-color="#fde047"/>
        <stop offset="0.55" stop-color="#f59e0b"/>
        <stop offset="1" stop-color="#b45309"/>
      </linearGradient>
    </defs>
    <circle cx="14" cy="14" r="11.5" fill="url(#ig-coin)"/>
    <circle cx="14" cy="14" r="9.2" stroke="#fef9c3" stroke-opacity="0.65" stroke-width="1.4"/>
    <path d="M14 7.8l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6L14 7.8Z" fill="#fffbeb"/>
  </svg>`,

  shop: `<svg viewBox="0 0 24 24" fill="none">
    <path d="M3 4.5h2.6l2.2 9.8a1.8 1.8 0 0 0 1.8 1.4h7.8a1.8 1.8 0 0 0 1.7-1.3L21 7.5H6.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="9.5" cy="19.5" r="1.7" fill="currentColor"/>
    <circle cx="17.5" cy="19.5" r="1.7" fill="currentColor"/>
  </svg>`,

  inventory: `<svg viewBox="0 0 24 24" fill="none">
    <rect x="4" y="7.5" width="16" height="13" rx="3.2" stroke="currentColor" stroke-width="2.1"/>
    <path d="M8.8 7.5V5.8a3.2 3.2 0 0 1 6.4 0v1.7" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    <rect x="10.2" y="11.5" width="3.6" height="3.2" rx="0.9" fill="currentColor"/>
  </svg>`,

  leaderboard: `<svg viewBox="0 0 24 24" fill="none">
    <rect x="4" y="12.5" width="4" height="7.5" rx="1.2" fill="currentColor" fill-opacity="0.72"/>
    <rect x="10" y="5" width="4" height="15" rx="1.2" fill="currentColor"/>
    <rect x="16" y="9" width="4" height="11" rx="1.2" fill="currentColor" fill-opacity="0.85"/>
  </svg>`,

  quests: `<svg viewBox="0 0 24 24" fill="none">
    <path d="M12 2.8l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.7l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 2.8Z" fill="currentColor"/>
  </svg>`,

  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3.2"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
  </svg>`,

  gamepad: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.5" y="6.5" width="19" height="11" rx="5"/>
    <path d="M7.5 12h3M9 10.5v3"/>
    <circle cx="15" cy="11" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="17.2" cy="13" r="0.9" fill="currentColor" stroke="none"/>
  </svg>`,

  audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 5L6 9H3v6h3l5 4V5Z"/>
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>
  </svg>`,

  display: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="12.5" rx="2.2"/>
    <path d="M8 20h8M12 16.5V20"/>
  </svg>`,

  keyboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/>
    <path d="M6.5 9.5h1M10.5 9.5h1M14.5 9.5h1M17.5 9.5h1M6.5 13h1M10.5 13h1M14.5 13h3M8 16h8"/>
  </svg>`,

  data: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/>
    <path d="M4.5 5.5v6.5c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V5.5"/>
    <path d="M4.5 12v6.5c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V12"/>
  </svg>`,

  play: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.5 5.2c0-.9 1-1.4 1.8-.9l10.2 6.8c.7.4.7 1.4 0 1.8L9.3 19.7c-.8.5-1.8 0-1.8-.9V5.2Z"/>
  </svg>`,

  leave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 20H5.5A2.5 2.5 0 0 1 3 17.5v-11A2.5 2.5 0 0 1 5.5 4H10"/>
    <path d="M16 17l5-5-5-5M21 12H9.5"/>
  </svg>`,

  check: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4.5 10.5l3.6 3.6L15.8 6.4"/>
  </svg>`,

  plus: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <path d="M10 4.5v11M4.5 10h11"/>
  </svg>`,

  close: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
    <path d="M5 5l10 10M15 5L5 15"/>
  </svg>`,

  chevron: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7.5 5l5 5-5 5"/>
  </svg>`,

  // Illustrated Shaded Game Item Icons
  bolt: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-bolt" x1="12" y1="4" x2="26" y2="36" gradientUnits="userSpaceOnUse">
        <stop stop-color="#fef08a"/>
        <stop offset="0.5" stop-color="#fbbf24"/>
        <stop offset="1" stop-color="#ea580c"/>
      </linearGradient>
    </defs>
    <path d="M22.5 3.5L8.5 21.5h9.2L15.5 36.5 31.5 17.5h-9.6l.6-14Z" fill="url(#ig-bolt)"/>
    <path d="M21.8 6.8L11.5 20.2h7.6l-1.4 10.6L28 18.8h-7.4l1.2-12Z" fill="#fffbeb" fill-opacity="0.45"/>
  </svg>`,

  star: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-star" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
        <stop stop-color="#e0f2fe"/>
        <stop offset="0.5" stop-color="#38bdf8"/>
        <stop offset="1" stop-color="#2563eb"/>
      </linearGradient>
    </defs>
    <path d="M20 3l4.2 12.8L37 20l-12.8 4.2L20 37l-4.2-12.8L3 20l12.8-4.2L20 3Z" fill="url(#ig-star)"/>
    <circle cx="20" cy="20" r="4.2" fill="#f0f9ff"/>
  </svg>`,

  wings: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-wings" x1="6" y1="8" x2="34" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#e0f2fe"/>
        <stop offset="0.55" stop-color="#60a5fa"/>
        <stop offset="1" stop-color="#3b82f6"/>
      </linearGradient>
    </defs>
    <path d="M20 22.5C15.5 14 7.5 10.5 3.5 12c1.4 6.8 6.4 11.8 13.2 13.5-4.4 1.6-7.6 4.4-8.2 7.8 5.2.3 9.8-2.8 11.5-7.4 1.7 4.6 6.3 7.7 11.5 7.4-.6-3.4-3.8-6.2-8.2-7.8 6.8-1.7 11.8-6.7 13.2-13.5-4-1.5-12 2-16.5 10.5Z" fill="url(#ig-wings)"/>
    <path d="M20 20c-3.2-5.8-8.8-8.4-12.2-7.8 1.5 4.2 5 7.5 9.6 8.8L20 20Z" fill="#ffffff" fill-opacity="0.4"/>
  </svg>`,

  nova: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <radialGradient id="ig-nova" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(20 20) scale(16)">
        <stop stop-color="#fdf4ff"/>
        <stop offset="0.45" stop-color="#d946ef"/>
        <stop offset="1" stop-color="#7e22ce"/>
      </radialGradient>
    </defs>
    <circle cx="20" cy="20" r="15" stroke="#c084fc" stroke-width="2.4" stroke-dasharray="5 3.5"/>
    <circle cx="20" cy="20" r="10.5" fill="url(#ig-nova)"/>
    <circle cx="20" cy="20" r="4.5" fill="#fae8ff"/>
  </svg>`,

  shield: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-shield" x1="10" y1="5" x2="30" y2="36" gradientUnits="userSpaceOnUse">
        <stop stop-color="#bae6fd"/>
        <stop offset="0.5" stop-color="#38bdf8"/>
        <stop offset="1" stop-color="#0284c7"/>
      </linearGradient>
    </defs>
    <path d="M20 4.5L33.5 10v9.5c0 8.8-5.8 16.2-13.5 18.2-7.7-2-13.5-9.4-13.5-18.2V10L20 4.5Z" fill="url(#ig-shield)"/>
    <path d="M20 7.2v27.8c6.2-1.8 10.8-8.1 10.8-15.5V11.8L20 7.2Z" fill="#0369a1" fill-opacity="0.28"/>
    <path d="M20 7.2L9.2 11.8v7.7c0 3.2.8 6.2 2.2 8.8L20 7.2Z" fill="#ffffff" fill-opacity="0.32"/>
  </svg>`,

  heart: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-heart" x1="12" y1="7" x2="28" y2="34" gradientUnits="userSpaceOnUse">
        <stop stop-color="#fda4af"/>
        <stop offset="0.45" stop-color="#f43f5e"/>
        <stop offset="1" stop-color="#be123c"/>
      </linearGradient>
    </defs>
    <path d="M20 34.5S7.5 26.8 4.8 19.2C2.5 12.8 6.6 7.2 12.2 7.2c3.4 0 6 1.9 7.8 4.5 1.8-2.6 4.4-4.5 7.8-4.5 5.6 0 9.7 5.6 7.4 12-2.7 7.6-15.2 15.3-15.2 15.3Z" fill="url(#ig-heart)"/>
    <ellipse cx="13" cy="13.5" rx="3.2" ry="2" transform="rotate(-25 13 13.5)" fill="#ffe4e6" fill-opacity="0.6"/>
  </svg>`,

  sword: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-blade" x1="8" y1="6" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stop-color="#f0f9ff"/>
        <stop offset="0.55" stop-color="#38bdf8"/>
        <stop offset="1" stop-color="#0284c7"/>
      </linearGradient>
    </defs>
    <path d="M7 6.5h6.2L29.5 22.8l-5.8 5.8L7.4 12.3 7 6.5Z" fill="url(#ig-blade)"/>
    <path d="M7 6.5l19.4 19.4 2.8-2.8L13.2 6.5H7Z" fill="#ffffff" fill-opacity="0.42"/>
    <path d="M21 31.5l10.5-10.5" stroke="#fbbf24" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M27.5 27.5l5.5 5.5" stroke="#92400e" stroke-width="4" stroke-linecap="round"/>
    <circle cx="34" cy="34" r="2.2" fill="#fde047"/>
  </svg>`,

  shoe: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-shoe" x1="8" y1="12" x2="34" y2="29" gradientUnits="userSpaceOnUse">
        <stop stop-color="#c4b5fd"/>
        <stop offset="0.55" stop-color="#8b5cf6"/>
        <stop offset="1" stop-color="#4f46e5"/>
      </linearGradient>
    </defs>
    <path d="M6.5 27l4.5-13.5 6.8 4.8 8.4-1.5c4.2 0 7.3 3 7.3 6.8V28H6.5v-1Z" fill="url(#ig-shoe)"/>
    <path d="M13 21.5l5.5 2.5M14.5 18.5l4.2 2" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
    <rect x="6" y="28" width="28" height="4" rx="2" fill="#f8fafc"/>
  </svg>`,

  clock: `<svg viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="14.5" fill="#134e4a" stroke="#2dd4bf" stroke-width="3"/>
    <circle cx="20" cy="20" r="11" stroke="#99f6e4" stroke-opacity="0.35" stroke-width="1.2"/>
    <path d="M20 11.5v8.8l5.8 3.4" stroke="#f0fdfa" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  magnet: `<svg viewBox="0 0 40 40" fill="none">
    <path d="M10.5 8.5v11.5a9.5 9.5 0 0 0 19 0V8.5" stroke="#ef4444" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M10.5 8.5v5.5M29.5 8.5v5.5" stroke="#e2e8f0" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M16 5l2.5 3.5-2 2.5M24.5 5L22 8.5l2 2.5" stroke="#fde047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  crown: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-crown" x1="8" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#fef08a"/>
        <stop offset="0.55" stop-color="#f59e0b"/>
        <stop offset="1" stop-color="#b45309"/>
      </linearGradient>
    </defs>
    <path d="M5.5 29.5L8.5 12l7.5 6.5L20 8.5l4 10L31.5 12l3 17.5h-29Z" fill="url(#ig-crown)"/>
    <rect x="6.5" y="30.5" width="27" height="3.5" rx="1.7" fill="#fde68a"/>
    <circle cx="20" cy="23.5" r="2.2" fill="#38bdf8"/>
    <circle cx="12.5" cy="24.5" r="1.6" fill="#f43f5e"/>
    <circle cx="27.5" cy="24.5" r="1.6" fill="#a855f7"/>
  </svg>`,

  tonic: `<svg viewBox="0 0 40 40" fill="none">
    <path d="M15.5 6.5h9M17 6.5v5.8L9.5 25a4.8 4.8 0 0 0 4.1 7.3h12.8A4.8 4.8 0 0 0 30.5 25L23 12.3V6.5" stroke="#a7f3d0" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11.6 23.2h16.8l2 3.6a2.6 2.6 0 0 1-2.3 3.8H11.9a2.6 2.6 0 0 1-2.3-3.8l2-3.6Z" fill="#10b981"/>
    <circle cx="17.5" cy="26.5" r="1.5" fill="#d1fae5"/>
    <circle cx="22.5" cy="28" r="1" fill="#d1fae5"/>
  </svg>`,

  skull: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-skull" x1="20" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
        <stop stop-color="#fda4af"/>
        <stop offset="1" stop-color="#e11d48"/>
      </linearGradient>
    </defs>
    <path d="M20 4.5C11.7 4.5 5 11 5 19c0 5 2.6 9.4 6.6 12v3.5a2 2 0 0 0 2 2h12.8a2 2 0 0 0 2-2V31c4-2.6 6.6-7 6.6-12 0-8-6.7-14.5-15-14.5Z" fill="url(#ig-skull)"/>
    <circle cx="14.5" cy="19.5" r="3.1" fill="#1f1224"/>
    <circle cx="25.5" cy="19.5" r="3.1" fill="#1f1224"/>
    <path d="M18.2 25.5L20 22.8l1.8 2.7h-3.6Z" fill="#1f1224"/>
    <path d="M16 32.5v3.5M20 32.5v3.5M24 32.5v3.5" stroke="#1f1224" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  trophy: `<svg viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="ig-trophy" x1="12" y1="6" x2="28" y2="34" gradientUnits="userSpaceOnUse">
        <stop stop-color="#fef08a"/>
        <stop offset="1" stop-color="#d97706"/>
      </linearGradient>
    </defs>
    <path d="M11.5 6.5h17v8.5a8.5 8.5 0 0 1-17 0V6.5Z" fill="url(#ig-trophy)"/>
    <path d="M11.5 9.5H6.8v3a5 5 0 0 0 4.7 5M28.5 9.5h4.7v3a5 5 0 0 1-4.7 5" stroke="#fbbf24" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M20 23.5v6.5M13.5 31.5h13" stroke="#fde68a" stroke-width="3.2" stroke-linecap="round"/>
  </svg>`,
};

export function getIconSvg(name: string): string {
  return ICONS[name] ?? ICONS.star;
}
