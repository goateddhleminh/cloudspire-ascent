"""
Deterministic RGBA Particle & UI Emblem Generator for Cloudspire Ascent.
Ensures true alpha channels and bleeds RGB color into alpha=0 pixels to prevent dark fringes.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PARTICLES_DIR = os.path.join(ROOT, "public", "assets", "particles")
UI_DIR = os.path.join(ROOT, "public", "assets", "ui")

os.makedirs(PARTICLES_DIR, exist_ok=True)
os.makedirs(UI_DIR, exist_ok=True)


def bleed_rgb_into_alpha(img: Image.Image, base_rgb=(255, 255, 255)) -> Image.Image:
    """Prevents dark bilinear filtering halos by ensuring alpha=0 pixels carry clean RGB."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (base_rgb[0], base_rgb[1], base_rgb[2], 0)
    return img


def make_spark_star(path: str, size: int = 128):
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    px = img.load()
    c = (size - 1) / 2.0
    r_max = size * 0.48
    for y in range(size):
        for x in range(size):
            dx = (x - c) / r_max
            dy = (y - c) / r_max
            dist = math.hypot(dx, dy)
            if dist >= 1.0:
                continue
            # 4-point star spike + hot circular core
            spike_x = max(0.0, 1.0 - abs(dy) * 5.2) * max(0.0, 1.0 - abs(dx))
            spike_y = max(0.0, 1.0 - abs(dx) * 5.2) * max(0.0, 1.0 - abs(dy))
            diag = max(0.0, 1.0 - abs(abs(dx) - abs(dy)) * 8.5) * max(0.0, 0.65 - dist)
            core = max(0.0, 1.0 - dist * 2.4) ** 2.2
            val = min(1.0, core + max(spike_x, spike_y) * 0.92 + diag * 0.55)
            val *= max(0.0, 1.0 - dist ** 2.5)
            a = int(round(val * 255))
            if a > 0:
                px[x, y] = (255, 255, 255, a)
    bleed_rgb_into_alpha(img).save(path)


def make_slash_crescent(path: str, size: int = 256):
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    px = img.load()
    c = (size - 1) / 2.0
    for y in range(size):
        for x in range(size):
            nx = (x - c) / (size * 0.46)
            ny = (y - c) / (size * 0.46)
            r = math.hypot(nx, ny)
            ang = math.atan2(ny, nx)  # -pi..pi, crescent centered around -pi/2 (forward!)
            ang_diff = abs(((ang + math.pi / 2 + math.pi) % math.tau) - math.pi)
            if ang_diff > 1.38 or r < 0.42 or r > 0.98:
                continue
            arc_fade = math.cos((ang_diff / 1.38) * (math.pi / 2)) ** 1.35
            # Sharp outer blade edge, soft inner wake
            radial = 1.0 - abs((r - 0.78) / 0.22) ** 1.5 if r >= 0.56 else max(0.0, (r - 0.42) / 0.14) * 0.45
            val = max(0.0, min(1.0, arc_fade * max(0.0, radial)))
            a = int(round(val * 255))
            if a > 0:
                tint = int(215 + 40 * min(1.0, r))
                px[x, y] = (tint, 245, 255, a)
    bleed_rgb_into_alpha(img, (230, 248, 255)).save(path)


def make_hit_ring(path: str, size: int = 256):
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    px = img.load()
    c = (size - 1) / 2.0
    for y in range(size):
        for x in range(size):
            nx = (x - c) / (size * 0.46)
            ny = (y - c) / (size * 0.46)
            r = math.hypot(nx, ny)
            if r > 1.0 or r < 0.46:
                continue
            band = max(0.0, 1.0 - abs(r - 0.82) / 0.16) ** 1.8
            inner_glow = max(0.0, 1.0 - abs(r - 0.68) / 0.20) * 0.35
            val = min(1.0, band + inner_glow)
            a = int(round(val * 255))
            if a > 0:
                px[x, y] = (255, 255, 255, a)
    bleed_rgb_into_alpha(img).save(path)


def make_smoke_puff(path: str, size: int = 128):
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    blobs = [
        (64, 64, 34, 215),
        (46, 58, 24, 185),
        (82, 60, 25, 185),
        (58, 44, 22, 170),
        (72, 80, 23, 175),
    ]
    for bx, by, br, ba in blobs:
        draw.ellipse((bx - br, by - br, bx + br, by + br), fill=(248, 250, 252, ba))
    img = img.filter(ImageFilter.GaussianBlur(radius=6.5))
    # Guarantee outer border is 0 alpha
    px = img.load()
    c = (size - 1) / 2.0
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c) / (size * 0.48)
            r, g, b, a = px[x, y]
            fade = max(0.0, 1.0 - d ** 3.2)
            na = int(round(a * fade))
            px[x, y] = (248, 250, 252, na)
    bleed_rgb_into_alpha(img, (248, 250, 252)).save(path)


