"""Create a Chrome Web Store-ready ZIP with manifest.json at the archive root."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "extensions" / "sapa-whatsapp-tab"
manifest = json.loads((SOURCE / "manifest.json").read_text())
version = manifest["version"]
files = [
    "manifest.json", "background.js", "content.js", "popup.html", "popup.css",
    "popup.js", "popupStatus.js", "icons/icon-16.png", "icons/icon-32.png",
    "icons/icon-48.png", "icons/icon-128.png",
]
for name in files:
    if not (SOURCE / name).is_file():
        raise SystemExit(f"Missing extension file: {name}")
output = ROOT / "releases" / f"SAPA-WhatsApp-v{version}.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(SOURCE / name, name)
print(output)
