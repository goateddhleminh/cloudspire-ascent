"""
Procedural Studio .WAV Sound Effect & Adaptive Music Stem Generator for Cloudspire Ascent.
Outputs 44.1 kHz, 16-bit PCM mono/stereo WAV files normalized safely below -1.5 dBTP (0.84 peak).
"""
import math
import os
import random
import struct
import wave

SAMPLE_RATE = 44100
PEAK_LIMIT = 0.82  # ~ -1.7 dBTP safe headroom per audio-design skill

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SFX_DIR = os.path.join(ROOT, "public", "assets", "audio", "sfx")
MUSIC_DIR = os.path.join(ROOT, "public", "assets", "audio", "music")
os.makedirs(SFX_DIR, exist_ok=True)
os.makedirs(MUSIC_DIR, exist_ok=True)


def save_wav(path: str, samples: list[float], peak: float = PEAK_LIMIT):
    max_abs = max((abs(s) for s in samples), default=1e-6)
    scale = (peak / max_abs) if max_abs > 1e-5 else 1.0
    # Apply tiny 4ms fade-in/out to prevent clicks unless already loop-seamless
    fade = min(180, len(samples) // 8)
    buf = bytearray()
    n = len(samples)
    for i, s in enumerate(samples):
        env = 1.0
        if i < fade:
            env = i / max(1, fade)
        elif i > n - fade:
            env = (n - i) / max(1, fade)
        val = max(-1.0, min(1.0, s * scale * env))
        buf += struct.pack("<h", int(round(val * 32767)))

    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(bytes(buf))


def save_seamless_loop_wav(path: str, raw_samples: list[float], xfade_sec: float = 0.6, peak: float = 0.65):
    xf = int(xfade_sec * SAMPLE_RATE)
    body = raw_samples[:-xf]
    tail = raw_samples[-xf:]
    out = list(body)
    for i in range(xf):
        a = i / xf
        # Equal-power crossfade tail into head
        out[i] = body[i] * math.sin(a * math.pi * 0.5) + tail[i] * math.cos(a * math.pi * 0.5)
    max_abs = max((abs(s) for s in out), default=1e-6)
    scale = peak / max_abs
    buf = bytearray()
    for s in out:
        val = max(-1.0, min(1.0, s * scale))
        buf += struct.pack("<h", int(round(val * 32767)))
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(bytes(buf))


def adsr(t: float, dur: float, atk: float = 0.008, dec: float = 0.08, sus: float = 0.35) -> float:
    if t < 0 or t >= dur:
        return 0.0
    if t < atk:
        return t / max(1e-5, atk)
    if t < atk + dec:
        return 1.0 - (1.0 - sus) * ((t - atk) / max(1e-5, dec))
    rem = max(1e-5, dur - (atk + dec))
    return sus * max(0.0, 1.0 - (t - atk - dec) / rem) ** 1.6


def make_slash(seed: int, pitch_mul: float, dur: float = 0.22, finisher: bool = False) -> list[float]:
    rng = random.Random(seed)
    n = int(dur * SAMPLE_RATE)
    out = [0.0] * n
    lp = 0.0
    phase = 0.0
    shimmer_p = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        p = t / dur
        # Filtered airy whoosh (sweeping low-pass coefficient)
        cutoff = (0.10 + 0.52 * math.sin(p * math.pi)) * pitch_mul
        white = rng.uniform(-1.0, 1.0)
        lp += min(0.92, cutoff) * (white - lp)
        whoosh_env = math.sin(p * math.pi) ** 1.3

        # Sword tonal sweep + metallic ring
        freq = (540 * (1.0 - p * 0.62) + 140) * pitch_mul
        phase += math.tau * freq / SAMPLE_RATE
        shimmer_p += math.tau * (1680 * pitch_mul) / SAMPLE_RATE
        blade = math.sin(phase) * math.exp(-t * 14) * 0.55
        ring = math.sin(shimmer_p) * math.exp(-t * (9 if finisher else 18)) * (0.42 if finisher else 0.20)
        sub = math.sin(math.tau * (140 * (1.0 - p * 0.5)) * t) * math.exp(-t * 16) * (0.65 if finisher else 0.25)
        out[i] = lp * whoosh_env * 0.85 + blade + ring + sub
    return out


def make_mob_hit(seed: int, pitch_mul: float, crit: bool = False) -> list[float]:
    rng = random.Random(seed)
    dur = 0.28 if crit else 0.17
    n = int(dur * SAMPLE_RATE)
    out = [0.0] * n
    phase = 0.0
    lp = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        # Sub-bass punch drop (190Hz -> 52Hz)
        f_punch = (230 if crit else 185) * pitch_mul * math.exp(-t * 22) + 48
        phase += math.tau * f_punch / SAMPLE_RATE
        punch = math.sin(phase) * math.exp(-t * 16) * 0.95

        # Crisp transient snap + crystalline construct crackle
        snap = rng.uniform(-1.0, 1.0) * math.exp(-t * 58) * 0.85
        lp += 0.35 * (rng.uniform(-1.0, 1.0) - lp)
        crunch = lp * math.exp(-t * 26) * 0.45

        # Construct crystal harmonic ping
        ping = (
            math.sin(math.tau * 980 * pitch_mul * t) * 0.28
            + math.sin(math.tau * 1480 * pitch_mul * t) * (0.32 if crit else 0.16)
        ) * math.exp(-t * (11 if crit else 20))

        out[i] = math.tanh((punch + snap + crunch + ping) * 1.35)
    return out


def make_chime_seq(notes: list[tuple[float, float, float]], shimmer: bool = True) -> list[float]:
    """notes: list of (start_sec, freq, dur_sec)"""
    total = max(st + d for st, _, d in notes) + 0.08
    n = int(total * SAMPLE_RATE)
    out = [0.0] * n
    for st, freq, d in notes:
        i0 = int(st * SAMPLE_RATE)
        cnt = int(d * SAMPLE_RATE)
        for j in range(cnt):
            if i0 + j >= n:
                break
            t = j / SAMPLE_RATE
            env = adsr(t, d, 0.005, 0.06, 0.42)
            s = math.sin(math.tau * freq * t) * 0.68 + math.sin(math.tau * freq * 2.0 * t) * (0.24 if shimmer else 0.08)
            if shimmer:
                s += math.sin(math.tau * freq * 3.01 * t) * 0.10 * math.exp(-t * 12)
            out[i0 + j] += s * env
    return out


def generate_all_sfx():
    # 1. Melee Slashes (3 combo steps)
    save_wav(os.path.join(SFX_DIR, "sfx_slash_01.wav"), make_slash(101, 1.00, 0.19, False), 0.75)
    save_wav(os.path.join(SFX_DIR, "sfx_slash_02.wav"), make_slash(102, 1.14, 0.20, False), 0.76)
    save_wav(os.path.join(SFX_DIR, "sfx_slash_03_finisher.wav"), make_slash(103, 0.88, 0.29, True), 0.82)

    # 2. Mob Hit Impacts (3 light variations + 1 heavy finisher/crit + dummy bonk)
    save_wav(os.path.join(SFX_DIR, "sfx_hit_light_01.wav"), make_mob_hit(201, 0.96, False), 0.80)
    save_wav(os.path.join(SFX_DIR, "sfx_hit_light_02.wav"), make_mob_hit(202, 1.05, False), 0.80)
    save_wav(os.path.join(SFX_DIR, "sfx_hit_light_03.wav"), make_mob_hit(203, 1.13, False), 0.80)
    save_wav(os.path.join(SFX_DIR, "sfx_hit_crit.wav"), make_mob_hit(204, 0.90, True), 0.84)

    # Dummy wooden spring bonk
    n_bonk = int(0.24 * SAMPLE_RATE)
    bonk = [
        (math.sin(math.tau * (260 + 18 * math.sin(42 * (i / SAMPLE_RATE))) * (i / SAMPLE_RATE)) * 0.7
         + math.sin(math.tau * 510 * (i / SAMPLE_RATE)) * 0.35)
        * math.exp(-(i / SAMPLE_RATE) * 15)
        for i in range(n_bonk)
    ]
    save_wav(os.path.join(SFX_DIR, "sfx_dummy_bonk.wav"), bonk, 0.76)

    # 3. Enemy Telegraph, Shoot, Shockwave & Defeat Shatter
    n_wu = int(0.32 * SAMPLE_RATE)
    windup = [
        math.sin(math.tau * (260 + 480 * ((i / n_wu) ** 1.6)) * (i / SAMPLE_RATE))
        * math.sin((i / n_wu) * math.pi)
        for i in range(n_wu)
    ]
    save_wav(os.path.join(SFX_DIR, "sfx_enemy_windup.wav"), windup, 0.62)

    n_sh = int(0.20 * SAMPLE_RATE)
    shoot = [
        math.sin(math.tau * (920 * math.exp(-(i / SAMPLE_RATE) * 10) + 180) * (i / SAMPLE_RATE))
        * math.exp(-(i / SAMPLE_RATE) * 14)
        for i in range(n_sh)
    ]
    save_wav(os.path.join(SFX_DIR, "sfx_enemy_shoot.wav"), shoot, 0.70)

    rng = random.Random(305)
    n_sw = int(0.42 * SAMPLE_RATE)
    shock = []
    lp = 0.0
    for i in range(n_sw):
        t = i / SAMPLE_RATE
        lp += 0.14 * (rng.uniform(-1, 1) - lp)
        boom = math.sin(math.tau * (135 * math.exp(-t * 7) + 38) * t) * math.exp(-t * 6.5)
        shock.append(boom * 0.85 + lp * math.exp(-t * 8.0) * 0.55)
    save_wav(os.path.join(SFX_DIR, "sfx_enemy_shockwave.wav"), shock, 0.82)

    # Enemy Defeat Crystalline Shatter + Ascension Chime
    shatter = make_mob_hit(309, 0.84, True)
    chime = make_chime_seq([(0.02, 523.25, 0.16), (0.07, 783.99, 0.20), (0.12, 1046.5, 0.26)])
    L = max(len(shatter), len(chime))
    defeat_mob = [(shatter[i] * 0.65 if i < len(shatter) else 0) + (chime[i] * 0.55 if i < len(chime) else 0) for i in range(L)]
    save_wav(os.path.join(SFX_DIR, "sfx_enemy_defeat.wav"), defeat_mob, 0.82)

    # 4. Active Skills (Dash, Starlight Lance, Solar Nova, Aegis Shield)
    dash = make_slash(401, 1.38, 0.24, True)
    save_wav(os.path.join(SFX_DIR, "sfx_skill_dash.wav"), dash, 0.78)

    lance = make_chime_seq([(0.0, 880.0, 0.16), (0.02, 1318.5, 0.22), (0.05, 1760.0, 0.24)])
    save_wav(os.path.join(SFX_DIR, "sfx_skill_lance.wav"), lance, 0.78)

    nova_chime = make_chime_seq([(0.0, 293.66, 0.35), (0.03, 587.33, 0.38), (0.06, 880.0, 0.42)])
    Ln = max(len(shock), len(nova_chime))
    nova = [(shock[i] * 0.75 if i < len(shock) else 0) + (nova_chime[i] * 0.55 if i < len(nova_chime) else 0) for i in range(Ln)]
    save_wav(os.path.join(SFX_DIR, "sfx_skill_nova.wav"), nova, 0.84)

    shield_sfx = make_chime_seq([(0.0, 440.0, 0.24), (0.05, 659.25, 0.28), (0.10, 880.0, 0.34)])
    save_wav(os.path.join(SFX_DIR, "sfx_skill_shield.wav"), shield_sfx, 0.76)

    # 5. Movement & World (Footsteps, Jump, Double Jump, Land, JumpPad, Coins, Chest, Shrine, Tonic, Portal)
    for idx, p_mul in enumerate([0.95, 1.08], start=1):
        r_st = random.Random(500 + idx)
        n_st = int(0.085 * SAMPLE_RATE)
        lp_s = 0.0
        st_arr = []
        for i in range(n_st):
            t = i / SAMPLE_RATE
            lp_s += 0.22 * p_mul * (r_st.uniform(-1, 1) - lp_s)
            thud = math.sin(math.tau * 115 * p_mul * math.exp(-t * 28) * t) * math.exp(-t * 34)
            st_arr.append(thud * 0.65 + lp_s * math.exp(-t * 36) * 0.55)
        save_wav(os.path.join(SFX_DIR, f"sfx_step_0{idx}.wav"), st_arr, 0.48)

    n_jmp = int(0.16 * SAMPLE_RATE)
    jmp = [math.sin(math.tau * (250 + 340 * (i / n_jmp)) * (i / SAMPLE_RATE)) * adsr(i / SAMPLE_RATE, 0.16, 0.008, 0.05, 0.35) for i in range(n_jmp)]
    save_wav(os.path.join(SFX_DIR, "sfx_jump.wav"), jmp, 0.68)

    djmp = make_chime_seq([(0.0, 523.25, 0.14), (0.04, 783.99, 0.18), (0.08, 1174.66, 0.22)])
    save_wav(os.path.join(SFX_DIR, "sfx_double_jump.wav"), djmp, 0.74)

    n_lnd = int(0.12 * SAMPLE_RATE)
    lnd = [math.sin(math.tau * (145 * math.exp(-(i / SAMPLE_RATE) * 24) + 45) * (i / SAMPLE_RATE)) * math.exp(-(i / SAMPLE_RATE) * 22) for i in range(n_lnd)]
    save_wav(os.path.join(SFX_DIR, "sfx_land.wav"), lnd, 0.58)

    jpad = make_chime_seq([(0.0, 392.0, 0.15), (0.03, 587.33, 0.18), (0.06, 783.99, 0.22), (0.09, 1174.66, 0.26)])
    save_wav(os.path.join(SFX_DIR, "sfx_jumppad.wav"), jpad, 0.76)

    save_wav(os.path.join(SFX_DIR, "sfx_coin_01.wav"), make_chime_seq([(0.0, 987.77, 0.09), (0.045, 1318.51, 0.16)]), 0.68)
    save_wav(os.path.join(SFX_DIR, "sfx_coin_02.wav"), make_chime_seq([(0.0, 1046.50, 0.09), (0.045, 1567.98, 0.16)]), 0.68)

    chest = make_chime_seq([(0.0, 392.0, 0.12), (0.07, 523.25, 0.14), (0.14, 659.25, 0.18), (0.21, 1046.5, 0.34)])
    save_wav(os.path.join(SFX_DIR, "sfx_chest_open.wav"), chest, 0.78)

    shrine = make_chime_seq([(0.0, 440.0, 0.22), (0.08, 554.37, 0.24), (0.16, 659.25, 0.28), (0.24, 880.0, 0.42)])
    save_wav(os.path.join(SFX_DIR, "sfx_shrine_bless.wav"), shrine, 0.76)

    tonic = make_chime_seq([(0.0, 523.25, 0.14), (0.06, 659.25, 0.18), (0.12, 880.0, 0.26)])
    save_wav(os.path.join(SFX_DIR, "sfx_tonic_drink.wav"), tonic, 0.74)

    portal = make_chime_seq([(0.0, 329.63, 0.26), (0.06, 493.88, 0.28), (0.12, 659.25, 0.32), (0.18, 987.77, 0.45)])
    save_wav(os.path.join(SFX_DIR, "sfx_portal_enter.wav"), portal, 0.78)

    # 6. Player Hurt, Shield Block, UI & Fanfare Stingers
    hurt = make_mob_hit(601, 0.62, True)
    save_wav(os.path.join(SFX_DIR, "sfx_player_hurt.wav"), hurt, 0.80)

    block = make_chime_seq([(0.0, 740.0, 0.12), (0.02, 1108.73, 0.16)])
    save_wav(os.path.join(SFX_DIR, "sfx_shield_block.wav"), block, 0.74)

    save_wav(os.path.join(SFX_DIR, "sfx_ui_hover.wav"), make_chime_seq([(0.0, 780.0, 0.045)], shimmer=False), 0.36)
    save_wav(os.path.join(SFX_DIR, "sfx_ui_click.wav"), make_chime_seq([(0.0, 640.0, 0.05), (0.025, 920.0, 0.07)], shimmer=False), 0.55)
    save_wav(os.path.join(SFX_DIR, "sfx_ui_buy.wav"), make_chime_seq([(0.0, 523.25, 0.09), (0.06, 659.25, 0.11), (0.12, 1046.5, 0.22)]), 0.74)
    save_wav(os.path.join(SFX_DIR, "sfx_ui_error.wav"), make_chime_seq([(0.0, 233.08, 0.12), (0.09, 174.61, 0.18)], shimmer=False), 0.66)

    lvup = make_chime_seq([(0.0, 440.0, 0.18), (0.07, 554.37, 0.20), (0.14, 659.25, 0.24), (0.22, 880.0, 0.46)])
    save_wav(os.path.join(SFX_DIR, "sfx_level_up.wav"), lvup, 0.80)

    fl_clr = make_chime_seq([(0.0, 523.25, 0.18), (0.08, 659.25, 0.20), (0.16, 783.99, 0.22), (0.24, 1046.5, 0.50)])
    save_wav(os.path.join(SFX_DIR, "sfx_floor_clear.wav"), fl_clr, 0.80)

    victory = make_chime_seq([
        (0.0, 523.25, 0.18), (0.11, 659.25, 0.18), (0.22, 783.99, 0.20),
        (0.34, 1046.5, 0.30), (0.50, 1318.5, 0.62)
    ])
    save_wav(os.path.join(SFX_DIR, "sfx_victory.wav"), victory, 0.82)

    defeat = make_chime_seq([
        (0.0, 392.0, 0.24), (0.16, 349.23, 0.24), (0.32, 311.13, 0.26), (0.48, 261.63, 0.55)
    ], shimmer=False)
    save_wav(os.path.join(SFX_DIR, "sfx_defeat.wav"), defeat, 0.74)


def generate_music_and_ambience():
    # 1. Sky Wind Ambience Loop (8.0s seamless)
    rng = random.Random(777)
    dur_w = 8.6
    nw = int(dur_w * SAMPLE_RATE)
    lp1 = 0.0
    lp2 = 0.0
    wind = []
    for i in range(nw):
        t = i / SAMPLE_RATE
        w = rng.uniform(-1.0, 1.0)
        mod = 0.032 + 0.018 * math.sin(math.tau * t / 4.0)
        lp1 += mod * (w - lp1)
        lp2 += 0.06 * (lp1 - lp2)
        chime_whisper = math.sin(math.tau * 523.25 * t) * (0.05 * (0.5 + 0.5 * math.sin(math.tau * t / 8.0)))
        wind.append(lp2 * 0.85 + chime_whisper)
    save_seamless_loop_wav(os.path.join(MUSIC_DIR, "ambience_sky_wind_loop.wav"), wind, xfade_sec=0.6, peak=0.42)

    # 2. Sanctuary Hub Loop (12.8s dreamy Lydian sky-pad + harp arpeggio @ 75 BPM)
    chords = [
        [261.63, 329.63, 392.00, 493.88],  # Cmaj7
        [293.66, 369.99, 440.00, 554.37],  # Dmaj7/9 lift
        [220.00, 329.63, 392.00, 493.88],  # Am9
        [349.23, 440.00, 523.25, 659.25],  # Fmaj7#11
    ]
    bar_dur = 3.2
    total_s = bar_dur * len(chords) + 0.8
    ns = int(total_s * SAMPLE_RATE)
    hub_buf = [0.0] * ns
    for c_idx, freqs in enumerate(chords):
        st = c_idx * bar_dur
        i0 = int(st * SAMPLE_RATE)
        cnt = int((bar_dur + 0.7) * SAMPLE_RATE)
        for j in range(cnt):
            if i0 + j >= ns:
                break
            t = j / SAMPLE_RATE
            pad_env = math.sin(min(1.0, t / (bar_dur + 0.7)) * math.pi) ** 0.85
            pad = sum(math.sin(math.tau * (f * 0.5) * t) * 0.22 + math.sin(math.tau * f * t) * 0.16 for f in freqs)
            hub_buf[i0 + j] += pad * pad_env
        # Gentle harp notes across the bar
        for step in range(8):
            note_f = freqs[step % len(freqs)] * (2.0 if step >= 4 else 1.0)
            nst = st + step * (bar_dur / 8.0)
            ni0 = int(nst * SAMPLE_RATE)
            ncnt = int(0.65 * SAMPLE_RATE)
            for j in range(ncnt):
                if ni0 + j >= ns:
                    break
                nt = j / SAMPLE_RATE
                hub_buf[ni0 + j] += math.sin(math.tau * note_f * nt) * math.exp(-nt * 5.8) * 0.18
    save_seamless_loop_wav(os.path.join(MUSIC_DIR, "music_sanctuary_loop.wav"), hub_buf, xfade_sec=0.8, peak=0.58)

    # 3. Tower Combat Ascent Loop (9.6s energetic synth-orchestral pulse @ 120 BPM)
    combat_roots = [146.83, 174.61, 130.81, 164.81]  # D3, F3, C3, E3 heroic minor ascent
    cbar = 2.0  # 4 beats at 120 BPM
    ctotal = cbar * len(combat_roots) + 0.6
    nc = int(ctotal * SAMPLE_RATE)
    cbuf = [0.0] * nc
    beat = 0.5
    eighth = 0.25
    for b_idx, root_f in enumerate(combat_roots):
        bst = b_idx * cbar
        arp_ratios = [1.0, 1.5, 2.0, 2.4, 2.0, 1.5, 2.0, 3.0]
        for s_i, ratio in enumerate(arp_ratios):
            t0 = bst + s_i * eighth
            i0 = int(t0 * SAMPLE_RATE)
            # Driving bass pulse + crystal lead arpeggio
            for j in range(int(eighth * 1.2 * SAMPLE_RATE)):
                if i0 + j >= nc:
                    break
                lt = j / SAMPLE_RATE
                bass = math.tanh(math.sin(math.tau * (root_f * 0.5) * lt) * 1.8) * math.exp(-lt * 9.5) * 0.30
                arp = (math.sin(math.tau * root_f * ratio * lt) + 0.35 * math.sin(math.tau * root_f * ratio * 2 * lt)) * math.exp(-lt * 8.0) * 0.22
                cbuf[i0 + j] += bass + arp
        # Soft kick pulse on every beat
        for k in range(4):
            ki0 = int((bst + k * beat) * SAMPLE_RATE)
            for j in range(int(0.16 * SAMPLE_RATE)):
                if ki0 + j >= nc:
                    break
                kt = j / SAMPLE_RATE
                kick = math.sin(math.tau * (120 * math.exp(-kt * 24) + 46) * kt) * math.exp(-kt * 16) * 0.36
                cbuf[ki0 + j] += kick
    save_seamless_loop_wav(os.path.join(MUSIC_DIR, "music_combat_loop.wav"), cbuf, xfade_sec=0.6, peak=0.60)


if __name__ == "__main__":
    generate_all_sfx()
    generate_music_and_ambience()
    print("SUCCESS: Generated all 31 studio .wav SFX, ambience & music tracks.")
