#!/bin/sh
# Publishes the packaged VSIX of a vX.Y.Z tag: a Gitea release with the VSIX attached,
# then the marketplaces whose token the pipeline has (OVSX_PAT: Open VSX, VSCE_PAT: the
# Visual Studio Marketplace). A missing marketplace token skips that marketplace.
set -eu

FORGE="${FORGE_API:-https://git.teletypegames.org/api/v1}"
REPO="${CI_REPO:?CI_REPO}"
TAG="${CI_COMMIT_TAG:?CI_COMMIT_TAG}"
VSIX="dist/warpengine-toolbox.vsix"
VERSION="$(node -p 'require("./package.json").version')"

[ "v$VERSION" = "$TAG" ] || { echo "the tag $TAG is not v$VERSION of package.json" >&2; exit 1; }
[ -f "$VSIX" ] || { echo "no $VSIX" >&2; exit 1; }

TOKEN="${GITEA_TOKEN:-${CI_NETRC_PASSWORD:-}}"
AUTH=""
for scheme in token Bearer; do
  if curl -fsS -H "Authorization: $scheme $TOKEN" "$FORGE/user" >/dev/null 2>&1; then AUTH="Authorization: $scheme $TOKEN"; break; fi
done
[ -n "$AUTH" ] || { echo "the forge refused the credential" >&2; exit 1; }

release_id="$(curl -sS -H "$AUTH" "$FORGE/repos/$REPO/releases/tags/$TAG" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).id||"")}catch{console.log("")}})')"
if [ -z "$release_id" ]; then
  body="$(node -e 'const fs=require("fs");const t=fs.readFileSync("CHANGELOG.md","utf8");const m=t.split(/\n(?=## )/).find(s=>s.startsWith("## "+process.argv[1]));process.stdout.write(JSON.stringify({tag_name:process.argv[2],name:"WarpEngine Toolbox "+process.argv[1],body:m||""}))' "$VERSION" "$TAG")"
  release_id="$(curl -fsS -X POST -H "$AUTH" -H 'Content-Type: application/json' "$FORGE/repos/$REPO/releases" -d "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))')"
fi
name="warpengine-toolbox-$VERSION.vsix"
curl -fsS -X POST -H "$AUTH" "$FORGE/repos/$REPO/releases/$release_id/assets?name=$name" -F "attachment=@$VSIX" >/dev/null
echo "attached $name to the $TAG release"

if [ -n "${OVSX_PAT:-}" ]; then npx --yes ovsx@0.10.6 publish "$VSIX" -p "$OVSX_PAT"; else echo "no OVSX_PAT: Open VSX skipped"; fi
if [ -n "${VSCE_PAT:-}" ]; then npx vsce publish --packagePath "$VSIX" -p "$VSCE_PAT"; else echo "no VSCE_PAT: Visual Studio Marketplace skipped"; fi
