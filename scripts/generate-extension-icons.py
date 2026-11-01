"""Generate Chrome extension PNG icons from the SAPA visual language."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "extensions" / "sapa-whatsapp-tab" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
size = 512

shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle((64, 67, 448, 451), radius=104, fill=(27, 20, 91, 92))
shadow = shadow.filter(ImageFilter.GaussianBlur(17))

image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
image.alpha_composite(shadow)
gradient = Image.new("RGBA", (size, size), (0, 0, 0, 0))
pixels = gradient.load()
for y in range(size):
    for x in range(size):
        t = min(1, max(0, (x + y) / (size * 2)))
        pixels[x, y] = (round(79 + 68 * t), round(70 - 19 * t), round(229 + 5 * t), 255)
mask = Image.new("L", (size, size), 0)
ImageDraw.Draw(mask).rounded_rectangle((64, 64, 448, 448), radius=104, fill=255)
image.paste(gradient, (0, 0), mask)

d = ImageDraw.Draw(image)
d.rounded_rectangle((160, 151, 365, 338), radius=58, fill=(255, 255, 255, 255))
d.polygon([(171, 291), (171, 377), (231, 330)], fill=(255, 255, 255, 255))
d.polygon([(278, 177), (211, 272), (263, 272), (246, 322), (321, 228), (270, 228)], fill=(251, 191, 36, 255))
d.ellipse((360, 93, 439, 172), fill=(255, 255, 255, 255))
d.ellipse((368, 101, 431, 164), fill=(16, 185, 129, 255))
d.ellipse((389, 122, 410, 143), fill=(255, 255, 255, 255))

for output_size in (16, 32, 48, 128, 512):
    image.resize((output_size, output_size), Image.Resampling.LANCZOS).save(OUT / f"icon-{output_size}.png", optimize=True)
