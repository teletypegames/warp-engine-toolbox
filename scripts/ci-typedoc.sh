#!/bin/sh
# Publishes the API reference of a vX.Y.Z tag: the TypeDoc HTML with a meta.json, as the
# Gitea generic package engines/warp-engine-toolbox-typedoc/<version>/typedoc.tar.gz. The
# wiki-fetcher unpacks it under wiki.teletypegames.org/typedoc/warp-engine-toolbox/.
set -eu

PACKAGES="${PACKAGES_API:-https://git.teletypegames.org/api/packages/engines/generic}"
TAG="${CI_COMMIT_TAG:?CI_COMMIT_TAG}"
VERSION="$(node -p 'require("./package.json").version')"

[ "v$VERSION" = "$TAG" ] || { echo "the tag $TAG is not v$VERSION of package.json" >&2; exit 1; }

npm run docs
printf '{"gem":"warp-engine-toolbox","version":"%s","commit":"%s","date":"%s","coverage":100}\n' \
  "$VERSION" "$(git rev-parse HEAD)" "$(date -u +%F)" > doc/meta.json
tar -czf typedoc.tar.gz -C doc .

TOKEN="$(printf '%s' "${GITEA_TOKEN:?GITEA_TOKEN}" | tr -d '[:space:]')"
curl --fail-with-body -sS -X PUT \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --upload-file typedoc.tar.gz \
  "$PACKAGES/warp-engine-toolbox-typedoc/$VERSION/typedoc.tar.gz"
echo "==> warp-engine-toolbox-typedoc $VERSION uploaded"
