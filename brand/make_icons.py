"""Builds the favicon, app icon, header logo masks and share card from the supplied artwork and a bold icon drawn here."""
import math, shutil
from PIL import Image, ImageDraw
import numpy as np

NAVY = "#08192C"; GREEN = "#6cc79b"
SRC = "inkwell-logo-original.webp"
OUT = ["../web/public", "../admin/public"]

# ---------- bold icon geometry (64 x 64) ----------
def cubic(p0, p1, p2, p3, n=24):
    return [tuple((1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t**2*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3)) for t in [i/n for i in range(n+1)]]

FEATHER = [("M", (31, 38)), ("C", (22, 30), (24, 14), (47, 8)), ("C", (48, 24), (42, 35), (32, 39)), ("Z",)]
POT = [("M", (19, 49)), ("C", (19, 44.5), (22.5, 43), (25, 43)), ("L", (39, 43)), ("C", (41.5, 43), (45, 44.5), (45, 49)),
       ("C", (45, 54), (42, 57), (38.5, 57)), ("L", (25.5, 57)), ("C", (22, 57), (19, 54), (19, 49)), ("Z",)]
HIGHLIGHT = [("M", (24, 47)), ("C", (23.5, 50), (25, 52.5), (27.5, 53.5))]
VEIN = ((32, 37), (43, 15))
RIM = (22, 38.5, 42, 43.5, 2.5)
LEAF = (22.5, 15.5, 4.3, 2.6, -38)

def svg_path(cmds):
    out = []
    for c in cmds:
        if c[0] == "M": out.append("M%g %g" % c[1])
        elif c[0] == "L": out.append("L%g %g" % c[1])
        elif c[0] == "C": out.append("C" + " ".join("%g %g" % p for p in c[1:]))
        else: out.append("Z")
    return "".join(out)

def poly(cmds):
    pts, cur = [], None
    for c in cmds:
        if c[0] in "ML": cur = c[1]; pts.append(cur)
        elif c[0] == "C": pts += cubic(cur, *c[1:])[1:]; cur = c[3]
    return pts

def icon_svg():
    cx, cy, rx, ry, rot = LEAF
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="{NAVY}"/>
  <path d="{svg_path(FEATHER)}" fill="#fff"/>
  <line x1="{VEIN[0][0]}" y1="{VEIN[0][1]}" x2="{VEIN[1][0]}" y2="{VEIN[1][1]}" stroke="{NAVY}" stroke-width="2.2" stroke-linecap="round"/>
  <rect x="{RIM[0]}" y="{RIM[1]}" width="{RIM[2]-RIM[0]}" height="{RIM[3]-RIM[1]}" rx="{RIM[4]}" fill="#fff"/>
  <path d="{svg_path(POT)}" fill="#fff"/>
  <path d="{svg_path(HIGHLIGHT)}" fill="none" stroke="{NAVY}" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({rot} {cx} {cy})" fill="{GREEN}"/>
</svg>
'''

def icon_png(size):
    S = 8; N = 64 * S
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    sc = lambda pts: [(x*S, y*S) for x, y in pts]
    d.rounded_rectangle((0, 0, N-1, N-1), radius=14*S, fill=NAVY)
    d.polygon(sc(poly(FEATHER)), fill="white")
    d.line(sc(VEIN), fill=NAVY, width=int(2.2*S)); [d.ellipse((x*S-1.1*S, y*S-1.1*S, x*S+1.1*S, y*S+1.1*S), fill=NAVY) for x, y in VEIN]
    d.rounded_rectangle((RIM[0]*S, RIM[1]*S, RIM[2]*S, RIM[3]*S), radius=RIM[4]*S, fill="white")
    d.polygon(sc(poly(POT)), fill="white")
    hl = sc(poly(HIGHLIGHT)); d.line(hl, fill=NAVY, width=2*S, joint="curve")
    for x, y in (hl[0], hl[-1]): d.ellipse((x-S, y-S, x+S, y+S), fill=NAVY)
    cx, cy, rx, ry, rot = LEAF; a = math.radians(rot)
    e = [(cx + rx*math.cos(t)*math.cos(a) - ry*math.sin(t)*math.sin(a), cy + rx*math.cos(t)*math.sin(a) + ry*math.sin(t)*math.cos(a)) for t in [i*2*math.pi/72 for i in range(72)]]
    d.polygon(sc(e), fill=GREEN)
    return im.resize((size, size), Image.LANCZOS)

# ---------- header logo masks from the supplied artwork ----------
img = np.asarray(Image.open(SRC).convert("RGB"), float)
bg = np.array([8, 25, 44], float); lum = lambda a: a[..., 0]*.299 + a[..., 1]*.587 + a[..., 2]*.114
green = np.clip((img[..., 1] - np.maximum(img[..., 0], img[..., 2]) - 8) / 30, 0, 1)
alpha_all = np.clip((lum(img) - lum(bg)) / (255 - lum(bg)), 0, 1)
ink = alpha_all * (1 - green)
leaf = np.clip(np.clip((img[..., 1] - 40) / 110, 0, 1) * green * 1.6, 0, 1)
box_src = np.maximum(ink, leaf) > 0.08
ys, xs = np.where(box_src); pad = 10
x0, y0, x1, y1 = xs.min()-pad, ys.min()-pad, xs.max()+pad+1, ys.max()+pad+1
H = 96
def mask(a, name):
    crop = a[y0:y1, x0:x1]
    rgba = np.zeros(crop.shape + (4,), np.uint8); rgba[..., :3] = 255; rgba[..., 3] = (crop * 255).round()
    im = Image.fromarray(rgba, "RGBA"); w = round(im.width * H / im.height)
    im.resize((w, H), Image.LANCZOS).save(name); return w
w = mask(ink, "logo-ink.png"); mask(leaf, "logo-leaf.png")
print("logo mask size", w, H)

# ---------- write everything ----------
open("favicon.svg", "w").write(icon_svg())
icon_png(180).save("apple-touch-icon.png")
icon_png(256).save("favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
card = Image.open(SRC).convert("RGB").resize((1200, 600), Image.LANCZOS); card.save("inkwell-share.png", optimize=True)
for out in OUT:
    for f in ("favicon.svg", "apple-touch-icon.png", "favicon.ico", "logo-ink.png", "logo-leaf.png"): shutil.copy(f, f"{out}/{f}")
shutil.copy("inkwell-share.png", "../web/public/inkwell-share.png")

# preview sheet
sheet = Image.new("RGB", (900, 330), (255, 255, 255)); x = 30
for s in (16, 32, 48, 64, 180):
    t = icon_png(s); sheet.paste(t, (x, 30), t); x += s + 30
big = icon_png(256); sheet.paste(big, (620, 30), big)
t16 = icon_png(16).resize((160, 160), Image.NEAREST); sheet.paste(t16, (30, 130), t16)
sheet.save("icon-preview.png")
