#!/usr/bin/env bash
set -euo pipefail

FILES=(
  "docs/PREMIUM_FEEL_UPGRADE_CHECKLIST.md"
  "docs/MOTION_TOKENS.md"
)

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  NORM_FILE="$f" python3 <<PY
import pathlib
import os
p = pathlib.Path(os.environ["NORM_FILE"])
t = p.read_text(encoding="utf-8")
t = t.replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")
t = t.replace("&gt;", ">").replace("&lt;", "<").replace("&amp;", "&")
p.write_text(t, encoding="utf-8")
print("normalized", p)
PY
done
