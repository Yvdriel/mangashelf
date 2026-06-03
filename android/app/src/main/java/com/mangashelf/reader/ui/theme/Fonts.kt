package com.mangashelf.reader.ui.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import com.mangashelf.reader.R

/**
 * Bundled Noto Sans JP (OFL). The Kompakt system font is Latin-only "Lato" (device.md), so CJK
 * text in flashcards / reader / dictionary must use a bundled family — system fallback is not
 * relied on. Single variable TTF; weights are synthesised as needed.
 */
val NotoSansJp = FontFamily(Font(R.font.noto_sans_jp))
