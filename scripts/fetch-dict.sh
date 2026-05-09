#!/usr/bin/env bash
# Download JMdict (English, common-only) for local development.
# In Docker the file is bundled into /opt/dict at build time; this script
# mirrors that for `npm run dev`.
set -euo pipefail

# Upstream tag pattern: <semver>+<timestamp>, e.g. 3.6.2+20260504132921. Asset
# filenames embed the same string; the `+` must be %2B-encoded in URLs.
TAG="${JMDICT_TAG:-3.6.2+20260504132921}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="${ROOT}/var/dict"
ENC_TAG="${TAG//+/%2B}"
ARCHIVE="jmdict-eng-common-${ENC_TAG}.json.tgz"
URL="https://github.com/scriptin/jmdict-simplified/releases/download/${ENC_TAG}/${ARCHIVE}"

mkdir -p "${DEST_DIR}"

if [[ -f "${DEST_DIR}/jmdict-eng-common.json" ]]; then
  echo "[fetch-dict] ${DEST_DIR}/jmdict-eng-common.json already exists. Delete it to re-download."
  exit 0
fi

echo "[fetch-dict] Downloading ${URL}"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

curl -L --fail -o "${TMP}/${ARCHIVE}" "${URL}"
tar -xzf "${TMP}/${ARCHIVE}" -C "${TMP}"

JSON_FILE="$(find "${TMP}" -name 'jmdict-eng-common-*.json' -type f | head -n 1)"
if [[ -z "${JSON_FILE}" ]]; then
  echo "[fetch-dict] Could not find jmdict-eng-common JSON in archive." >&2
  exit 1
fi

mv "${JSON_FILE}" "${DEST_DIR}/jmdict-eng-common.json"
echo "${TAG}" > "${DEST_DIR}/VERSION"
echo "[fetch-dict] Saved ${DEST_DIR}/jmdict-eng-common.json (tag ${TAG})"
