#!/usr/bin/env bash
# Downloads a sample interior splat (with walk-mode collision) into the viewer's dev server folder.
# Source: PlayCanvas engine example assets. Scan "SA3D_R&D_XP47" by Stephane Agullo (https://sa3d.fr),
# CC-BY-4.0 (credit required, commercial use allowed). Not committed: public/ is gitignored.
set -euo pipefail

BASE="https://raw.githubusercontent.com/playcanvas/engine/main/examples/assets/splats"
DEST="$(cd "$(dirname "$0")/../supersplat-viewer" && pwd)/public/samples/apartment"

mkdir -p "$DEST"
for f in apartment.sog apartment.voxel.json apartment.voxel.bin apartment.txt; do
    echo "Downloading $f"
    curl -fL --progress-bar -o "$DEST/$f" "$BASE/$f"
done

# The viewer won't start without a settings file. Default settings, with the starting camera placed
# in the courtyard (the default camera starts inside a wall in this scan).
cat > "$DEST/settings.json" <<'JSON'
{"version":2,"tonemapping":"linear","highPrecisionRendering":false,"background":{"color":[0,0,0]},"postEffectSettings":{"sharpness":{"enabled":false,"amount":0},"bloom":{"enabled":false,"intensity":0.1,"blurLevel":2},"grading":{"enabled":false,"brightness":1,"contrast":1,"saturation":1,"tint":[1,1,1]},"vignette":{"enabled":false,"intensity":0.5,"inner":0.3,"outer":0.75,"curvature":1},"fringing":{"enabled":false,"intensity":0.5}},"animTracks":[],"cameras":[{"initial":{"position":[1.96,1.56,-1.38],"target":[2.2,1.26,-2.88],"fov":85}}],"annotations":[],"startMode":"default"}
JSON

# Short link: http://localhost:3000/apartment forwards to the viewer with the sample's parameters.
# (The bare http://localhost:3000 stays blank: it looks for ./scene.compressed.ply.)
cat > "$DEST/../../apartment.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<title>Apartment sample</title>
<script>
location.replace('/?content=./samples/apartment/apartment.sog&settings=./samples/apartment/settings.json&collision=./samples/apartment/apartment.voxel.json');
</script>
HTML

# A/B comparison: superspl.at's own hosted copy of this scene (933K splats, SH1), streamed from
# their CDN into OUR viewer with the exact settings superspl.at uses. Same file + same settings as
# https://superspl.at/s?id=cdcec084, so any speed difference left is the browser/machine, not the data.
HOSTED="$DEST/../apartment-hosted"
mkdir -p "$HOSTED"
cat > "$HOSTED/settings.json" <<'JSON'
{"version":2,"tonemapping":"linear","highPrecisionRendering":false,"background":{"color":[0.2,0.2,0.2]},"postEffectSettings":{"sharpness":{"enabled":true,"amount":0.6},"bloom":{"enabled":false,"intensity":0.1,"blurLevel":2},"grading":{"enabled":false,"brightness":1,"contrast":1,"saturation":1,"tint":[1,1,1]},"vignette":{"enabled":false,"intensity":0.5,"inner":0.3,"outer":0.75,"curvature":1},"fringing":{"enabled":false,"intensity":0.5}},"animTracks":[],"cameras":[{"initial":{"position":[21.369461059570312,1.320825219154358,0.015320397913455963],"target":[19.739558015815398,1.3378950880682396,0.03238931678170573],"fov":80}}],"annotations":[],"startMode":"default"}
JSON
cat > "$DEST/../../apartment-hosted.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<title>Apartment (superspl.at copy)</title>
<script>
location.replace('/?content=https://d28zzqy0iyovbz.cloudfront.net/cdcec084/v1/meta.json&settings=./samples/apartment-hosted/settings.json&aa=false');
</script>
HTML

echo
echo "Done. With 'npm run develop' running, open:"
echo "http://localhost:3000/apartment          (PlayCanvas sample copy, with walk-mode collision)"
echo "http://localhost:3000/apartment-hosted   (superspl.at's copy, same settings as superspl.at)"
