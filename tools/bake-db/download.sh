#!/usr/bin/env bash
# CH.2 STEP 0 — fetch the "max-everything" source data banks into tools/dict-data/.
# URLs verified live 2026-06-03. EDRDG is HTTP-only (its HTTPS cert fails hostname
# validation). "Netflix" freq has no clean unauthenticated URL → Aozora substitutes.
# Idempotent: skips files already present with non-zero size. Re-run to resume.
set -uo pipefail
cd "$(dirname "$0")/../dict-data" || exit 1
DEST="$(pwd)"
echo "Downloading source banks → $DEST"

# name|url   (curl -L follows GitHub release redirects)
ENTRIES=(
  "jitendex-yomitan.zip|https://github.com/stephenmk/stephenmk.github.io/releases/latest/download/jitendex-yomitan.zip"
  "KANJIDIC_english.zip|https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/KANJIDIC_english.zip"
  "JMnedict.zip|https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMnedict.zip"
  "JPDB_v2.2_freq.zip|https://github.com/Kuuuube/yomitan-dictionaries/raw/main/dictionaries/JPDB_v2.2_Frequency_Kana_2024-10-13.zip"
  "BCCWJ_freq.zip|https://github.com/Kuuuube/yomitan-dictionaries/raw/main/dictionaries/BCCWJ_SUW_LUW_combined.zip"
  "innocent_corpus.zip|https://github.com/MarvNC/yomitan-dictionaries/raw/master/japanese/freq/innocent_corpus/innocent_corpus.zip"
  "aozora_freq.zip|https://github.com/MarvNC/yomitan-dictionaries/raw/master/dl/%5BFreq%5D%20Aozora%20Bunko.zip"
  "kradzip.zip|http://ftp.edrdg.org/pub/Nihongo/kradzip.zip"
  "examples.utf.gz|http://ftp.edrdg.org/pub/Nihongo/examples.utf.gz"
  "JmdictFurigana.json.zip|https://github.com/Doublevil/JmdictFurigana/releases/latest/download/JmdictFurigana.json.zip"
  "kanjivg.zip|https://github.com/KanjiVG/kanjivg/releases/latest/download/kanjivg-20250816-main.zip"
)

fail=0
for e in "${ENTRIES[@]}"; do
  name="${e%%|*}"; url="${e#*|}"
  if [ -s "$name" ]; then echo "  [skip] $name (exists, $(du -h "$name" | cut -f1))"; continue; fi
  echo "  [get ] $name"
  if curl -fsSL --retry 4 --retry-delay 3 --connect-timeout 30 --max-time 600 -o "$name.part" "$url"; then
    mv "$name.part" "$name"
    echo "         ok $(du -h "$name" | cut -f1)"
  else
    echo "         FAIL $url"; rm -f "$name.part"; fail=1
  fi
done

echo "=== downloaded ==="
ls -la "$DEST"
echo "total raw: $(du -ch "$DEST"/* 2>/dev/null | tail -1 | cut -f1)"
[ "$fail" -eq 0 ] && echo "ALL OK" || echo "SOME FAILED (rerun to resume)"
exit $fail