def make_rune_mote(path: str, size: int = 128):
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    px = img.load()
    c = (size - 1) / 2.0
    half = size * 0.42
    for y in range(size):
        for x in range(size):
            dx = abs(x - c) / half
            dy = abs(y - c) / half
            manhattan = dx + dy * 0.72
            if manhattan >= 1.0:
                continue
            edge = (1.0 - manhattan) ** 1.4
            hollow = 0.55 if 0.36 < manhattan < 0.54 else 1.0
            a = int(round(min(1.0, edge * hollow * 1.15) * 255))
            if a > 0:
                px[x, y] = (255, 255, 255, a)
    bleed_rgb_into_alpha(img).save(path)


def make_crit_flare(path: str, size: int = 256):
    img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    px = img.load()
    c = (size - 1) / 2.0
    rm = size * 0.48
    for y in range(size):
        for x in range(size):
            dx = (x - c) / rm
            dy = (y - c) / rm
            d = math.hypot(dx, dy)
            if d >= 1.0:
                continue
            ang = math.atan2(dy, dx)
            rays8 = (abs(math.cos(ang * 4)) ** 8) * max(0.0, 1.0 - d)
            core = max(0.0, 1.0 - d * 2.8) ** 1.8
            ring = max(0.0, 1.0 - abs(d - 0.44) / 0.08) * 0.55
            val = min(1.0, core + rays8 * 0.85 + ring) * max(0.0, 1.0 - d ** 3)
            a = int(round(val * 255))
            if a > 0:
                px[x, y] = (255, 248, 220, a)
    bleed_rgb_into_alpha(img, (255, 248, 220)).save(path)


def make_ui_emblems():
    # 1. Cloudspire Crest Emblem (128x128 RGBA)
    size = 128
    img = Image.new("RGBA", (size, size), (56, 189, 248, 0))
    draw = ImageDraw.Draw(img)
    # Outer diamond shield
    draw.polygon([(64, 8), (116, 46), (98, 114), (64, 122), (30, 114), (12, 46)], fill=(24, 35, 64, 245), outline=(96, 165, 250, 255))
    draw.polygon([(64, 16), (106, 48), (91, 106), (64, 113), (37, 106), (22, 48)], fill=(36, 52, 92, 255))
    # Ascending spire arrow
    draw.polygon([(64, 22), (94, 56), (76, 56), (76, 98), (52, 98), (52, 56), (34, 56)], fill=(168, 85, 247, 255))
    draw.polygon([(64, 22), (94, 56), (76, 56), (76, 98), (64, 98)], fill=(192, 132, 252, 255))
    # Golden star core
    draw.ellipse((55, 44, 73, 62), fill=(251, 191, 36, 255))
    bleed_rgb_into_alpha(img, (56, 189, 248)).save(os.path.join(UI_DIR, "emblem_cloudspire.png"))

    # 2. Victory Crest (128x128 RGBA)
    vimg = Image.new("RGBA", (size, size), (251, 191, 36, 0))
    vd = ImageDraw.Draw(vimg)
    vd.ellipse((14, 14, 114, 114), fill=(45, 34, 18, 235), outline=(251, 191, 36, 255), width=4)
    vd.polygon([(26, 86), (34, 42), (52, 58), (64, 30), (76, 58), (94, 42), (102, 86)], fill=(251, 191, 36, 255))
    vd.rectangle((30, 89, 98, 97), fill=(254, 240, 138, 255))
    vd.ellipse((58, 64, 70, 76), fill=(56, 189, 248, 255))
    bleed_rgb_into_alpha(vimg, (251, 191, 36)).save(os.path.join(UI_DIR, "badge_victory.png"))

    # 3. Defeat Crest (128x128 RGBA)
    dimg = Image.new("RGBA", (size, size), (244, 63, 94, 0))
    dd = ImageDraw.Draw(dimg)
    dd.ellipse((14, 14, 114, 114), fill=(48, 18, 30, 235), outline=(244, 63, 94, 255), width=4)
    dd.polygon([(64, 24), (88, 52), (76, 102), (52, 102), (40, 52)], fill=(251, 113, 133, 255))
    dd.line([(48, 42), (78, 86)], fill=(30, 12, 22, 255), width=5)
    dd.line([(76, 56), (54, 72)], fill=(30, 12, 22, 255), width=4)
    bleed_rgb_into_alpha(dimg, (244, 63, 94)).save(os.path.join(UI_DIR, "badge_defeat.png"))


if __name__ == "__main__":
    make_spark_star(os.path.join(PARTICLES_DIR, "fx_spark_star.png"), 128)
    make_slash_crescent(os.path.join(PARTICLES_DIR, "fx_slash_crescent.png"), 256)
    make_hit_ring(os.path.join(PARTICLES_DIR, "fx_hit_ring.png"), 256)
    make_smoke_puff(os.path.join(PARTICLES_DIR, "fx_smoke_puff.png"), 128)
    make_rune_mote(os.path.join(PARTICLES_DIR, "fx_rune_mote.png"), 128)
    make_crit_flare(os.path.join(PARTICLES_DIR, "fx_crit_flare.png"), 256)
    make_ui_emblems()
    print("SUCCESS: Generated 9 RGBA VFX & UI PNG assets.")
