"""Compress the pinned UI package's embedded fonts; requires fonttools[woff].

Run after updating @takeoff-tokyo/ui. Builds use the committed WOFF2 files and
verify their source hashes, so Python is not needed in CI or deployments.
"""

import base64
import hashlib
import io
import json
from pathlib import Path
import re

from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
package = root / "node_modules/@takeoff-tokyo/ui"
css = (package / "dist/index.css").read_text()
output = root / "assets/fonts"
output.mkdir(parents=True, exist_ok=True)
fonts = {}

for block in re.findall(r"@font-face\{([^}]+)\}", css):
    embedded = re.search(r"url\(data:font/ttf;base64,([A-Za-z0-9+/=]+)\)", block)
    if not embedded:
        continue
    source = base64.b64decode(embedded[1])
    family = re.search(r"font-family:([^;]+)", block)[1].strip('"\'')
    weight = re.search(r"font-weight:([^;]+)", block)[1]
    filename = f"{family}-{weight}".replace(" ", "-") + ".woff2"
    font = TTFont(io.BytesIO(source))
    font.flavor = "woff2"
    font.save(output / filename)
    fonts[hashlib.sha256(source).hexdigest()] = filename
    print(f"{filename}: {len(source):,} → {(output / filename).stat().st_size:,} bytes")

if not fonts:
    raise SystemExit("No embedded TTF fonts found; check the UI package's font format.")

version = json.loads((package / "package.json").read_text())["version"]
(output / "manifest.json").write_text(
    json.dumps({"source": f"@takeoff-tokyo/ui@{version}", "fonts": fonts}, indent=2) + "\n"
)
