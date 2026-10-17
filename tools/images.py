"""Generate web images from src/originals into assets/img.

  python3 tools/images.py

For every photo: crop away watermarks / Instagram overlays, then write
WebP and JPEG at each width in WIDTHS (never upscaled). Also builds the
transparent logo mark, favicons and the 1200x630 social share image.
Needs Pillow (pip install pillow).
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "originals"
OUT = ROOT / "assets" / "img"
WIDTHS = (640, 1080)

# name: (left, top, right, bottom) crop box in source pixels, None = keep all
PHOTOS = {
    "project-brass-suite":   (0, 235, 1080, 1600),   # emoji overlay + story bar
    "project-onyx-wetroom":  (0, 0, 1080, 1590),     # "Custom by" signature
    "project-stone-ensuite": (0, 0, 1080, 1420),     # old logo badge
    "project-star-dark":     (0, 0, 1086, 1225),     # watermark
    "project-star-light":    (0, 0, 1080, 1205),     # watermark
    "project-cloakroom":     (0, 0, 1023, 1320),     # watermark
}


def save_variants(im, name):
    for w in WIDTHS:
        r = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(OUT / f"{name}-{w}.webp", "WEBP", quality=78, method=6)
        r.save(OUT / f"{name}-{w}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
    return im.size


def mark():
    """Gold monogram on transparent ground, derived from the black-background artwork."""
    im = Image.open(SRC / "brand-mark.jpg").convert("RGB").crop((120, 220, 960, 1090))
    gray = ImageOps.grayscale(im)
    alpha = gray.point(lambda v: 0 if v < 18 else min(255, int((v - 18) * 1.6)))
    gold = Image.new("RGB", im.size, (214, 178, 112))
    # keep the artwork's own shading where it is bright, flat gold where faint
    rgb = Image.composite(im, gold, gray.point(lambda v: 255 if v > 90 else 0))
    rgba = rgb.copy()
    rgba.putalpha(alpha)
    rgba = rgba.crop(rgba.getbbox())
    side = max(rgba.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(rgba, ((side - rgba.width) // 2, (side - rgba.height) // 2))
    for s in (96, 192):
        sq.resize((s, s), Image.LANCZOS).save(OUT / f"mark-{s}.png", optimize=True)
    # favicons: mark on the site's ink colour
    for s, fn in ((32, "favicon-32.png"), (180, "apple-touch-icon.png"), (512, "icon-512.png")):
        bg = Image.new("RGBA", (s, s), (11, 10, 9, 255))
        m = sq.resize((int(s * .82), int(s * .82)), Image.LANCZOS)
        bg.alpha_composite(m, ((s - m.width) // 2, (s - m.height) // 2))
        bg.convert("RGB").save(OUT / fn, optimize=True)
    return sq


def og(mark_img):
    """1200x630 share card: photo on the left, mark and name on ink."""
    W, H = 1200, 630
    card = Image.new("RGB", (W, H), (11, 10, 9))
    ph = Image.open(SRC / "project-star-dark.jpg").convert("RGB").crop(PHOTOS["project-star-dark"])
    ph = ImageOps.fit(ph, (640, H), Image.LANCZOS, centering=(.5, .45))
    card.paste(ph, (W - 640, 0))
    m = mark_img.resize((220, 220), Image.LANCZOS)
    card.paste(m, (170, 120), m)
    try:  # wordmark needs fontTools to read the site's woff2 (pip install fonttools brotli)
        import io
        from fontTools.ttLib import TTFont
        from PIL import ImageDraw, ImageFont

        def font(name, size):
            f = TTFont(ROOT / "assets" / "fonts" / name)
            f.flavor = None
            buf = io.BytesIO()
            f.save(buf)
            buf.seek(0)
            return ImageFont.truetype(buf, size)

        d = ImageDraw.Draw(card)
        gold, muted = (198, 161, 91), (168, 161, 151)
        x, y = 92, 380
        for ch in "UNICKS":  # letter-spaced by hand, PIL has no tracking
            d.text((x, y), ch, font=font("cormorant.woff2", 64), fill=gold)
            x += d.textlength(ch, font=font("cormorant.woff2", 64)) + 22
        d.text((96, 470), "LUXURY BATHROOMS", font=font("jost.woff2", 22), fill=muted)
    except ImportError:
        pass
    card.save(OUT / "og-image.jpg", "JPEG", quality=84, optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, box in PHOTOS.items():
        im = Image.open(SRC / f"{name}.jpg").convert("RGB")
        if box:
            im = im.crop(box)
        print(name, save_variants(im, name))
    og(mark())
    print("done")
