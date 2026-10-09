"""Makes the tab icon, home-screen icon and link-preview card for the Articles site and admin portal.

The icon is the same indigo 'A' tile as the portfolio at ahmadnadeem.dev, so the two read as one site.
Run: python make_icons.py   (writes into ../web/public and ../admin/public)
"""
import shutil
from PIL import Image, ImageDraw, ImageFont

INDIGO = "#5b4bdb"; PAGE = "#0e1320"; TEXT = "#e2e8f0"; ACCENT = "#a99bff"
BOLD = r"C:\Windows\Fonts\arialbd.ttf"; REGULAR = r"C:\Windows\Fonts\arial.ttf"
S = 8

SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="' + INDIGO + '"/>'
       '<text x="32" y="45" font-family="Arial,sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="#fff">A</text></svg>')


def tile(size):
    im = Image.new("RGBA", (size*S, size*S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, size*S-1, size*S-1), radius=int(size*S*14/64), fill=INDIGO)
    font = ImageFont.truetype(BOLD, int(size*S*36/64)); l, t, r, b = d.textbbox((0, 0), "A", font=font)
    d.text(((size*S - (r - l))/2 - l, size*S*45/64 - (b - t) - t + (b - t) - (b - t) + 0), "A", font=font, fill="white", anchor=None)
    return im.resize((size, size), Image.LANCZOS)


def card():
    c = Image.new("RGB", (1200, 600), PAGE); d = ImageDraw.Draw(c)
    d.text((90, 190), "Articles", font=ImageFont.truetype(BOLD, 150), fill=TEXT)
    d.text((96, 372), "by Ahmad Nadeem", font=ImageFont.truetype(BOLD, 52), fill=ACCENT)
    d.text((96, 470), "articles.ahmadnadeem.dev", font=ImageFont.truetype(REGULAR, 34), fill="#7d8aa1")
    return c


if __name__ == "__main__":
    t180 = tile(180); t180.save("apple-touch-icon.png"); tile(256).save("favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    open("favicon.svg", "w", encoding="utf-8").write(SVG); card().save("articles-share.png", optimize=True)
    for site in ("../web/public", "../admin/public"):
        for f in ("favicon.svg", "favicon.ico", "apple-touch-icon.png"): shutil.copy(f, f"{site}/{f}")
    shutil.copy("articles-share.png", "../web/public/articles-share.png"); print("ok")
